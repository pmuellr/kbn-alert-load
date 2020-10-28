'use strict'

/** @typedef { import('./types').CliArguments } CliArguments */

const meow = require('meow')

const pkg = require('../package.json')
const logger = require('./logger')

const ENV_CONFIG_NAME = `${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG`
const ENV_CONFIG = process.env[ENV_CONFIG_NAME]

const help = getHelp()

module.exports = {
  parseArgs,
  help,
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

  const config = flags.config || ENV_CONFIG || 'config'

  const [command, ...commandArgs] = input
  return {
    command,
    commandArgs,
    config
  }
}

function getHelp () {
  return`
${pkg.name}: ${pkg.description}
v${pkg.version}

usage: ${pkg.name} <options> <cmd> <arguments>

options:
  -C --config        use the specified ecctl config in $HOME/.ecctl/[name].json

commands:
  run <scenario> <machines>     run scenario on machines
  info                          list scenarios and machines

You may also use the environment variable ${ENV_CONFIG_NAME} as the value of
the config option.
`.trim()
}