import { Router } from 'express'
import controllerRelatorios from '../controllers/relatorios.js'
import middlewareToken from '../middlewares/token/token.js'
import middlewareTokenData from '../middlewares/token/token-data.js'

const router = Router()

router.get('/estoque/pdf', middlewareToken, middlewareTokenData, controllerRelatorios.estoquePdf)

export default router
