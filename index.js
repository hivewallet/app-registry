var git = require('git-node')
var basename = require('path').basename
var semver = require('semver-loose')

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
    if (err) throw err;
    console.log("Done: ", path);

    callback(repo)
  });
}

function listApps(repo) {
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

        links.forEach(function(repoUrl){
          fetch(repoUrl, getTags)
        })
      });
    })
  })
}

function getTags(repo) {
  repo.listRefs("refs/tags", function(error, refs){
    if(typeof refs !== "object") return;

    var versions = Object.keys(refs)
    if(versions.length === 0) return;

    var latestTag = versions.sort(semver.sort).reverse()[0]
    getManifest(repo, refs[latestTag])
  })
}

function getManifest(repo, sha) {
  search(repo, sha, "manifest.json")
}

function search(repo, sha, filename) {
  repo.treeWalk(sha, function(err, tree){
    tree.read(function(err, entry){
      console.log(entry)
      var file = entry.body.filter(function(n){
        return n.name === filename
      })[0]

      if(file === undefined) {
        entry.body.filter(function(node){
          return node.path.match(/\/$/)
        }).forEach(function(n){
          search(repo, n.hash, filename)
        })
      } else {
        repo.loadAs("blob", file.hash, function (err, blob) {
          console.log(blob.toString())
        })
      }
    })
  })
}

fetch("https://github.com/hivewallet/hive-osx.wiki.git", listApps)

