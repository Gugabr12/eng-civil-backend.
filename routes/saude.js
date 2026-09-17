import { Router } from 'express'
import configFirestore from '../configs/firestore.js'

const router = Router()

/*
 * Endpoints de saúde — consumidos pelo Uptime Kuma e pelo orquestrador.
 *
 * São dois conceitos diferentes, e confundi-los causa reinício em cascata:
 *
 *   /health  (liveness)  — "o processo está vivo?"
 *   /ready   (readiness) — "consigo atender requisição de verdade?"
 *
 * Ficam FORA dos middlewares de autenticação: um monitor externo não tem
 * token, e uma rota de saúde que exige login sempre responderia 401 — o
 * monitor a interpretaria como DOWN para sempre.
 *
 * O `tracesSampler` do Sentry devolve 0 para estas rotas (ver instrument.mjs):
 * um check a cada 60s geraria ~43 mil transactions/mês sem informação nenhuma.
 */

// Tempo máximo esperando o banco responder antes de assumir que não está pronto.
const TIMEOUT_FIRESTORE_MS = 2000

/*
 * LIVENESS — barato, sem I/O.
 *
 * Só prova que o event loop responde. Não toca em dependência de propósito: se
 * o Firestore cair, o processo continua vivo e reiniciá-lo não resolveria
 * nada — só derrubaria as requisições em andamento.
 */
// Sem versão/GIT_SHA aqui: é rota pública, sem auth — identificar o commit
// exato em produção é reconhecimento de graça pra quem estiver sondando.
router.get('/health', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) })
})

/*
 * READINESS — verifica as dependências.
 *
 * Duas decisões que não são detalhe:
 *
 * 1. `Promise.race` com timeout: se o Firestore TRAVAR (não cair, travar),
 *    sem isso o health check fica pendurado até o timeout do monitor.
 *    Queremos resposta rápida dizendo "não estou pronto".
 *
 * 2. Status 503, não 200 com `{ok:false}`: funciona com qualquer monitor sem
 *    configuração extra.
 *
 * NÃO checa terceiros (Stripe, Resend) de propósito: se a API do
 * gateway cair e marcarmos o serviço como DOWN, derrubamos a nós mesmos por
 * causa dos outros. Terceiro é monitor separado no Kuma.
 */
router.get('/ready', async (req, res) => {
  const checks = {}
  let timer

  try {
    await Promise.race([
      configFirestore.obterFirestore().collection('usuarios').limit(1).get(),
      new Promise((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error('timeout')), TIMEOUT_FIRESTORE_MS) })
    ])
    checks.firestore = true
  } catch (erro) {
    checks.firestore = false
  } finally {
    // Sem isto, todo ping que responde ANTES do timeout deixava o timer vivo
    // até disparar sozinho — um `/ready` chamado a cada poucos segundos
    // acumula timers pendentes sem necessidade.
    clearTimeout(timer)
  }

  const ok = Object.values(checks).every(Boolean)
  res.status(ok ? 200 : 503).json({ ok, checks })
})

export default router
