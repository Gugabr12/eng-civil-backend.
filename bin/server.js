import http from 'http'

/*
 * Lida DENTRO do listen, não no topo do módulo.
 *
 * Hoje funciona das duas formas: quem carrega o `.env` deste serviço é o
 * `instrument.mjs` (via `node --import`), que roda antes de qualquer módulo.
 * Mas isso é um detalhe do arranjo atual — no dia em que o Sentry sair ou o
 * boot mudar, uma constante no topo passaria a ser avaliada antes do dotenv e
 * o serviço subiria na porta padrão ignorando o `.env`, em silêncio.
 *
 * Foi exatamente o que aconteceu com api-web, api-admin, api-checkout,
 * api-contrato e api-upload, que não têm `instrument.mjs`.
 */
function portaInicial() {
  return Number(process.env.PORT) || 3005
}

// Quantas portas tentar a partir da inicial antes de desistir (ex: 3005..3014).
const MAX_TENTATIVAS = 10

function listen(app) {
  const PORT_INICIAL = portaInicial()
  const server = http.createServer(app)

  // Tenta a porta desejada; se estiver em uso, sobe na próxima livre.
  function tentar(porta, tentativa) {
    app.set('port', porta)
    server.listen(porta)
  }

  server.on('error', (error) => {
    if (error.syscall !== 'listen') throw error

    if (error.code === 'EACCES') {
      console.error(server.address()?.port || PORT_INICIAL, 'sem permissão')
      process.exit(1)
    }

    if (error.code === 'EADDRINUSE') {
      const portaAtual = Number(app.get('port'))
      const tentativa = portaAtual - PORT_INICIAL + 1

      if (tentativa < MAX_TENTATIVAS) {
        const proxima = portaAtual + 1
        console.warn(`Porta ${portaAtual} em uso, tentando ${proxima}...`)
        app.set('port', proxima)
        // pequeno atraso evita corrida com o socket que ainda está fechando
        setTimeout(() => server.listen(proxima), 150)
        return
      }

      console.error(`Nenhuma porta livre entre ${PORT_INICIAL} e ${PORT_INICIAL + MAX_TENTATIVAS - 1}`)
      process.exit(1)
    }

    throw error
  })

  server.on('listening', () => {
    const porta = server.address().port
    console.info('# Servidor Iniciado!')
    console.info('# Escutando na porta', porta, '...')
  })

  tentar(PORT_INICIAL, 1)
}

export default { listen }
