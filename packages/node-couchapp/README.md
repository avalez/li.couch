## node.couchapp.js support

This kanso package lets you build couchapps in the [node.couchapp.js](https://github.com/mikeal/node.couchapp.js) style of project.

## Install

Add to your project's kanso.json dependencies setting, here is the minimal
case:

```json
{
    "app": "app",
    "dependencies": {
        "node-couchapp": null
    }
}
```

Notice the app property. The value is 'app' which means look for a file called 'app.js'.

Run kanso install to install in your packages directory:

```
kanso install
```


## app.js example:

<pre>
  var couchapp = require('couchapp')
    , path = require('path');

  ddoc = {
      _id: '_design/app'
    , views: {}
    , lists: {}
    , shows: {}
  }

  module.exports = ddoc;

  ddoc.views.byType = {
    map: function(doc) {
      emit(doc.type, null);
    },
    reduce: '_count'
  }

  ddoc.views.peopleByName = {
    map: function(doc) {
      if(doc.type == 'person') {
        emit(doc.name, null);
      }
    }
  }

  ddoc.lists.people = function(head, req) {
    start({
      headers: {"Content-type": "text/html"}
    });
    send("&lt;ul id='people'>\n");
    while(row = getRow()) {
      doc = row.doc;
      send("\t&lt;li class='person name'>" + doc.name + "&lt;/li>\n");
    }
    send("&lt;/ul>\n")
  }

  ddoc.shows.person = function(doc, req) {
    return {
      headers: {"Content-type": "text/html"},
      body: "&lt;h1 id='person' class='name'>" + doc.name + "&lt;/h1>\n"
    }
  }

  couchapp.loadAttachments(ddoc, path.join(__dirname, '_attachments'));
</pre>


## Options

If you are including a node.couchapp.js style project into another kanso app, the design docs will get merged.
The exception is 'rewrites'. This can't be merged very well, so there is an option to prepend the included rewrites. Here is how:

```json
{
    "app": "app",
    "node-couchapp" : {
        "merge-rewrites" : true
    },
    "dependencies": {
        "node-couchapp": null
    }
}
```

## To run the tests for this package do the following, using a db name that works for you:

```
./test/run_headless_tests.sh http://localhost:5984/node-couch-test
```


