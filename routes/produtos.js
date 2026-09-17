import { Router } from 'express'
import controllerProdutos from '../controllers/produtos.js'
import validationProdutos from '../validations/produtos.js'
import middlewareToken from '../middlewares/token/token.js'
import middlewareTokenData from '../middlewares/token/token-data.js'

const router = Router()

// Estoque é dado de trabalho da empresa — admin e cliente (o engenheiro) veem
// e mexem igual. O que é admin-only é gestão de CONTA (routes/usuarios.js).
const base = [middlewareToken, middlewareTokenData]

router.get('/', base, controllerProdutos.listar)
router.get('/alertas', base, controllerProdutos.abaixoDoMinimo)
router.get('/:id', base, controllerProdutos.receberPorID)
router.post('/', base, validationProdutos.criar, controllerProdutos.criar)
router.put('/:id', base, validationProdutos.editar, controllerProdutos.editar)
router.delete('/:id', base, controllerProdutos.inativar)

router.post('/:id/entrada', base, validationProdutos.quantidade, controllerProdutos.entrada)
router.post('/:id/saida', base, validationProdutos.quantidade, controllerProdutos.saida)
router.post('/:id/corte', base, validationProdutos.corte, controllerProdutos.corte)
router.post('/:id/usar-sobra', base, validationProdutos.quantidade, controllerProdutos.usarSobra)
router.post('/:id/ajuste', base, validationProdutos.ajuste, controllerProdutos.ajuste)

export default router
