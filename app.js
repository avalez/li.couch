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
  items : {
      map : function(doc){
          emit([doc._id, 0], doc);
          emit([doc.parent_id, 1], doc);
      }
  },
  children : {
    map : function(doc){ emit(doc.parent_id, doc)}
  }
};

ddoc.validate_doc_update = function (newDoc, oldDoc, userCtx) {   
  if (newDoc._deleted === true && userCtx.roles.indexOf('_admin') === -1) {
    throw "Only admin can delete documents on this database.";
  } 
}

couchapp.loadAttachments(ddoc, path.join(__dirname, 'attachments'));

module.exports = ddoc;