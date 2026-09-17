import { rateLimit } from 'express-rate-limit'

const STATUS_CODE_TOO_MANY_REQUESTS = 429

// Responde no mesmo formato do NodeResponse: { status, statusCode, body }.
function buildHandler(message) {
  return (req, res) => {
    return res.status(STATUS_CODE_TOO_MANY_REQUESTS).json({
      status: 'error',
      statusCode: STATUS_CODE_TOO_MANY_REQUESTS,
      body: message
    })
  }
}

function baseConfig(options) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  })
}

const loginLimiter = baseConfig({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  handler: buildHandler('Muitas tentativas de autenticação. Tente novamente em 15 minutos.')
})

export default {
  loginLimiter
}
