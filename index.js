"use strict"

var http = require('http')
var Manifests = require('./manifests.js')
var router = require('router')
var route = router()
var st = require('st')
var ua = require('universal-analytics')
var visitor = ua('UA-48397837-1')
require('newrelic')

route.get('/index.json', function(req, res) {
  res.setHeader('Content-Type', 'text/json')
  getManifests(function(err, manifests) {
    if(err) res.statusCode = 500, res.end(), console.error('error %s\n', err.message, err.stack)
    res.write(JSON.stringify(manifests))
    res.end()
  })
});

function getManifests(callback) {
  callback = callback || function() {}
  getManifests.queue = getManifests.queue || []

  if (getManifests.manifest && !getManifests.forceLoad) {
    return process.nextTick(function() {
      callback(null, getManifests.manifest)
    })
  }

  getManifests.queue.push(callback)
  if (getManifests.isLoading) return

  getManifests.isLoading = true

  Manifests(function(err, m) {
    if (err) return done(err, m)
    getManifests.manifest = m
    done(err, m)
  })

  function done(err, m) {
    getManifests.queue.forEach(function(cb) {
      cb(err, m)
    })
    getManifests.queue = []
    getManifests.isLoading = false

    setTimeout(function() {
      getManifests.forceLoad = true
      getManifests()
      getManifests.forceLoad = false
    }, 10 * 60 * 1000) // refresh index every 10 minutes
  }
}

getManifests()

var mount = st({
  path: __dirname + '/public',
  url: '/',
  passthrough: true,
  cache: {
    content: {
      max: 1024*1024*64,
      maxAge: 1000*60*10,
    }
  }
})
var server = http.createServer(function(req, res) {
  visitor.pageview(req.url).send()
  mount(req, res, function(){
    route(req, res)
  })
})
server.listen(process.env.PORT || 9009, function() {
  console.info('server listening on http://localhost:' + server.address().port)
})
