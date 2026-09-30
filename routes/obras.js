import { Router } from 'express'
import controllerObras from '../controllers/obras.js'
import middlewareToken from '../middlewares/token/token.js'
import middlewareTokenData from '../middlewares/token/token-data.js'
import middlewareAdmin from '../middlewares/token/admin.js'

const router = Router()

const base = [middlewareToken, middlewareTokenData]
const admin = [...base, middlewareAdmin]

router.get('/', base, controllerObras.listar)
router.get('/resumo', admin, controllerObras.resumo)
router.post('/', admin, controllerObras.criar)
router.patch('/:id', admin, controllerObras.atualizar)

export default router
