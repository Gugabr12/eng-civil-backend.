import * as Sentry from '@sentry/node'
import express from 'express'
import configs from './configs/index.js'

/*
 * Sem isso, faltar `BCRYPT_KEY` não dá erro nenhum — o pepper vira a string
 * literal "undefined" e todo hash de senha sai sem a camada extra, em
 * silêncio (achado ENG-007 da revisão de segurança). Falha visível no boot é
 * sempre melhor que um sistema "funcionando" com a proteção furada.
 */
function validarVariaveisObrigatorias() {
  const obrigatorias = ['BCRYPT_KEY', 'TOKEN_USUARIO', 'FIREBASE_PROJECT_ID']
  if (!process.env.FIRESTORE_EMULATOR_HOST) obrigatorias.push('FIREBASE_SERVICE_ACCOUNT_JSON')

  const faltando = obrigatorias.filter((chave) => !process.env[chave])
  if (faltando.length > 0) {
    console.error(`Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}`)
    process.exit(1)
  }
}

/*
 * Monta o Express configurado, sem escutar porta nenhuma — quem faz isso é
 * `index.js` (`server.listen`, tanto local quanto no Render).
 */
export default function criarApp() {
  validarVariaveisObrigatorias()

  const app = express()

  configs.middlewares.init(app, express)
  configs.routes.register(app)

  /*
   * Error handler do Sentry — DEPOIS das rotas, ANTES de qualquer outro.
   *
   * Error middlewares do Express (os de 4 argumentos) rodam na ordem de registro.
   * O `routeError` já respondeu 404 para rota inexistente, e o `configError` dos
   * controllers responde antes de propagar — este handler pega o que escapou dos
   * dois: exceção não tratada dentro de uma rota.
   *
   * 4xx não é reportado: validação, não autorizado e não encontrado são o
   * sistema funcionando. Reportá-los enche o painel e faz a ferramenta ser
   * ignorada em uma semana.
   */
  Sentry.setupExpressErrorHandler(app, {
    shouldHandleError(error) {
      const status = error.status || error.statusCode
      return !status || status >= 500
    }
  })

  return app
}
