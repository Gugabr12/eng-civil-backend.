import * as Sentry from '@sentry/node'
import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import NodeLogger from 'densyy-node-toolbox/core/utils/node-logger.js'

const nodeResponse = new NodeResponse()
const nodeLogger = new NodeLogger()

function capture(res, error) {
  nodeLogger.log(error)

  // Erro de negócio vindo de um serviço externo (4xx): a recusa tem um motivo
  // específico. Repassamos a descrição real para o front em vez de mascarar
  // com 500.
  if (error?.status >= 400 && error?.status < 500) {
    const motivo = error?.data?.errors?.[0]?.description || error?.message
    if (motivo) {
      return nodeResponse.simpleError(res, error.status, motivo)
    }
  }

  // Chegou aqui = exceção não classificada (bug real, não erro de negócio).
  // Sem isto o 500 vira apenas log no stdout e nunca aparece no Sentry.
  Sentry.captureException(error)

  return nodeResponse.serverError(res)
}

export default { capture }
