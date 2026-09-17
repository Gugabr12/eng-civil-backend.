/*
 * Inicialização do Sentry — precisa rodar ANTES de qualquer outro módulo.
 *
 * O SDK v8+ instrumenta por monkey-patching (OpenTelemetry): ele envelopa os
 * métodos do Express, do Mongoose e do http no momento em que são carregados.
 * Se o Express já estiver em cache do módulo quando o `init()` rodar, não há o
 * que envelopar — os erros ainda chegam, mas sem nome de rota, sem spans e com
 * agrupamento ruim.
 *
 * Como o projeto é ESM e `import` é hoisted (o JS move todos os imports para o
 * topo antes de executar qualquer linha), colocar `import './instrument.mjs'`
 * na primeira linha do app.js NÃO garante a ordem. Por isso a carga é pela
 * flag do Node:
 *
 *   node --import ./instrument.mjs app.js
 *
 * Isso está em `package.json` (dev/prod) e no `docker/Dockerfile`. Os três
 * lugares precisam concordar — esquecer um é a falha mais comum.
 *
 * Sem `SENTRY_DSN` definido o init é pulado: em desenvolvimento ninguém quer
 * mandar erro de teste para o painel, e o serviço precisa subir igual.
 */

/*
 * `dotenv` PRIMEIRO, aqui dentro.
 *
 * Este arquivo é carregado via `node --import`, ou seja, antes do `app.js` —
 * que é onde o dotenv era chamado até agora. Sem carregar o `.env` aqui,
 * `process.env.SENTRY_DSN` chega vazio, o `init()` é pulado e o SDK fica sem
 * client: os eventos são criados e descartados em silêncio.
 *
 * Em produção as variáveis vêm do ambiente do container e o dotenv não acha
 * `.env` nenhum — o `config()` simplesmente não faz nada, sem erro.
 */
import dotenv from 'dotenv'
import * as Sentry from '@sentry/node'

/*
 * `config()` fora de import: em ESM os imports são hoisted e executam antes de
 * qualquer statement, então a ordem no arquivo não garante nada. O que importa
 * é que esta linha rode antes do `Sentry.init()` lá embaixo — e roda, porque
 * statements executam na ordem escrita.
 */
dotenv.config()

/*
 * Campos que NUNCA podem sair daqui.
 *
 * Levantados do que este projeto realmente manipula: documento do titular,
 * o código OTP que autoriza assinatura de contrato, e os segredos de
 * integração (webhooks, provedores de e-mail e WhatsApp).
 */
const CAMPOS_SENSIVEIS = Object.freeze([
  'cpfCnpj',
  'cpf',
  'cnpj',
  'cartao',
  'card',
  'creditCard',
  'numeroCartao',
  'cvv',
  'ccv',
  'senha',
  'password',
  'novaSenha',
  'senhaConfirmacao',
  'token',
  'accessToken',
  'apiKey',
  'chaveSecreta',
  'codigoOtp',
  'otpHash',
  'imagemBase64'
])

// Rotas de infraestrutura: ruído puro no tracing e custo à toa.
const ROTAS_SEM_TRACE = Object.freeze(['/health', '/ready'])

// Onde uma falha custa dinheiro ou quebra assinatura de contrato: 100%.
const ROTAS_CRITICAS = Object.freeze(['/webhooks', '/pagamentos', '/assinatura'])

function redigir(objeto) {
  if (!objeto || typeof objeto !== 'object') return objeto

  for (const campo of Object.keys(objeto)) {
    if (CAMPOS_SENSIVEIS.includes(campo)) {
      objeto[campo] = '[redigido]'
      continue
    }
    // Payload aninhado (ex.: `{ pagamentos: [{ cartao: {...} }] }`).
    if (objeto[campo] && typeof objeto[campo] === 'object') redigir(objeto[campo])
  }

  return objeto
}

/*
 * Desenvolvimento NÃO reporta.
 *
 * O `.env` local tem o DSN preenchido (é o mesmo arquivo usado como base para
 * produção), então a guarda `if (SENTRY_DSN)` sozinha não segura nada: rodando
 * `pnpm dev` na máquina, todo erro de teste ia parar no painel e consumia cota.
 *
 * `NODE_ENV` é quem decide — é a convenção do Node e quem define é o
 * `environment:` do stack do Swarm (devops/server-general/backend/stack.yml),
 * o mesmo lugar que já injeta o `SENTRY_DSN`. Fonte de verdade única: quem
 * mexer no deploy vê as duas variáveis lado a lado.
 *
 * Não vale usar `MONGO_STRING` como sinal: o banco local aponta para o
 * servidor de produção, então ele não distingue ambiente.
 *
 * A comparação é por `=== 'production'`, não por "diferente de development":
 * assim a variável ausente (o caso da máquina local) cai no silêncio. O
 * default é não enviar — esquecer de configurar nunca vaza erro de
 * desenvolvimento para o painel.
 */
const EM_PRODUCAO = process.env.NODE_ENV === 'production'

if (process.env.SENTRY_DSN && EM_PRODUCAO) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Dentro do if a variavel ja e 'production' — o fallback seria morto.
    environment: 'production',
    // Passado no build (`--build-arg GIT_SHA=$(git rev-parse HEAD)`): é o que
    // liga um erro à versão exata que estava no ar.
    release: process.env.GIT_SHA,

    // Todos os ERROS são enviados. O que se amostra é performance, não falha.
    sampleRate: 1.0,

    /*
     * Amostragem de performance.
     *
     * 5% é o suficiente para ver tendência de latência sem estourar cota: cada
     * request amostrada vira uma transaction cobrada. Health check a cada 60s
     * geraria ~43 mil transactions/mês sozinho — por isso vai a zero.
     */
    tracesSampler: (contexto) => {
      const url = contexto.request?.url || contexto.name || ''

      if (ROTAS_SEM_TRACE.some((rota) => url.includes(rota))) return 0
      if (ROTAS_CRITICAS.some((rota) => url.includes(rota))) return 1.0

      return 0.05
    },

    /*
     * Última barreira antes do envio.
     *
     * Roda no processo, então o dado sensível não chega a sair da máquina.
     */
    beforeSend(evento) {
      const headers = evento.request?.headers
      if (headers) {
        delete headers.authorization
        delete headers.cookie
        // O token de sessão deste projeto vai neste header, não no Authorization.
        delete headers['x-access-token']
        delete headers['x-api-key']
      }

      if (evento.request?.data) redigir(evento.request.data)
      if (evento.extra) redigir(evento.extra)

      return evento
    }
  })
}
