import { rateLimit } from 'express-rate-limit'
import nodeMorgan from 'densyy-node-toolbox/core/middlewares/node-morgan.js'
import nodeHelmet from 'densyy-node-toolbox/core/middlewares/node-helmet.js'

const urlEncodedOptions = { extended: false }

// Front em dev roda em 8800 (ver ~/.claude/rules/dev-servers.md). Em produção
// defina FRONTEND_URL com o domínio real — sem ela, só localhost funciona.
const ORIGENS_PERMITIDAS = new Set([process.env.FRONTEND_URL, 'http://localhost:8800'].filter(Boolean))

// Sem cookie/credential nesta API (auth é por header `x-access-token`), então
// CSRF clássico não se aplica — mas um allowlist explícito ainda é melhor que
// `*`: fecha reconhecimento anônimo e evita que uma mudança futura para auth
// por cookie destrave CSRF de verdade em silêncio.
const limiteGlobal = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
})

function init(app, express) {
  /*
   * A API roda atrás do Traefik (devops/server-general/backend/stack.yml), que
   * é o único salto até aqui. Sem isto `req.ip` devolve o IP do proxy — igual
   * para todo mundo — e o rate limit de login vira um balde GLOBAL: cinco
   * pessoas errando a senha bloqueavam o login de todos os usuários.
   *
   * O valor `1` confia em exatamente um proxy. Se um dia entrar Cloudflare (ou
   * outro salto) na frente do Traefik, este número precisa acompanhar, senão o
   * cliente passa a poder forjar o X-Forwarded-For e escapar do limite.
   */
  app.set('trust proxy', 1)

  app.use(limiteGlobal)

  app.use(express.json())
  app.use(express.urlencoded(urlEncodedOptions))
  /*
   * `sentry-trace` e `baggage` entram porque o `tracePropagationTargets` do
   * SDK faz o navegador injetá-los em toda chamada à API, para ligar o erro do
   * front ao trace do backend. Sem declará-los aqui o preflight recusa a
   * requisição INTEIRA.
   *
   * Único middleware de CORS do projeto — a toolbox tinha um `nodeCors`
   * próprio que rodava DEPOIS deste e sobrescrevia tudo de volta para `*` com
   * uma lista de headers mais curta (mesmo `res.setHeader`, mesma chave,
   * "quem escreve por último vence"). Foi removido: duas camadas de CORS
   * competindo é o tipo de coisa que gera "funciona local, quebra em prod"
   * quando alguém mexe só numa das duas.
   */
  app.use((req, res, next) => {
    const origin = req.headers.origin
    if (origin && ORIGENS_PERMITIDAS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-access-token, sentry-trace, baggage')
    if (req.method === 'OPTIONS') return res.sendStatus(200)
    return next()
  })

  app.use(nodeHelmet)

  if (process.env.MODE === 'test') return
  app.use(nodeMorgan)
}

export default { init }
