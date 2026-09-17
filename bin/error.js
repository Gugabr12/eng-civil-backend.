import * as Sentry from '@sentry/node'
import NodeLogger from 'densyy-node-toolbox/core/utils/node-logger.js'

const nodeLogger = new NodeLogger()

function handle() {
  unhandledRejection()
  uncaughtException()
  warning()
}

/*
 * Estes dois handlers existiam antes do Sentry e apenas LOGAVAM.
 *
 * O log fica no stdout do container: some no próximo deploy e ninguém lê às
 * 3h da manhã. Uma promise rejeitada num cron, por exemplo, era registrada e
 * esquecida. O `captureException` mantém o log (útil no `docker logs`) e
 * garante que a falha chegue a alguém.
 *
 * `mechanism.handled: false` marca o evento como crash não tratado — é o que
 * faz o Sentry priorizá-lo acima de um erro de rota comum.
 */
function unhandledRejection() {
  process.on('unhandledRejection', (error) => {
    let content = '🚨 Unhandled Rejection:\n'
    content += `error: ${error?.message}\n`
    content += `stack: ${error?.stack}\n`
    nodeLogger.log(content)

    Sentry.captureException(error, { mechanism: { type: 'unhandledRejection', handled: false } })
  })
}

function uncaughtException() {
  process.on('uncaughtException', (error) => {
    let content = '🚨 Uncaught Exception:\n'
    content += `error: ${error?.message}\n`
    content += `stack: ${error?.stack}\n`
    nodeLogger.log(content)

    Sentry.captureException(error, { mechanism: { type: 'uncaughtException', handled: false } })
  })
}

function warning() {
  process.on('warning', (warning) => {
    let content = '⚠️ Warning:\n'
    content += `name: ${warning.name}\n`
    content += `message: ${warning.message}\n`
    content += `stack: ${warning.stack}\n`
    nodeLogger.log(content)
  })
}

export default { handle }
