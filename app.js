var couchapp = require('couchapp')
  , path = require('path')
  ;

ddoc = 
  { _id:'_design/app'
  , rewrites : 
    [ {from:"/", to:'index.html'}
    , {from:"/#/*", to:'index.html'}
    , {from:"/api", to:'../../'}
    , {from:"/api/_all_docs", to:'dummy'}
    , {from:"/api/*", to:'../../*'}
//    , {from:"_uuids", to:'../../../_uuids'}
//    , {from:"/_view/*", to:'dummy'}
    , {from:"/*", to:'*'}
    ]
  }
  ;

ddoc.views = {
  note : {
    map : function(doc) {
      if (doc.type == 'note') {
        emit([doc._id, 0], doc)
      } else /* section */ {
        emit([doc.parent_id, doc.order], doc)
      }
    }
  },
  childnotes : {
    map : function(doc) {
      if (doc.type == 'note') {
        emit(doc.parent_id, doc.name)
      }
    }
  },
  children : {
    map : function(doc) {
        emit(doc.parent_id, {rev: doc._rev, type: doc.type})
    }
  },
  search : {
    map : function(doc) {
      // http://sitr.us/2009/06/30/database-queries-the-couchdb-way.html
      Array.prototype.reduce = function(val, func) {
          var i;
          for (i = 0; i < this.length; i += 1) {
              val = func(val, this[i]);
          }
          return val;
      };
      // count unique words per doc (relevance)
      var tokens = doc.name.split(/[^A-Z0-9\-_]+/i).reduce({}, function(val, el) {
        var count = val[el] || 0;
        count++
        val[el] = count;
        return val;
      });
      for (var i in tokens) {
        var id;
        if (doc.type == 'section') {
          // emit note
          emit([i, doc.parent_id, 0, 0], {_id: doc.parent_id})
          id = doc.parent_id;
        } else {
          id = doc._id;
        }
        emit([i, id, doc.order, tokens[i]], {_id: doc._id})
      }
    },
  }
};

ddoc.validate_doc_update = function (newDoc, oldDoc, userCtx) {   
  if (newDoc._deleted === true && userCtx.roles.indexOf('_admin') === -1) {
    throw "Only admin can delete documents on this database.";
  } 
  if (newDoc._deleted === true &&  ['root', '3792703880258a53d599789308001457'].indexOf(newDoc._id) !== -1) {
    throw "It's not allowed to delete this element.";
  } 
};

ddoc.lists = {
  authenticated : function(head, req) {
    var row;
    send('{"rows":[' + "\n");
    if (req.userCtx.name) {
      if (row = getRow()) {
        send(JSON.stringify(row))
      }
      while (row = getRow()) {
        send(",\n" + JSON.stringify(row))
      }
    }
    send("\n]}");
  },
};

couchapp.loadAttachments(ddoc, path.join(__dirname, 'attachments'));

module.exports = ddoc;

