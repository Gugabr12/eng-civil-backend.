import { Router } from 'express'
import controllerUsuarios from '../controllers/usuarios.js'
import validationUsuarios from '../validations/usuarios.js'
import middlewareToken from '../middlewares/token/token.js'
import middlewareTokenData from '../middlewares/token/token-data.js'
import middlewareAdmin from '../middlewares/token/admin.js'

const router = Router()

// Todas as rotas de gestão de contas são admin-only.
const base = [middlewareToken, middlewareTokenData, middlewareAdmin]

router.get('/', base, controllerUsuarios.listar)
router.post('/', base, validationUsuarios.criar, controllerUsuarios.criar)
router.patch('/:id/ativo', base, validationUsuarios.alterarAtivo, controllerUsuarios.alterarAtivo)
router.patch('/:id/obras', base, validationUsuarios.alterarObras, controllerUsuarios.alterarObras)
router.patch('/:id/senha', base, validationUsuarios.redefinirSenha, controllerUsuarios.redefinirSenha)

export default router
