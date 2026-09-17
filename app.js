import * as Sentry from '@sentry/node'
import express from 'express'
import configs from './configs/index.js'

/*
 * Monta o Express configurado, sem escutar porta nenhuma — quem faz isso é
 * `dev.js` (desenvolvimento local, `server.listen`) ou `index.js` (Cloud
 * Function, `onRequest`). Antes este arquivo também conectava o Mongoose e já
 * chamava `server.listen(app)` — isso não funciona dentro de uma Cloud
 * Function, onde o runtime é quem escuta a porta.
 */
export default function criarApp() {
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
