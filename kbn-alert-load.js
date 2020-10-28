#!/usr/bin/env node

'use strict'

/** @typedef { import('./lib/types').CommandHandler } CommandHandler */

const logger = require('./lib/logger')
const commands = require('./lib/commands')
const { parseArgs } = require('./lib/parse_args')

module.exports = {
  main,
}

/** @type { Map<string, CommandHandler> } */
const CommandMap = new Map()
CommandMap.set('run', commands.run)
CommandMap.set('help', commands.help)

// @ts-ignore
if (require.main === module) main()

function main() {
  const { config, command, commandArgs } = parseArgs()
  logger.debug(`cliArguments: ${JSON.stringify({ config, command, commandArgs })}`)

  logger.debug(`using config: ${config}`)

  const commandHandler = CommandMap.get(command || 'help')
  if (commandHandler == null) {
    logger.logErrorAndExit(`command not implemented: "${command}"`)
    return
  }
 
  try {
    commandHandler(config, commandArgs)
  } catch (err) {
    logger.logErrorAndExit(`error runninng "${command} ${commandArgs.join(' ')}: ${err}`)
  }
}