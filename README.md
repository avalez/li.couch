Collaborative notes LIst, see http://li.iriscouch.com for demo.

It is a pure [http://couchapp.org/](Couch Application) backed by [http://couchdb.apache.org/](CouchDB) and built entirely in JavaScript, using [http://knockoutjs.com/](Knockout JS). It's also using [http://www.scriptiny.com/2010/02/javascript-wysiwyg-editor/](TinyEditor). It's running on [http://www.iriscouch.com/](Iris Couch) - easy cloud CouchDB.

It was originally created as Todo-List based on [http://thingler.com/](Thingler) (still available in a [https://github.com/avalez/li.couch/tree/todo-list](branch)), but later transformed into non linear notes application, inspired by [http://www.tiddlywiki.com/](Tiddly Wiki) and instigated to appear initially by Google decommissioning its [http://notebook.google.com](Notebook).

To run it yourself, push it into you couchdb, e.g:

   $ node_modules/couchapp/bin.js push app.js http://your.iriscouch.com/db
   
And open it in your browser, e.g.: http://your.iriscouch.com/db/_design/app/index.html or http://your.iriscouch.com, if you enabled rewrites.
