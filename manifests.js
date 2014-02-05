var git = require('git-node')
var basename = require('path').basename
var semver = require('semver-loose')

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
        blob = blob.toString()
        var match = regexp.exec(blob)
        while (match != null) {
          links.push(match[2])
          match = regexp.exec(blob)
        }

        var fetchRemaining = links.length
        var manifests = []
        links.forEach(function(repoUrl){
          fetch(repoUrl, function(err, repo) {
            if(err)  {
              return ignoreError(err, repoUrl)
            }

            getLatestTagRef(repo, function(err, ref){
              if(err) return ignoreError(err, repoUrl)

              parseManifest(repo, ref, function(err, manifest) {
                if(err) return ignoreError(err, repoUrl)

                if(manifest) manifests.push(manifest);
                if(!--fetchRemaining) { callback(null, manifests) }
              })
            })
          })
        })

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
  findFile(repo, sha, "manifest.json", function(err, blob){
    toJSON(blob.toString(), function(err, data) {
      if(err) return callback(err);

      callback(err, data)
      callback = function(){ console.warn("calling load callback multiple times!") }
    })
  })
}

function findFile(repo, sha, filename, callback) {
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
          findFile(repo, n.hash, filename, callback)
        })
      } else {
        repo.loadAs("blob", file.hash, callback)
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

