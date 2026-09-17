import { Router } from 'express'
import controllerAutenticacao from '../controllers/autenticacao.js'
import validationAutenticacao from '../validations/autenticacao.js'
import middlewareToken from '../middlewares/token/token.js'
import middlewareTokenData from '../middlewares/token/token-data.js'
import middlewareRateLimit from '../middlewares/rateLimit.js'

const router = Router()

router.post('/entrar', middlewareRateLimit.loginLimiter, validationAutenticacao.entrar, controllerAutenticacao.entrar)

router.get('/eu', middlewareToken, middlewareTokenData, controllerAutenticacao.eu)

export default router
