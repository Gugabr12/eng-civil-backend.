import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import repositoryProdutos from '../repositories/produtos.js'
import repositoryMovimentacoes from '../repositories/movimentacoes.js'
import repositoryObras from '../repositories/obras.js'
import configError from '../configs/error.js'
import obraAcesso from '../middlewares/obra-acesso.js'
import { CATEGORIAS, UNIDADES } from '../shared/models/produtos.js'

const nodeResponse = new NodeResponse()

// Número finito, > 0, saturado no teto de sanidade — usado em toda rota que
// SOMA ou SUBTRAI estoque (entrada, saída, corte, usar-sobra). `ajuste` usa
// `repositoryProdutos.quantidadeValida` diretamente porque ali 0 é um valor
// válido (é a contagem física absoluta, não um delta).
function quantidadePositiva(valor) {
  const numero = repositoryProdutos.quantidadeValida(valor)
  return numero !== null && numero > 0 ? numero : null
}

async function listar(req, res) {
  try {
    const filters = { obraId: req.obra._id }
    // `req.query.categoria` pode chegar como objeto (`?categoria[$regex]=...`)
    // com o parser 'extended' do Express — só aceitamos string de uma lista
    // fechada, nunca repassamos o valor cru pro filtro do Mongo.
    if (req.query.categoria) {
      if (typeof req.query.categoria !== 'string' || !CATEGORIAS.includes(req.query.categoria)) {
        return nodeResponse.simpleError(res, 422, `categoria deve ser uma de: ${CATEGORIAS.join(', ')}`)
      }
      filters.categoria = req.query.categoria
    }

    const produtos = await repositoryProdutos.listar(filters)
    return nodeResponse.success(res, produtos)
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function abaixoDoMinimo(req, res) {
  try {
    let obraIds = null
    if (req.query.obraId) {
      if (typeof req.query.obraId !== 'string') return nodeResponse.simpleError(res, 422, 'obraId inválido.')
      const obra = await repositoryObras.receberPorID(req.query.obraId)
      if (!obra || !obraAcesso.podeAcessar(req.usuario, obra._id)) return nodeResponse.simpleError(res, 404, 'Obra não encontrada.')
      obraIds = [obra._id]
    }

    const obras = await repositoryObras.listar()
    const permitidas = obras.filter((obra) => obraAcesso.podeAcessar(req.usuario, obra._id))
    const nomes = new Map(permitidas.map((obra) => [obra._id, obra.nome]))
    const escopo = (obraIds || [...nomes.keys()]).filter((id) => nomes.has(id))

    const produtos = await repositoryProdutos.abaixoDoMinimo(escopo)
    return nodeResponse.success(res, produtos.map((produto) => ({ ...produto, obraNome: nomes.get(produto.obraId) })))
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function receberPorID(req, res) {
  try {
    const produto = req.produto

    const movimentacoes = await repositoryMovimentacoes.listarPorProduto(req.params.id)
    return nodeResponse.success(res, { ...produto, movimentacoes })
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function criar(req, res) {
  const { body } = req

  try {
    if (!CATEGORIAS.includes(body.categoria)) {
      return nodeResponse.simpleError(res, 422, `categoria deve ser uma de: ${CATEGORIAS.join(', ')}`)
    }
    if (!UNIDADES.includes(body.unidade)) {
      return nodeResponse.simpleError(res, 422, `unidade deve ser uma de: ${UNIDADES.join(', ')}`)
    }

    const resultado = await repositoryProdutos.adicionar({ ...body, obraId: req.obra._id })
    const criado = Array.isArray(resultado) ? resultado[0] : resultado
    const produto = await repositoryProdutos.receberPorID(criado._id)

    return nodeResponse.create(res, produto)
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function editar(req, res) {
  try {
    await repositoryProdutos.editar(req.params.id, req.body)
    const produto = await repositoryProdutos.receberPorID(req.params.id)
    if (!produto) return nodeResponse.simpleError(res, 404, 'Produto não encontrado.')
    return nodeResponse.success(res, produto)
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function inativar(req, res) {
  try {
    await repositoryProdutos.inativar(req.params.id)
    return nodeResponse.success(res, { message: 'Produto removido.' })
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function entrada(req, res) {
  const { observacao } = req.body

  try {
    const quantidade = quantidadePositiva(req.body.quantidade)
    if (quantidade === null) return nodeResponse.simpleError(res, 422, `quantidade deve ser um número entre 0 e ${repositoryProdutos.LIMITE_QUANTIDADE}, maior que zero.`)

    const produto = await repositoryProdutos.somarQuantidade(req.params.id, quantidade)
    if (!produto) return nodeResponse.simpleError(res, 404, 'Produto não encontrado.')

    await repositoryMovimentacoes.registrar({
      produtoId: produto._id,
      tipo: 'entrada',
      quantidade,
      unidade: produto.unidade,
      usuarioId: req.usuario.id,
      observacao
    })

    return nodeResponse.success(res, produto)
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function saida(req, res) {
  const { observacao } = req.body

  try {
    const quantidade = quantidadePositiva(req.body.quantidade)
    if (quantidade === null) return nodeResponse.simpleError(res, 422, `quantidade deve ser um número entre 0 e ${repositoryProdutos.LIMITE_QUANTIDADE}, maior que zero.`)

    const produto = await repositoryProdutos.subtrairQuantidade(req.params.id, quantidade)
    if (!produto) return nodeResponse.simpleError(res, 409, 'Estoque insuficiente (ou produto não encontrado).')

    await repositoryMovimentacoes.registrar({
      produtoId: produto._id,
      tipo: 'saida',
      quantidade,
      unidade: produto.unidade,
      usuarioId: req.usuario.id,
      observacao
    })

    return nodeResponse.success(res, produto)
  } catch (error) {
    return configError.capture(res, error)
  }
}

/*
 * Corte de barra de ferro: consome 1 barra inteira do estoque e joga o
 * retalho que sobrou em `sobrasMetros`, pra poder ser reaproveitado depois em
 * vez de virar sucata esquecida.
 */
async function corte(req, res) {
  const { observacao } = req.body

  try {
    const produtoAtual = await repositoryProdutos.receberPorID(req.params.id)
    if (!produtoAtual) return nodeResponse.simpleError(res, 404, 'Produto não encontrado.')
    if (produtoAtual.categoria !== 'ferro') return nodeResponse.simpleError(res, 422, 'Corte só se aplica a produtos da categoria ferro.')

    const comprimento = produtoAtual.comprimentoBarraMetros || 12
    const metrosUsados = quantidadePositiva(req.body.metrosUsados)
    if (metrosUsados === null || metrosUsados > comprimento) {
      return nodeResponse.simpleError(res, 422, `metrosUsados deve ser um número entre 0 e ${comprimento} (comprimento da barra).`)
    }

    const sobra = Number((comprimento - metrosUsados).toFixed(2))
    const produto = await repositoryProdutos.registrarCorte(req.params.id, sobra)
    if (!produto) return nodeResponse.simpleError(res, 409, 'Sem barra inteira disponível para cortar.')

    await repositoryMovimentacoes.registrar({
      produtoId: produto._id,
      tipo: 'corte',
      quantidade: metrosUsados,
      unidade: 'metro',
      usuarioId: req.usuario.id,
      observacao: observacao || `Cortou ${metrosUsados}m de uma barra de ${comprimento}m — sobra de ${sobra}m.`
    })

    return nodeResponse.success(res, produto)
  } catch (error) {
    return configError.capture(res, error)
  }
}

// Reaproveitar retalho de corte já registrado, sem mexer no número de barras.
async function usarSobra(req, res) {
  const { observacao } = req.body

  try {
    const quantidade = quantidadePositiva(req.body.quantidade)
    if (quantidade === null) return nodeResponse.simpleError(res, 422, `quantidade deve ser um número entre 0 e ${repositoryProdutos.LIMITE_QUANTIDADE}, maior que zero.`)

    const produto = await repositoryProdutos.usarSobra(req.params.id, quantidade)
    if (!produto) return nodeResponse.simpleError(res, 409, 'Sobra insuficiente (ou produto não encontrado).')

    await repositoryMovimentacoes.registrar({
      produtoId: produto._id,
      tipo: 'saida',
      quantidade,
      unidade: 'metro',
      usuarioId: req.usuario.id,
      observacao: observacao || 'Uso de sobra/retalho.'
    })

    return nodeResponse.success(res, produto)
  } catch (error) {
    return configError.capture(res, error)
  }
}

// Correção manual — inventário físico bateu diferente do sistema.
async function ajuste(req, res) {
  const { observacao } = req.body

  try {
    const quantidadeAtual = repositoryProdutos.quantidadeValida(req.body.quantidadeAtual)
    if (quantidadeAtual === null) return nodeResponse.simpleError(res, 422, `quantidadeAtual deve ser um número entre 0 e ${repositoryProdutos.LIMITE_QUANTIDADE}.`)

    const anterior = await repositoryProdutos.receberPorID(req.params.id)
    if (!anterior) return nodeResponse.simpleError(res, 404, 'Produto não encontrado.')

    const produto = await repositoryProdutos.ajustarQuantidade(req.params.id, quantidadeAtual)

    await repositoryMovimentacoes.registrar({
      produtoId: produto._id,
      tipo: 'ajuste',
      quantidade: quantidadeAtual - anterior.quantidadeAtual,
      unidade: produto.unidade,
      usuarioId: req.usuario.id,
      observacao: observacao || `Ajuste manual: ${anterior.quantidadeAtual} → ${quantidadeAtual}.`
    })

    return nodeResponse.success(res, produto)
  } catch (error) {
    return configError.capture(res, error)
  }
}

export default {
  listar,
  abaixoDoMinimo,
  receberPorID,
  criar,
  editar,
  inativar,
  entrada,
  saida,
  corte,
  usarSobra,
  ajuste
}
