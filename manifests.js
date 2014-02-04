var git = require('git-node')
var basename = require('path').basename
var semver = require('semver-loose')
var fs = require('fs')

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
  // find App Registry
  repo.treeWalk("HEAD", function(err, tree){
    tree.read(function(err, entry){
      var registry = entry.body.filter(function(node){
        return node.name === 'App-Registry.md'
      })[0]
      repo.loadAs("blob", registry.hash, function (err, blob) {
        if (err) throw err;

        //match links in list
        var links = [];
        var regexp = /^[-|*|+]\s+\[(.*)\]\((.*)\)/gm;
        var match = regexp.exec(blob.toString())
        while (match != null) {
          links.push(match[2])
          match = regexp.exec(blob.toString())
        }

        var fetchRemaining = links.length
        var manifests = []
        links.forEach(function(repoUrl){
          fetch(repoUrl, function(err, repo) {
            if(err)  {
              // ignore error
              console.error("fetch error: ", repoUrl, err.stack)
              if(!--fetchRemaining) { callback() }
              return
            }

            getTags(repo, function(err, manifest){
              // ignore error
              if(err) console.error("getTags error: ", repoUrl, err.stack);

              if(manifest) manifests.push(manifest)
              if(!--fetchRemaining) { callback(null, manifests) }
            })
          })
        })
      })
    })
  })
}

function getTags(repo, callback) {
  repo.listRefs("refs/tags", function(err, refs){
    if(err) return callback(err);

    var versions = Object.keys(refs)
    if(versions.length === 0) return callback();

    var latestTag = versions.sort(semver.sort).reverse()[0]
    getManifest(repo, refs[latestTag], callback)
  })
}

function getManifest(repo, sha, callback) {
  search(repo, sha, "manifest.json", callback)
}

function search(repo, sha, filename, callback) {
  repo.treeWalk(sha, function(err, tree){
    if(err) return callback(err);

    tree.read(function(err, entry){
      if(err) return callback(err);

      var file = entry.body.filter(function(n){
        return n.name === filename
      })[0]

      if(file === undefined) {
        entry.body.filter(function(node){
          return node.path.match(/\/$/)
        }).forEach(function(n){
          search(repo, n.hash, filename, callback)
        })
      } else {
        repo.loadAs("blob", file.hash, function (err, blob) {
          if(err) return callback(err)

          toJSON(blob.toString(), function(err, data) {
            callback(err, data)
            callback = function(){ console.warn("calling load callback multiple times!") }
          })
        })
      }
    })
  })
}

function toJSON(data, callback){
  try{
    callback(null, JSON.parse(data))
  } catch (e) {
    callback(e)
  }
}

module.exports = function(callback) {
  fetch("https://github.com/hivewallet/hive-osx.wiki.git", function(err, repo){
    if(err) return callback(err)
    listApps(repo, callback)
  })
}

