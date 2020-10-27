'use strict'

/** @typedef { import('./types').CliArguments } CliArguments */

const meow = require('meow')

const pkg = require('../package.json')
const logger = require('./logger')

module.exports = {
  parseArgs,
}

/** @type { () => CliArguments } */
function parseArgs() {
  const { input, flags } = meow({
    pkg,
    help,
    flags: {
      config: { alias: 'C', type: 'string' },
    }
  })

  const config = flags.config

  const [command, ...commandArgs] = input
  return {
    command,
    commandArgs,
    config
  }
}

const help = `
usage: ${pkg.name} <options> <cmd> <arguments>

options:
  -C --config        use the specified ecctl config in $HOME/.ecctl/[name].json

commands:
  run <scenario>     run specified scenario
  ls-scenarios       list scenarios
  ls-deployments     list deployments
  rm-deployments     rm deployments of a given time
`