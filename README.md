Collaborative notes LIst, see http://li.iriscouch.com for demo.

It is a pure [Couch Application](http://couchapp.org/) backed by [CouchDB](http://couchdb.apache.org/) and built entirely in JavaScript, using [Knockout JS](http://knockoutjs.com/). It's also using [TinyEditor](http://www.scriptiny.com/2010/02/javascript-wysiwyg-editor/). It's running on [Iris Couch](http://www.iriscouch.com/) - easy cloud CouchDB.

It was originally created as Todo-List based on [Thingler](http://thingler.com/) (still available in a [branch](https://github.com/avalez/li.couch/tree/todo-list)), but later transformed into non linear notes application, inspired by [Tiddly Wiki](http://www.tiddlywiki.com/) and instigated to appear initially by Google decommissioning its [Notebook](http://notebook.google.com).

To run it yourself, push it into you couchdb, e.g:

   $ node_modules/couchapp/bin.js push app.js http://your.iriscouch.com/db
   
And open it in your browser, e.g.: http://your.iriscouch.com/db/_design/app/index.html or http://your.iriscouch.com, if you enabled rewrites.
