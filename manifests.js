var git = require('git-node')
var semver = require('semver-loose')
var basename = require('path').basename
var getDirName = require("path").dirname
var mkdirp = require("mkdirp")
var fs = require('fs')
var archiver = require('archiver')

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
                  var errorWritingFile = null;
                  writeRepoToFile(manifest.id, repo, ref, function(err){
                    errorWritingFile = err
                  }, function(){
                    if(errorWritingFile) return;
                    packageRepo(manifest.id)
                  })
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

        function packageRepo(dirname){
          console.log("packaging", dirname)
          var output = fs.createWriteStream('public/' + dirname + '.hiveapp');
          var archive = archiver('zip');

          output.on('close', function() {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
          });

          archive.on('error', function(err) {
            throw err;
          });

          archive.pipe(output);

          archive.bulk([
            { expand: true, cwd: 'public/' + dirname, src: ['**/*'] }
          ]).finalize();
        }
      })
    })
  })
}

function getLatestTagRef(repo, callback) {
  var prefix = "refs/tags"
  repo.listRefs(prefix, function(err, refs){
    if(err) return callback(err);

    var versions = Object.keys(refs)
    if(versions.length === 0) {
      return callback(new Error("no tags found"));
    }

    var latestTag = versions.sort(function(a, b) {
      return semver.sort(a.replace(prefix + '/', ''), b.replace(prefix + '/', ''))
    }).reverse()[0]
    console.log("checking out tag", latestTag)

    callback(null, refs[latestTag])
  })
}

function parseManifest(repo, sha, callback) {
  listFiles(repo, sha, function(err, entry){
    if(err) return callback(err);

    if(entry.name === 'manifest.json') {
      console.log("============> ", entry.path)
      toJSON(entry.body.toString(), function(err, data) {
        if(err) return callback(err);

        callback(err, data)
        callback = function(){ console.warn("calling load callback multiple times!") }
      })
    }
  })
}

function writeRepoToFile(dirname, repo, sha, callback, done) {
  listFiles(repo, sha, function(err, entry){
    if(err) return callback(err);

    writeEntryToFile(dirname, entry, callback)
  }, done)
}

function writeEntryToFile(dirname, entry, callback) {
  if(entry.type === 'blob') {
    writeFile('public/' + dirname + entry.path, entry.body, function (err) {
      if (err) {
        console.log("failed to save file ", entry.path, 'to', dirname, err.stack);
        return callback(err)
      }
    });
  }
}

function listFiles(repo, sha, callback, done) {
  done = done || function(){}

  repo.load(sha, function(err, entry){
    if (err) return callback(err);

    var treeRef = sha
    if(entry.type === 'tag') {
      treeRef = entry.body.object
    }

    repo.treeWalk(treeRef, function (err, tree) {
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
  })
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

