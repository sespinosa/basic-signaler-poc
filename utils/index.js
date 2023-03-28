const JWT = require('jsonwebtoken')

const {
  SECRET
} = process.env

const decode = token => JWT.decode(token)

const verify = token => new Promise((resolve, reject) => {
  JWT.verify(token, SECRET, (err, decoded) => {
    if(err) return reject(err)
    resolve(decoded)
  })
})

const serialize = payload => `data: ${JSON.stringify(payload)}\n\n`

module.exports = {
  decode,
  verify,
  serialize
}