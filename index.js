var http = require('http')
var Manifests = require('./manifests.js')
var EventEmitter = require('events').EventEmitter

var manifests = ''

var server = http.createServer(function(req, res) {
  if (!req.url.match(/index\.json$/)) {
    res.statusCode = 404
    return res.end()
  }

  res.setHeader('Content-Type', 'text/json')

  if (!manifests) return loadManifests(res)

  writeResponse(res)
})

var manifestReady = new EventEmitter()

function loadManifests(res) {
  if (loadManifests.isLoading) {
    return manifestReady.once('ready', function() {
      writeResponse(res)
    })
  }

  loadManifests.isLoading = true

  Manifests(function(err, m) {
    if (err) return console.error('manifest error: %s \n', err.message, err.stack)

    manifests = m
    loadManifests.isLoading = false
    manifestReady.emit('ready')

    writeResponse(res)
  })
}

function writeResponse(res) {
  res.write(JSON.stringify(manifests))
  res.end()
}

server.listen(9009)
