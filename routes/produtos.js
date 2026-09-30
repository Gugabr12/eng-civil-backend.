import { Router } from 'express'
import controllerProdutos from '../controllers/produtos.js'
import validationProdutos from '../validations/produtos.js'
import middlewareToken from '../middlewares/token/token.js'
import middlewareTokenData from '../middlewares/token/token-data.js'
import obraAcesso from '../middlewares/obra-acesso.js'

const router = Router()

// Estoque é dado de trabalho da empresa — admin e cliente (o engenheiro) veem
// e mexem igual. O que é admin-only é gestão de CONTA (routes/usuarios.js).
const base = [middlewareToken, middlewareTokenData]

router.get('/', base, obraAcesso.obraDaQuery, controllerProdutos.listar)
router.get('/alertas', base, controllerProdutos.abaixoDoMinimo)
router.get('/:id', base, obraAcesso.produtoDaObra, controllerProdutos.receberPorID)
router.post('/', base, validationProdutos.criar, obraAcesso.obraDoBody, controllerProdutos.criar)
router.put('/:id', base, obraAcesso.produtoDaObra, validationProdutos.editar, controllerProdutos.editar)
router.delete('/:id', base, obraAcesso.produtoDaObra, controllerProdutos.inativar)

router.post('/:id/entrada', base, obraAcesso.produtoDaObra, validationProdutos.quantidade, controllerProdutos.entrada)
router.post('/:id/saida', base, obraAcesso.produtoDaObra, validationProdutos.quantidade, controllerProdutos.saida)
router.post('/:id/corte', base, obraAcesso.produtoDaObra, validationProdutos.corte, controllerProdutos.corte)
router.post('/:id/usar-sobra', base, obraAcesso.produtoDaObra, validationProdutos.quantidade, controllerProdutos.usarSobra)
router.post('/:id/ajuste', base, obraAcesso.produtoDaObra, validationProdutos.ajuste, controllerProdutos.ajuste)

export default router
