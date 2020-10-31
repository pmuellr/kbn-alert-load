'use strict'

const DEBUG = process.env.DEBUG != null

module.exports = {
  debug,
  log,
  logErrorAndExit,
  printTime,
}

let PrintTime = false

/** @type { (enable?: boolean) => boolean } */
function printTime(enable) {
  if (enable !== null) {
    PrintTime = enable
  }
  return PrintTime
}

/** @type { (message: string) => void } */
function debug(message) {
  if (!DEBUG) return
  log(`DEBUG: ${message}`)
}

/** @type { (message: string) => void } */
function log(message) {
  if (!PrintTime) return console.log(message)
  
  const time = new Date().toISOString().substr(11,8)
  console.log(`${time} - ${message}`)
}

/** @type { (message: string) => void } */
function logErrorAndExit(message) {
  log(message)
  process.exit(1)
}