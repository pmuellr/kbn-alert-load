'use strict'

/** @typedef { import('./lib/types').Scenario } Scenario */

/** @type { Array<Scenario> } */
module.exports = [
  scenarioA(100),
  scenarioA(200),
  scenarioA(300),
  scenarioA(400),
]

/** @type { (alerts: number) => Scenario } */
function scenarioA(alerts) {
  return {
    id: `A-${alerts}`,
    minutes: 10,
    deployments: [
      { es: '1x1', kb: '1x1' },
      { es: '1x4', kb: '1x4' },
      { es: '1x8', kb: '2x8' },
      { es: '1x8', kb: '4x8' },
    ],
    alerts: alerts
  }
}
