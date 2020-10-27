'use strict'

const pkg = require('../package.json')

const DEBUG = process.env.DEBUG != null

module.exports = {
  debug,
  log,
  logErrorAndExit,
}

/** @type { (message: string) => void } */
function debug(message) {
  if (!DEBUG) return
  log(`DEBUG: ${message}`)
}

/** @type { (message: string) => void } */
function log(message) {
  console.log(`${pkg.name}: ${message}`)
}

/** @type { (message: string) => void } */
function logErrorAndExit(message) {
  log(message)
  process.exit(1)
}