'use strict'

module.exports = {
  splitX,
  delay,
  resolveable,
  sortById,
  shortDateString,
}

/** @type { (spec: string) => [number, number]} */
function splitX(spec) {
  const match = spec.match(/^(\d+)x(\d+)$/)
  if (match == null) return null
  const n1 = parseInt(match[1])
  const n2 = parseInt(match[2])
  return [n1, n2]
}

/** @type { (ms: number) => Promise<void> } */
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** @type { () => { promise: Promise<any>; resolve: (value: any) => void; reject: (reason: any) => void } } */
function resolveable() {
  let resolve, reject
  const promise = new Promise((r, e) => { resolve = r; reject = e })

  return { promise, resolve, reject }
}

/** @type { (a: { id: string }, b: { id: string }) => number } */
function sortById(a, b) {
  return a.id.localeCompare(b.id)
}

/** @type { (date: Date) => string } */
function shortDateString(date) {
  return date.toISOString()
    .substr(5,14)      // mm-ddThh:mm:ss
    .replace(/-/g,'')  // mmddThh:mm:ss
    .replace(/:/g,'')  // mmddThhmmss
    .replace('T','-')  // mmdd-hhmmss

}
