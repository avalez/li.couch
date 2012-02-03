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
    $.ajax(options)
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

app.uuid = function (callback) {
    if (cache.length > 0) {
        callback(cache.pop());
    } else {
        request({url: app.baseURL + '../../../_uuids?count=2'}, function(error, data) {
            Array.prototype.push.apply(cache, data.uuids);
            callback(cache.pop());
        });
    }
}

app.view = function (view_id, params, callback) {
  request({url: '_view/' + view_id + '?' + param(params)}, callback);
}

app.create = function(doc, callback) {
  app.uuid(function(uuid) {
    doc._id = uuid;
    app.update(doc, function(error, data) {
      callback(error, doc);
    })
  });
}

app.read = function(doc_id, callback) {
  request({type: 'GET', url: app.baseURL + '../../' + doc_id}, callback);
}

app.update = function(doc, callback) {
  request({type: 'PUT', url: app.baseURL + '../../' + doc._id, data: doc}, function(error, data) {
    doc._rev = data.rev;
    callback(error, data);
  })
}

app.remove = function(doc, callback) {
  request({type: 'DELETE', url: app.baseURL + '../../' + doc._id + '?rev=' + doc._rev}, callback);
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
  // call each listener when there is a change
  function triggerListeners(resp) {
    $.each(listeners, function() {
      this(resp);
    });
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
          triggerListeners(resp);
          getChangesSince();
        }, timeout);
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

ko.bindingHandlers.editing = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        $(element).focus(function() {
            var value = valueAccessor();
            value(true);
        });
        $(element).blur(function() {
            var value = valueAccessor();
            value(false);
        });
        $(element).keypress(function(event) {
            if (event.which == 13) {
                element.blur();
            } else if (event.keyCode == 27) {
                var allBindings = allBindingsAccessor();
                var oldValue = allBindings.value();
                element.value = oldValue;
                element.blur();
            }
        });
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        if (ko.utils.unwrapObservable(value)) {
            element.focus();
            // position cursor to text end
            var $tmp = element.value;
            element.value = '';
            element.value = $tmp;
        } else {
            element.blur();
        }
    }
}

///////////////////////////////////////////////////////////////////////////////

var myChanges = [];

// The view model is an abstract description of the state of the UI, but without any knowledge of the UI technology (HTML)
var viewModel = {
    parent: observable({name: '', completed: false}),
    newItem: ko.observable(''),
    editingNewItem: ko.observable(false),
    children: ko.observableArray()
}

viewModel.parent.name.subscribe(function(newValue) {
  document.title = newValue;
});

viewModel.newItem.subscribe(function(newValue) {
    if ($.trim(newValue) == '') {
        return;
    }
    viewModel.create(viewModel.parent._id, newValue, function(error, doc) {
        viewModel.children.push(observable(doc));
        viewModel.newItem(''); // clear
    })
});

viewModel.children.subscribe(function(newValue) {
  if (!viewModel.parent.syncing) {
    viewModel.complete();
  }
})

viewModel.reset = function() {
  delete viewModel.parent['_id'];
  viewModel.parent.syncing = true;
  viewModel.parent.name('');
  delete viewModel.parent['syncing'];
  viewModel.children.splice(0, viewModel.children().length);
}

viewModel.create = function(parent_id, name, callback) {
  var doc = {
      parent_id: parent_id,
      name: name,
      completed: false
  };
  app.create(doc, function(error, doc) {
    if (!error) {
      myChanges.push(doc._id);
      /*
      changes = myChanges[data.id] || [];
      changes.push(data.rev);
      myChanges[data.id] = changes;
      */
    
      callback(error, doc);
    }
  });
}

viewModel.read = function(doc_id, callback) {
  app.read(doc_id, function(error, data) {
    callback(data);
  })
}

viewModel.save = function (doc, callback) {
    var doc_to_save = ko.toJS(doc);
    delete doc_to_save['editing'];
    app.update(doc_to_save, function(error, data) {
      if (!error) {
        doc._rev = data.rev;
        myChanges.push(data.id);
        /*
        changes = myChanges[data.id] || [];
        changes.push(data.rev);
        myChanges[data.id] = changes;
        */
      } else if (data.error == 'conflict') {
        doc.load();
      }
      callback(error, data);
    })
}

viewModel.remove = function(doc) {
    app.remove(doc, function(error, data) {
      myChanges.push(data.id);
      /*
        changes = myChanges[data.id] || [];
        changes.push(data.rev);
        myChanges[data.id] = changes;
      */
    })
    // cascade
    app.view('children', {key: doc._id}, function(error, data) {
        $(data.rows).each(function(i, row) {
            viewModel.remove(row.value); // recurse
        })
    })
}

viewModel.complete = function(doc, newValue) {
    if (newValue) { // complete children
        app.view('children', {key: doc._id}, function(error, data) {
            $(data.rows).each(function(i, row) {
                if (!row.value.completed) {
                    row.value.completed = true;
                    viewModel.save(row.value, nil);
                }
            })
        })
    }
    if (viewModel.parent._id) {
      var completed = true;
      var children = viewModel.children();
      for (var i = 0, length = children.length; i < length && completed; i++) {
        completed = children[i].completed();
      }
      viewModel.parent.completed(completed);
    }
}

function observable(doc) {
    var $save = function() {
      if (!doc.syncing) {
        viewModel.save(doc, nil);
      }
    }
    doc.name = ko.observable(doc.name);
    doc.name.subscribe($save);
    doc.completed = ko.observable(doc.completed);
    doc.completed.subscribe($save);
    doc.completed.subscribe(function(newValue) {
      if (!doc.syncing) {
        viewModel.complete(doc, newValue)
      }
    });
    doc.editing = ko.observable(false);
    doc.remove = function() {
      viewModel.remove(doc);
      viewModel.children.remove(doc);
    }
    doc.load = function() { 
      viewModel.read(this._id, doc.set);
    }
    doc.set = function(data) {
      doc._id = data._id;
      doc._rev = data._rev;
      doc.parent_id = data.parent_id;
      doc.syncing = true;
      if (typeof this.completed != 'function') {
        0 == 0;
      }
      doc.completed(data.completed);
      doc.name(data.name);
      delete doc['syncing'];      
    }
    
    return doc;
}

// check if change has any modification from outside,
// return false if not our change, true otherwize
function inChanges(change) {
  var myChange = myChanges[change.id];
  if (myChange) {
  	for (var i = 0, length = change.changes.length; i < length; i++ ) {
  	  var index = myChange.indexOf(change.changes[i].rev);
  	  console.log('index:', index);
  	  if (index == -1) {
  	    // clean up
  		  delete myChanges[change.id];
  		  // not our chnage
  			return false;
  	  } else {
  	    // clean up
  	    myChange.splice(index, 1);
  		}
		}
		// all change.revisions are ours
		if (myChange.length = 0) { // clean up
		  delete myChanges[change.id];
		}
		return true;
	}
  // not our change
  delete myChanges[change.id];
	return false;
}

/*
 * Handles any incoming real time changes from CouchDB, this will either
 * trigger a full page load if the design doc has changed, or update
 * the current list of tasks if needed
 */
function handleChanges() {

  $changes = app.changes();
  $changes.onChange(function(changes) {

    var doRefresh = false;

    $.each(changes.results, function(_, change) {

      // Full refresh if design doc changes
      doRefresh = doRefresh || /^_design/.test(change.id);

      // Otherwise check for changes that we didnt cause
      var changeIndex = $.inArray(change.id, myChanges);
      if (changeIndex == -1) {
        var index = -1, row;
        for (var i = 0, length = viewModel.children().length; i < length && index == -1; i++) {
          row = viewModel.children()[i];
          if (row._id == change.id) {
            index = i;
          }
        }
        if (change.deleted) {
          viewModel.children.splice(index, 1); // safe if index == -1
          // TODO: if change.id == viewModel.parent._id
        } else {
            if (index != -1)  {
              row.load();
            } else if (change.id == viewModel.parent._id) {
              viewModel.parent.load();
            } else {
              app.read(change.id, function(error, doc) {
                if (doc.parent_id == viewModel.parent._id) {
                  viewModel.parent.syncing = true;
                  viewModel.children.push(observable(doc));
                  delete viewModel.parent['syncing'];
                }
              })
            }
        }
      
      } else {
        myChanges.splice(changeIndex, 1);
        
      }
      

    });

    if (doRefresh) {
      document.location.reload();
    }

  });
}

var run = function() {
    ko.applyBindings(viewModel);
    $('footer').show();
    handleChanges();
    $(window).hashchange(function() {
        load(function() {
        })
    })
}

var load = function(callback) {
    var parent_id = window.location.hash.substring(2) || 'root'; // strip '#/'
    if (typeof viewModel.parent == 'undefined' || viewModel.parent._id != parent_id) {
        viewModel.reset();
        app.view('items', {startkey: [parent_id], endkey: [parent_id, 2]}, function(error, data) {
            if (!error && data.rows.length > 0) {
                $('div#not-found').hide();
                viewModel.parent.set(data.rows.shift().value);
                viewModel.parent.syncing = true;
                //var completed = viewModel.completed() || data.rows.length > 0;
                $(data.rows).each(function(i, row) {
                    //completed = completed && (row.value.completed || false);
                    viewModel.children.push(observable(row.value));
                })
                delete viewModel.parent['syncing'];
                //viewModel.completed(completed);
                callback();
            } else {
                $('div#not-found').show();
                callback();
            }
        })
    }
}

if (typeof $.sammy == 'function') {

    $(function () {
        app.s = $.sammy(function () {
            // Index of all databases
            this.get('#?/', function() {
                this.redirect("#/root")
                //viewModel.create('root', 'Li', function() {
                //})
            });
            this.get(/#\/[\w\d]+$/, function() {
                load(function() {
                })
            })
        })
        app.s.run();
        run();
    });

} else {
    load(run);
}

