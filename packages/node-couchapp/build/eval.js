// this is because some require paths changed in the npm-compatible version
// of kanso, we want this package to support older installs too
var tryRequire = function (a, b) {
    try {
        return require(a);
    }
    catch (e) {
        // throw if this one fails
        return require(b);
    }
};

var couchapp = require('couchapp');

var mimetypes = tryRequire('mime', 'node-mime/mime'),
    watch = require('watch'),
    path = require('path'),
    utils = require('kanso-utils/utils'),
    async = require('async'),
    fs = require('fs');


var merge = function (a, b, /*optional*/path) {
    a = a || {};
    b = b || {};
    path = path || [];

    for (var k in b) {
        if (typeof b[k] === 'object' && !Array.isArray(b[k])) {
            a[k] = merge(a[k], b[k], path.concat([k]));
        }
        else {
            if (a[k] && a[k] !== b[k]) {
                throw new Error(
                    'Conflicting property at: ' + path.concat([k]).join('.') +
                    '\nBetween: ' +
                    //exports.maxlen(JSON.stringify(a[k]), 30) + ' and ' +
                    //exports.maxlen(JSON.stringify(b[k]), 30)
                    JSON.stringify(a[k]) + ' and ' + JSON.stringify(b[k])
                );
            }
            a[k] = b[k];
        }
    }
    return a;
};


var selective_design_merge = function(last_doc, next_doc, options) {

    // the ususal suspects
    var properties = ["views", "lists", "shows", "filters"];
    for (var i in properties) {
        var prop = properties[i];
        next_doc[prop] = merge(last_doc[prop], next_doc[prop]);
    }

    if (options && options["merge-rewrites"] && last_doc.rewrites && last_doc.rewrites) {
        if (!next_doc.rewrites) next_doc.rewrites = [];
        next_doc.rewrites = last_doc.rewrites.concat(next_doc.rewrites);
    }
    return next_doc;
}

module.exports = {
    before : "attachments",
    run : function (root, kanso_path, settings, doc, callback) {
        if (settings.app) {
            try {

                var require_path = utils.abspath(settings.app, kanso_path);
                var mod = require(require_path);
                doc = selective_design_merge(doc, mod, settings["node-couchapp"]);

                if (!settings.attachments) settings.attachments = [];
                var folders = mod.__attachments;
                delete mod.__attachments;


                addAttachments(doc, folders, function (err, doc) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, doc);
                });
            }
            catch (e) {
                return callback(e);
            }
        }
        else {
            callback(null, doc);
        }
    }
}


function addAttachments(doc, folders, callback) {
    if (!folders || ! folders.length) {
        return callback(null, doc);
    }

    if (!doc._attachments) doc._attachments = {};

    // adapted from node.couchapp.js/main.js
    folders.forEach(function (att) {
        watch.walk(att.root, {ignoreDotFiles:true}, function (err, files) {
            if (err) {
                return callback(err);
            }
            var keys = Object.keys(files);
            if (!keys.length) {
                return callback(null, app);
            }
            async.forEach(keys, function (f, cb) {
                fs.readFile(f, function (err, data) {
                    if (err) {
                        return cb();
                    }
                    f = f.replace(att.root, att.prefix || '');
                    if (f[0] === '/') {
                        f = f.slice(1);
                    }
                    var d = data.toString('base64');
                    var mime = mimetypes.lookup(path.extname(f).slice(1));
                    doc._attachments[f] = {data: d, content_type: mime};
                    cb();
                })
            },
            function (err) {
                callback(err, doc);
            });
        })
    })
};
