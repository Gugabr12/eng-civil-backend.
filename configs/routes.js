import routeIndex from '../routes/index.js'
import routeError from '../routes/error.js'
import routeSaude from '../routes/saude.js'
import routeAutenticacao from '../routes/autenticacao.js'
import routeUsuarios from '../routes/usuarios.js'
import routeProdutos from '../routes/produtos.js'
import routeRelatorios from '../routes/relatorios.js'

function register(app) {
  app.use('/', routeIndex)

  // Saúde antes de tudo: rota pública, sem auth, consumida pelo Uptime Kuma.
  app.use('/', routeSaude)

  app.use('/autenticacao', routeAutenticacao)
  app.use('/usuarios', routeUsuarios)
  app.use('/produtos', routeProdutos)
  app.use('/relatorios', routeRelatorios)

  app.use('/', routeError)
}

export default { register }
