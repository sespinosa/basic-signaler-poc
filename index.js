/**
 * 1.- Client connects to `/signal`.
 * 2.- Hub Lookup.
 * 3.- Pass the initial message (jwt auth)
 */
require('dotenv').config()
const express = require('express')
const morgan = require('morgan')

const PORT = process.env.PORT || 3000

const utils = require('./utils')

const app = express()


app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(morgan('dev'))

const workers = {}
const hubs = {}

const bearerMiddleware = persist => async (req, res, next) => {
  const { authorization } = req.headers
  if(!authorization) return res.status(401).end()
  const token = authorization.split(" ")[1] // We get everything after "Bearer " (space included).
  try {
    const payload = await utils.verify(token)
    req.hub = true
    req.user = payload
    if(persist) {
      hubs[payload.hub_id] = res
    }
  }
  catch(e) {
    // Invalid signature, it's a worker.
    const payload = utils.decode(token)
    req.user = payload
    if(persist) {
      workers[payload.id] = res
    }
    if(payload.hub_id && hubs[payload.hub_id]) {
      hubs[payload.hub_id].write(utils.serialize({ action: "worker-auth", token }))
    }
    else {
      return res.status(404).end()
    }
  }

  req.on('close', () => {
    if(req.hub) {
      return hubs[req.user.id] = undefined
    }
    workers[req.user.id] = undefined
  })

  next()
}

// POST
const handleMessage = async (req, res) => {
  const ev = req.body
  if(req.hub) {
    const { worker } = req.params
    if(workers[worker]) {
      return workers[worker].write(utils.serialize(ev))
    }
  }
  if(hubs[req.user.hub_id]) {
    return hubs[req.user.hub_id].write(utils.serialize(ev))
  }
  res.status(404).end()
}

// GET
const handleFeed = async (req, res) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  }
  res.writeHead(200, headers)
  setInterval(() => {
    res.write(utils.serialize({ ping: "pong", nonce: Math.random().toFixed(2) }))
  }, 1000)
}

// HEAD?
// Should check if it's a hub.
const handleDisconnect = async (req, res) => {
  const { worker } = req.params
  if(workers[worker]) {
    workers[worker].end()
  }
  res.end()
}

app.get("/api/signal", bearerMiddleware(true), handleFeed)
app.post("/api/signal", bearerMiddleware(), handleMessage)
app.post("/api/signal/:worker", bearerMiddleware(), handleMessage)
app.head('/api/disconnect/:worker', handleDisconnect)

app.listen(PORT, () => {
  console.log(`Signaler listening in port "${PORT}"`)
})