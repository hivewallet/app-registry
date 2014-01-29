var git = require('git-node');
var basename = require('path').basename;

function fetch(url, callback) {
  var remote = git.remote(url);
  var path = 'repos/' + basename(remote.pathname);
  var repo = git.repo(path);

  console.log("Cloning %s to %s", url, path);

  var opts = {
    onProgress: function (progress) {
      process.stderr.write(progress);
    }
  };

  if (process.env.DEPTH) {
    opts.depth = parseInt(process.env.DEPTH, 10);
  }

  repo.fetch(remote, opts, function(err){
    if (err) throw err;
    console.log("Done");

    listApps(repo)
  });
}

function listApps(repo) {
  // find App Registry
  repo.treeWalk("HEAD", function(err, tree){
    tree.read(function(err, entry){
      var registry = entry.body.filter(function(node){ return node.name == 'App-Registry.md' })[0]
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

      console.log(links)
    });
    })
  })
}

fetch("https://github.com/hivewallet/hive-osx.wiki.git")

