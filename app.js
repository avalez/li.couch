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
    map : function(doc){
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
        emit(doc.parent_id, doc._rev)
    }
  }
};

ddoc.validate_doc_update = function (newDoc, oldDoc, userCtx) {   
  if (newDoc._deleted === true && userCtx.roles.indexOf('_admin') === -1) {
    throw "Only admin can delete documents on this database.";
  } 
}

couchapp.loadAttachments(ddoc, path.join(__dirname, 'attachments'));

module.exports = ddoc;