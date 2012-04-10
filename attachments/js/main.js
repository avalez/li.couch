var request = function (options, callback) {
    options.success = function (obj) {
        callback(null, obj);
    }
    options.error = function (err) {
        if (err) callback(err);
        else callback(true);
    }
    if (options.data && typeof options.data == 'object') {
        options.data = JSON.stringify(options.data)
    }
    if (!options.dataType) options.processData = false;
    if (!options.dataType) options.contentType = 'application/json';
    if (!options.dataType) options.dataType = 'json';
    return $.ajax(options)
}

var param = function(a) {
    // Query param builder from jQuery, had to copy out to remove conversion of spaces to +
    // This is important when converting datastructures to querystrings to send to CouchDB.
    var s = [];
    if (jQuery.isArray(a) || a.jquery) {
        jQuery.each(a, function() {
            add(this.name, this.value);
        });
    } else {
        for (var prefix in a) {
            add(prefix, a[prefix]);
        }
    }
    return s.join("&");

    function add(key, value) {
        value = jQuery.isFunction(value) ? value() : value;
        if ($.inArray(key, ["key", "startkey", "endkey"]) >= 0) {
          value = JSON.stringify(value);
        }
        s[ s.length ] = encodeURIComponent(key) + '=' + encodeURIComponent(value);
    }
}

function nil() {}

var m = document.location.pathname.match(/.+\//);
var baseUrl = m ? '' : 'api/dummy/dummy/';
var app = {baseURL: baseUrl};

var cache = [];

app.uuid = function(uuid) {
    if (typeof uuid != 'undefined') {
        return uuid
    } else if (cache.length > 0) {
        return cache.pop()
    } else {
        return request({url: app.baseURL + '../../../_uuids?count=2'}, nil).pipe(function(data) {
            Array.prototype.push.apply(cache, data.uuids);
            return cache.pop()
        })
    }
}

app.view = function (view_id, params, callback) {
  return request({url: '_view/' + view_id + '?' + param(params)}, callback);
}

app.create = function(doc, callback) {
  return $.when(app.uuid(doc._id)).pipe(function(uuid) {
    doc._id = uuid; // new or existing
    return app.update(doc, function(error, data) {
      callback(error, doc)
    })
  })
}

app.read = function(doc_id, callback) {
  return request({type: 'GET', url: app.baseURL + '../../' + doc_id}, callback);
}

app.update = function(doc, callback) {
  app.myChanges.push(doc._id);
  return request({type: 'PUT', url: app.baseURL + '../../' + doc._id, data: doc}, function(error, data) {
    doc._rev = data.rev;
    callback(error, data);
  })
}

app.remove = function(doc_id, doc_rev, callback) {
  app.myChanges.push(doc_id);
  return request({type: 'DELETE', url: app.baseURL + '../../' + doc_id + '?rev=' + doc_rev}, callback);
}

app.myChanges = [];

// check if change has any modification from outside,
// return false if not our change, true otherwize
app.myChange = function(change) {
  var changeIndex = $.inArray(change.id, app.myChanges);
  if (changeIndex != -1) {
    app.myChanges.splice(changeIndex, 1);
  	return true;
  } else {
  	return false;
  }
}

/**
 * @namespace
 * $.couch.db.changes provides an API for subscribing to the changes
 * feed
 * <pre><code>var $changes = $.couch.db("mydatabase").changes();
 *$changes.onChange = function (data) {
 *    ... process data ...
 * }
 * $changes.stop();
 * </code></pre>
 */
app.changes = function(since, options) {

  options = options || {};
  // set up the promise object within a closure for this handler
  var timeout = 100, active = true,
    listeners = [],
    promise = /** @lends $.couch.db.changes */ {
    /**
     * Add a listener callback
     * @see <a href="http://techzone.couchbase.com/sites/default/
     * files/uploads/all/documentation/couchbase-api-db.html#couch
     * base-api-db_db-changes_get">docs for /db/_changes</a>
     * @param {Function} fun Callback function to run when
     * notified of changes.
     */
    onChange : function(fun) {
      listeners.push(fun);
    },
    /**
     * Stop subscribing to the changes feed
     */
    stop : function() {
      active = false;
    }
  };
  // call each listener for each change
  function triggerListeners(resp) {
    $.each(resp.results, function(_, change) {
      // Full refresh if design doc changes
      if (/^_design/.test(change.id)) {
        document.location.reload();
        return false; // break
      }
      if (!app.myChange(change)) {
        // call each listener for the change
        $.each(listeners, function() {
          this(change);
        });
      }
    })
  };
  // when there is a change, call any listeners, then check for
  // another change
  options.success = function(error, resp) {
    if (error) {
      options.error();
    } else {
      timeout = 100;
      if (active) {
        since = resp.last_seq;
        setTimeout(function() {
          getChangesSince();
        }, timeout);
        triggerListeners(resp);
      };
    };
  };
  options.error = function() {
    if (active) {
      setTimeout(getChangesSince, timeout);
      timeout = timeout * 2;
    }
  };
  // actually make the changes request
  function getChangesSince() {
    var opts = {
      heartbeat : 10 * 1000,
      feed : "longpoll",
      since : since
    }
    request(
      {url: app.baseURL + "../../_changes?" + param(opts)},
      options.success
    );
  }
  // start the first request
  if (since) {
    getChangesSince();
  } else {
    request({url: app.baseURL + '../../'}, function(error, info) {
      since = info.update_seq;
      getChangesSince();
    });
  }
  return promise;
}

///////////////////////////////////////////////////////////////////////////////

var editor;

// http://stackoverflow.com/questions/6987132/knockoutjs-html-binding
ko.bindingHandlers.htmlValue = {
  init: function(element, valueAccessor, allBindingsAccessor) {
      ko.utils.registerEventHandler(element, "click", function(event) {
        var t = document.elementFromPoint(event.clientX, event.clientY);
        if (!t || (t.nodeName != 'A' && element.contentEditable != 'true')) {
          editor.enable(element);
        }
      });
      ko.utils.registerEventHandler(element, "blur", function() {
        if (!element.preventblur && editor.d) { // tinyeditor: if not tool button clicked and if wysiwyg
          var htmlValue = valueAccessor();
          var elementValue = element.innerHTML;
          if (ko.isWriteableObservable(htmlValue)) {
              htmlValue(elementValue);
          }
          else { //handle non-observable one-way binding
              var allBindings = allBindingsAccessor();
              if (allBindings['_ko_property_writers'] && allBindings['_ko_property_writers'].htmlValue) allBindings['_ko_property_writers'].htmlValue(elementValue);
          }
          editor.enable(false);
        }
      });
      $(element).keypress(function(event) {
        if (event.keyCode == 27) {
          var value = valueAccessor();
          element.innerHTML = value();
          element.blur();
          event.preventDefault();
        }
      });
    },
    update: function(element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor()) || "";
        element.innerHTML = value;
    }
};

edit = function(object, event) {
  $('.editable', event.target.parentNode.parentNode).click();
}

///////////////////////////////////////////////////////////////////////////////

// append array
ko.observableArray.fn.pushAll = function(array) {
  var underlyingArray = this();
  this.valueWillMutate();
  var methodCallResult = Array.prototype.push.apply(underlyingArray, array);
  this.valueHasMutated();
  return methodCallResult;
};

// The view model is an abstract description of the state of the UI, but without any knowledge of the UI technology (HTML)
var viewModel = {
    root: observable({name: ''}),
    newItem: ko.observable(''),
    notes: ko.observableArray(),
    children: ko.observableArray(),
    newItemLoading: ko.observable(false),
    statusMessage: ko.observable('')
}

viewModel.newItem.subscribe(function(newValue) {
    if ($.trim(newValue) == '') {
        return;
    }
    var parent_id = viewModel.children()[0] ? viewModel.children()[0]._id : 'root';
    viewModel.newItemLoading(true);
    viewModel.create({parent_id: parent_id, name: newValue, type: 'note', order: 0}, function(error, doc) {
        viewModel.newItemLoading(false);
        // unless opened other note
        if (typeof viewModel.children()[0] != 'undefined' && viewModel.children()[0]._id == doc.parent_id) {
          viewModel.notes.push(doc);
        }
        viewModel.newItem(''); // clear
    })
});

viewModel.reset = function() {
  viewModel.children.splice(0, viewModel.children().length);
  viewModel.notes.splice(0, viewModel.notes().length);
}

viewModel.create = function(doc, callback) {
  var doc_to_save = ko.toJS(doc);
  delete doc_to_save['index'];
  delete doc_to_save['loading'];
  app.create(doc_to_save, function(error, doc) {
    callback(error, doc);
  });
}

viewModel.read = function(doc_id, callback) {
  app.read(doc_id, function(error, data) {
    callback(data);
  })
}

viewModel.save = function (doc, callback) {
    var doc_to_save = ko.toJS(doc);
    delete doc_to_save['index'];
    delete doc_to_save['loading'];
    app.update(doc_to_save, function(error, data) {
      if (!error) {
        doc._rev = data.rev;
      } else { // TODO if (data.error == 'conflict') {
        viewModel.statusMessage('Error: ' + data.error);
        setTimeout(function() {
          viewModel.statusMessage('');
        }, 5000); // 5 sec        
      }
      callback(error, data);
    })
}

viewModel.remove = function(doc_id, doc_rev, callback) {
    var deferred = app.remove(doc_id, doc_rev, nil);
    // cascade, and callback on first level
    app.view('children', {key: doc_id}, function(error, data) {
        var deferreds = [];
        $(data.rows).each(function(i, row) {
            deferreds.push(viewModel.remove(row.id, row.value)); // recurse
        });
        $.when(deferreds).done(callback);
    });
    return deferred;
}

// rather belong to doc, but to both new and existing, so bind it to viewModel
viewModel.add = function($data) {
  viewModel.children.splice($data.index() + 1, 0,
    observableNewItem(getOrder(viewModel.children, $data.index())));
}

function observable(doc) {
    var $save = function() {
      if (!doc.syncing) {
        doc.loading(true);
        viewModel.save(doc, function() {
          doc.loading(false);
        });
      }
    }
    doc.name = ko.observable(doc.name);
    doc.name.subscribe($save);
    doc.loading = ko.observable(false);
    doc.remove = function() {
      doc.loading(true);
      viewModel.remove(doc._id, doc._rev, function() {
        doc.loading(false);
        if (doc._id == viewModel.children()[0]._id) {
          goup(doc);
        } else {
          viewModel.children.remove(doc);
        }
      });
    }
    doc.load = function() {
      doc.loading(true);
      viewModel.read(this._id, doc.set);
    }
    doc.set = function(data) {
      doc.loading(false);
      doc._id = data._id;
      doc._rev = data._rev;
      doc.parent_id = data.parent_id;
      doc.type = data.type;
      doc.order = data.order;
      doc.syncing = true; // prevent save
      doc.name(data.name);
      delete doc['syncing'];      
    }
    
    return doc;
}

function goup(doc) {
  if (window.location.hash == '#/' || !window.location.hash) {
    delete viewModel.children()[0]['_id']; // force reload
    load();
  } else {
    var id = (doc.parent_id == 'root' ? '' : doc.parent_id);
    window.location.hash = '#/' + id;
  }
}

function getOrder(array, index) {
  if (typeof array == 'function') {
    array = array();
  }
  if (typeof index == 'function') {
  	index = index();
  }
  var parent_id = index == 0 ? array[index]._id : array[index].parent_id;
  var prev_order = array[index].order;
  var next_order = index == array.length - 1 ? 9007199254740992 : array[index + 1].order;
  var new_order = Math.floor(Math.random() * (next_order - prev_order)) + prev_order;  
  return {parent_id: parent_id, order: new_order};
}

function observableNewItem(options) {
  var doc = {parent_id: options.parent_id, order: options.order};
  doc.name = ko.observable('');
  doc.type = 'section';
  doc.loading = ko.observable(false);
  doc.remove = function() {
    // just remove it
    viewModel.children.splice(this.index(), 1);
  };
  doc.name.subscribe(function(newValue) {
    if ($.trim(newValue) == '') {
        return;
    }

    doc.loading(true);
    viewModel.create(doc, function(error, new_doc) {
      doc.loading(false);
      // unless opened other note
      if (typeof viewModel.children()[0] != 'undefined' && viewModel.children()[0]._id == doc.parent_id) {
        // convert to existing observable inplace
        viewModel.children.splice(doc.index(), 1, observable(new_doc));
      }
    });
  }, doc);
  return doc;
}

// attach index to items whenever array changes
// http://stackoverflow.com/questions/6047713/bind-template-item-to-the-index-of-the-array-in-knockoutjs
var indexMaintainance = function() {
    var children = this.children();
    for (var i = 0, j = children.length; i < j; i++) {
       var child = children[i];
        if (!child.index) {
           child.index = ko.observable(i);  
        } else {
           child.index(i);   
        }
    }
};

viewModel.children.subscribe(indexMaintainance, viewModel);

function observableArray(data) {
  var array = [];
  $(data.rows).each(function(i, row) {
      row.doc.index = ko.observable(i);
      if (typeof row.doc.order == 'undefined') {
        row.doc.order = i; // TODO: getOrder
      }
      array.push(observable(row.doc))      
  })  
  return array;
}

function findById(docs, id) {
  for (var i = 0, length = docs.length; i < length; i++) {
    if (docs[i]._id == id) {
      return {index: i, value: docs[i]};
    }
  }
  return {index: -1};
}
/*
 * Handles any incoming real time changes from CouchDB, this will either
 * trigger a full page load if the design doc has changed, or update
 * the current list of tasks if needed
 */
function handleChanges() {

  $changes = app.changes();
  $changes.onChange(function(change) {

        var section = findById(viewModel.children(), change.id), childNote = findById(viewModel.notes(), change.id);
        if (change.deleted) {
          if (section.index == 0) { // note deleted, go one level up
            goup(viewModel.children()[0]);
          } else if (section.index != -1) { // section deleted
            viewModel.children.splice(section.index, 1);
          } else if (childNote.index != -1) { // child note deleted
            viewModel.notes.splice(childNote.index, 1);
          }
        } else { // updated/added
          if (section.index != -1)  {
            section.value.load();
          } else if (childNote.index != -1) {
            // ignore child note update
          } else { // new item?
            app.read(change.id, function(error, doc) {
              if (typeof viewModel.children()[0] != 'undefined' 
                  && doc.parent_id == viewModel.children()[0]._id) { // new item!
                if (doc.type == 'section') { // insert at certain position
                  var added = false;
                  for (var i = 0, length = viewModel.children().length; i < length && !added; i++) {
                    if (viewModel.children()[i].order > doc.order) {
                      viewModel.children.splice(i, 0, observable(doc)); // insert
                      added = true;
                    }
                  }
                  if (!added) { // append
                    viewModel.children.push(observable(doc));
                  }
                } else { // child note added
                  viewModel.notes.push(doc); // add
                }
              }
            })
          }
        }
    });

}

// http://stackoverflow.com/questions/822452/strip-html-from-text-javascript
function stripHtml(html)
{
   var tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent||tmp.innerText;
}

var run = function() {
    ko.applyBindings(viewModel);
    editor = new TINY.editor.edit('editor',{
      el:$('header > div')[0],
      controls:['bold', 'italic', 'underline', 'strikethrough', '|', 'subscript', 'superscript', '|', 'orderedlist', 'unorderedlist', '|' ,'outdent' ,'indent', '|', 'leftalign', 'centeralign', 'rightalign', 'blockjustify', '|', 'unformat', '|', 'undo', 'redo', 'n', 'font', 'size', 'style', '|', 'image', 'hr', 'link', 'unlink', '|', 'cut', 'copy', 'paste', '|', 'source', 'done'], // available options, a '|' represents a divider and an 'n' represents a new row
      fonts:['Verdana','Arial','Georgia','Trebuchet MS'],  // array of fonts to display
      xhtml:true, // generate XHTML vs HTML
      done: function(el) {el.blur()} // extension point, for stop
    });
    $('footer').show();
    handleChanges();
    $(window).hashchange(load);
    load()
}

function setTitle(doc) {
  document.title = stripHtml(doc.name());
  doc.name.subscribe(function(newValue) {
    document.title = stripHtml(newValue);
  });
}

var load = function() {
    viewModel.statusMessage('Loading...');
    var parent_id = window.location.hash.substring(2) || 'root'; // strip '#/'
    if (viewModel.children().length == 0 || viewModel.children()[0]._id != parent_id) {
        viewModel.reset();
        var $def1 = app.view('note', {startkey: [parent_id], endkey: [parent_id, 9007199254740992], include_docs: true},
         function(error, data) {
            if (!error && data.rows.length > 0 && data.rows[0].doc.type == 'note') {
                $('div#not-found').hide();
                viewModel.children.pushAll(observableArray(data, observable));
                setTitle(viewModel.children()[0]);
            } else {
                viewModel.root.set({_id: parent_id, name: 'Untitled', type: 'note', order: 0});
                if (parent_id != 'root') {
                  viewModel.root.parent_id = 'root';
                }
                $('div#not-found').show();
            }
        });
        var $def2 = app.view('childnotes', {key: parent_id}, function(error, data) {
            if (!error && data.rows.length > 0) {
                var array = [];
                $(data.rows).each(function(i, row) {
                    array.push({_id: row.id, name: row.value})      
                })  
                viewModel.notes.pushAll(array);
            }
        });
        $.when($def1, $def2).then(function() {
          viewModel.statusMessage('');
        })
    }
}

$(run)
