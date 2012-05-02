var couchapp = require('couchapp')
  , path = require('path')
  ;

ddoc = 
  { _id:'_design/app'
  , rewrites : 
    [ {from:"/", to:'index.html'}
    , {from:"/#/*", to:'index.html'}
    , {from:"/api", to:'../../'}
    , {from:"/api/*", to:'../../*'}
//    , {from:"_uuids", to:'../../../_uuids'}
    , {from:"/*", to:'*'}
    ]
  }
  ;

ddoc.views = {
  note : {
    map : function(doc) {
      if (doc.type == 'note') {
        emit([doc._id, 0])
      } else /* section */ {
        emit([doc.parent_id, doc.order])
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
        if (doc.type == 'note') {
          id = doc._id
        } else {
          id = doc.parent_id
        }
        emit([i], {note_id: id, text: doc.name, count: tokens[i]})
      }
    },
    // reduce to one document (sum sections of a document)
    /*
    reduce : function(keys, values, rereduce) {
      var res = {};
      for (var i in values) {
        var entry = res[values[i].note_id] || {};
        entry.count = values[i].count + (entry.count || 0);
        var texts = entry.texts || [];
        texts.push({text: values[i].text, id: keys[i][1]});
        entry.texts = texts;
        res[values[i].note_id] = entry;
      }
      return res;
    }*/
  }
};

ddoc.validate_doc_update = function (newDoc, oldDoc, userCtx) {   
  if (newDoc._deleted === true && userCtx.roles.indexOf('_admin') === -1) {
    throw "Only admin can delete documents on this database.";
  } 
  if (newDoc._deleted === true &&  ['root', '3133f02202895dab5d84c9ab8c000cdd'].indexOf(newDoc._id) !== -1) {
    //throw "It's not allowed to delete this element.";
  } 
}

couchapp.loadAttachments(ddoc, path.join(__dirname, 'attachments'));

module.exports = ddoc;

