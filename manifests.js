var git = require('git-node')
var semver = require('semver-loose')
var basename = require('path').basename
var getDirName = require("path").dirname
var mkdirp = require("mkdirp")
var fs = require('fs')

module.exports = function(callback) {
  fetch("https://github.com/hivewallet/hive-osx.wiki.git", function(err, repo){
    if(err) return callback(err)
    listApps(repo, callback)
  })
}

function fetch(url, callback) {
  var remote = git.remote(url);
  var path = 'repos/' + basename(remote.pathname);
  var repo = git.repo(path);

  console.log("Cloning %s to %s", url, path);

  var opts = {
    onProgress: function (progress) {
      process.stderr.write(progress);
    },
    includeTag: true
  };

  repo.fetch(remote, opts, function(err){
    console.log("Done: ", path);
    callback(err, repo)
  });
}

function listApps(repo, callback) {
  repo.treeWalk("HEAD", function(err, tree){
    tree.read(function(err, entry){
      var registry = entry.body.filter(function(node){
        return node.name === 'App-Registry.md'
      })[0]

      repo.loadAs("blob", registry.hash, function (err, blob) {
        if (err) throw err;

        var links = extractLinks(blob.toString())
        var fetchRemaining = links.length
        var manifests = []
        links.forEach(function(repoUrl){
          fetch(repoUrl, function(err, repo) {
            if(err)  {
              return ignoreError(err, repoUrl)
            }

            getLatestTagRef(repo, function(err, ref){
              if(err) return ignoreError(err, repoUrl);

              parseManifest(repo, ref, function(err, manifest) {
                if(err) return ignoreError(err, repoUrl)

                if(manifest) {
                  manifests.push(manifest)
                  saveIcon(repo, ref, manifest.id, manifest.icon)
                }
                if(!--fetchRemaining) { callback(null, manifests) }
              })
            })
          })
        })

        function extractLinks(markdown) {
          var links = [];
          var regexp = /^[-|*|+]\s+\[(.*)\]\((.*)\)/gm;
          var match = regexp.exec(markdown)
          while (match != null) {
            links.push(match[2])
            match = regexp.exec(markdown)
          }
          return links;
        }

        function ignoreError(err, repoUrl){
          console.error("Error: ", repoUrl, err.stack)
          if(!--fetchRemaining) { callback(null, manifests) }
        }
      })
    })
  })
}

function getLatestTagRef(repo, callback) {
  repo.listRefs("refs/tags", function(err, refs){
    if(err) return callback(err);

    var versions = Object.keys(refs)
    if(versions.length === 0) {
      return callback(new Error("no tags found"));
    }

    var latestTag = versions.sort(semver.sort).reverse()[0]

    callback(null, refs[latestTag])
  })
}

function parseManifest(repo, sha, callback) {
  listFiles(repo, sha, function(err, entry){
    //ignore error
    if(err) return console.log("error listFile: ", err.stack);

    if(entry.name === 'manifest.json') {
      toJSON(entry.body.toString(), function(err, data) {
        if(err) return callback(err);

        callback(err, data)
        callback = function(){ console.warn("calling load callback multiple times!") }
      })
    }
  })
}

function saveIcon(repo, sha, destDir, srcPath) {
  listFiles(repo, sha, function(err, entry){
    //ignore error
    if(err) return console.log("error listFile: ", err.stack);

    //TODO: make me more robust
    var iconPathRegex = new RegExp(srcPath + '$')
    if(entry.path.match(iconPathRegex)) {
      writeFile('public/' + destDir + '/icon.png', entry.body, function (err) {
        //ignore error
        if (err) console.log("failed to save icon file for", destDir, err.stack);
      });
    }
  })
}

function listFiles(repo, sha, callback, done) {
  done = done || function(){}
  repo.treeWalk(sha, function (err, tree) {
    if (err) return callback(err);
    tree.read(onEntry);
    function onEntry(err, entry) {
      if (err) return callback(err);
      if (!entry) {
        return done()
      }
      callback(null, entry);
      return tree.read(onEntry);
    }
  });
}

function toJSON(data, callback){
  try{
    callback(null, JSON.parse(data))
  } catch (e) {
    callback(e)
  }
}

function writeFile (path, contents, callback) {
  mkdirp(getDirName(path), function (err) {
    if (err) return callback(err)
    fs.writeFile(path, contents, callback)
  })
}

