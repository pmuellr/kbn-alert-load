#!/usr/bin/env node

'use strict'

/** @typedef { import('./lib/types').CommandHandler } CommandHandler */

const logger = require('./lib/logger')
const { commands } = require('./lib/commands')
const { parseArgs } = require('./lib/parse_args')

module.exports = {
  main,
}

/** @type { Map<string, CommandHandler> } */
const CommandMap = new Map()
for (const command of commands) {
  CommandMap.set(command.name, command)
}

// @ts-ignore
if (require.main === module) main()

function main() {
  const { config, stack, minutes, command, commandArgs } = parseArgs()
  logger.debug(`cliArguments: ${JSON.stringify({ config, stack, command, commandArgs })}`)

  logger.debug(`using config: ${config}, stack: ${stack}`)

  const commandHandler = CommandMap.get(command || 'help')
  if (commandHandler == null) {
    logger.logErrorAndExit(`command not implemented: "${command}"`)
    return
  }
 
  try {
    commandHandler({ config, stack, minutes }, commandArgs)
  } catch (err) {
    logger.logErrorAndExit(`error runninng "${command} ${commandArgs.join(' ')}: ${err}`)
  }
}