import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import repositoryObras from '../repositories/obras.js'
import repositoryProdutos from '../repositories/produtos.js'
import configError from '../configs/error.js'

const nodeResponse = new NodeResponse()

// Admin enxerga toda obra; funcionário só as que foram vinculadas a ele.
function podeAcessar(usuario, obraId) {
  if (usuario?.role === 'admin') return true
  return Array.isArray(usuario?.obras) && usuario.obras.includes(String(obraId))
}

// Mesma resposta para "não existe" e "sem permissão": quem não tem acesso não
// descobre nem se a obra/produto existe.
async function carregarObra(req, res, next, obraId) {
  try {
    if (typeof obraId !== 'string' || !obraId) {
      return nodeResponse.simpleError(res, 422, 'obraId é obrigatório.')
    }

    const obra = await repositoryObras.receberPorID(obraId)
    if (!obra || obra.ativo === false || !podeAcessar(req.usuario, obra._id)) {
      return nodeResponse.simpleError(res, 404, 'Obra não encontrada.')
    }

    req.obra = obra
    return next()
  } catch (error) {
    return configError.capture(res, error)
  }
}

// GET /...?obraId=
function obraDaQuery(req, res, next) {
  return carregarObra(req, res, next, req.query.obraId)
}

// POST com `obraId` no body
function obraDoBody(req, res, next) {
  return carregarObra(req, res, next, req.body?.obraId)
}

// Rotas /:id de produto: acha o produto e confere se o usuário tem a obra dele.
async function produtoDaObra(req, res, next) {
  try {
    const produto = await repositoryProdutos.receberPorID(req.params.id)
    if (!produto || !podeAcessar(req.usuario, produto.obraId)) {
      return nodeResponse.simpleError(res, 404, 'Produto não encontrado.')
    }

    req.produto = produto
    return next()
  } catch (error) {
    return configError.capture(res, error)
  }
}

export default { podeAcessar, obraDaQuery, obraDoBody, produtoDaObra }
