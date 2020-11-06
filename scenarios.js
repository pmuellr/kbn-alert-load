'use strict'

/** @typedef { import('./lib/types').Scenario } Scenario */

/** @type { Array<Scenario> } */
module.exports = [
  scenarioJustAlerts(100),
  scenarioJustAlerts(200),
  scenarioJustAlerts(300),
  scenarioJustAlerts(400),
  scenarioJustAlerts(500),
  scenarioJustAlerts(1000),
  scenarioJustAlerts(2000),
  scenarioJustAlerts(4000),
]

/** @type { (alerts: number) => Scenario } */
function scenarioJustAlerts(alerts) {
  return {
    id: `JustAlerts-${alerts}`,
    minutes: 5,
    deployments: [
      { es: '1x1', kb: '1x1' },
      { es: '1x8', kb: '2x8' },
      { es: '1x8', kb: '4x8' },
      { es: '1x15', kb: '8x8' },
    ],
    alerts: alerts
  }
}
