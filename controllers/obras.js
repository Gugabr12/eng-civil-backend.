import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import repositoryObras from '../repositories/obras.js'
import repositoryProdutos from '../repositories/produtos.js'
import repositoryUsuarios from '../repositories/usuarios.js'
import configError from '../configs/error.js'
import obraAcesso from '../middlewares/obra-acesso.js'

const nodeResponse = new NodeResponse()

function nomeValido(nome) {
  return typeof nome === 'string' && nome.trim().length > 0 && nome.trim().length <= 100
}

async function listar(req, res) {
  try {
    const incluirInativas = req.usuario.role === 'admin' && req.query.todas === '1'
    const obras = await repositoryObras.listar({ incluirInativas })
    const visiveis = obras.filter((obra) => obraAcesso.podeAcessar(req.usuario, obra._id))
    return nodeResponse.success(res, visiveis)
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function criar(req, res) {
  try {
    if (!nomeValido(req.body.nome)) return nodeResponse.simpleError(res, 422, 'Informe o nome da obra (até 100 caracteres).')

    const resultado = await repositoryObras.adicionar({ nome: req.body.nome })
    const criada = Array.isArray(resultado) ? resultado[0] : resultado
    return nodeResponse.create(res, await repositoryObras.receberPorID(criada._id))
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function atualizar(req, res) {
  try {
    const { nome, ativo } = req.body
    if (nome !== undefined && !nomeValido(nome)) return nodeResponse.simpleError(res, 422, 'Nome inválido.')
    if (ativo !== undefined && typeof ativo !== 'boolean') return nodeResponse.simpleError(res, 422, 'ativo deve ser verdadeiro ou falso.')

    const existente = await repositoryObras.receberPorID(req.params.id)
    if (!existente) return nodeResponse.simpleError(res, 404, 'Obra não encontrada.')

    await repositoryObras.editar(req.params.id, { nome, ativo })
    return nodeResponse.success(res, await repositoryObras.receberPorID(req.params.id))
  } catch (error) {
    return configError.capture(res, error)
  }
}

// Visão geral do administrador: um bloco por obra, sem misturar os números.
async function resumo(req, res) {
  try {
    const [obras, produtos, usuarios] = await Promise.all([
      repositoryObras.listar(),
      repositoryProdutos.listar({}),
      repositoryUsuarios.listar()
    ])

    const resultado = obras.map((obra) => {
      const daObra = produtos.filter((produto) => produto.obraId === obra._id)
      const emAlerta = daObra.filter((produto) => produto.quantidadeAtual <= produto.quantidadeMinima)

      const porCategoria = { cimento: 0, ferro: 0, trelica: 0, outro: 0 }
      for (const produto of daObra) {
        if (porCategoria[produto.categoria] !== undefined) porCategoria[produto.categoria] += 1
      }

      return {
        obra: { _id: obra._id, nome: obra.nome },
        totalProdutos: daObra.length,
        totalAlertas: emAlerta.length,
        porCategoria,
        alertas: emAlerta.slice(0, 5).map((produto) => ({
          _id: produto._id,
          nome: produto.nome,
          categoria: produto.categoria,
          quantidadeAtual: produto.quantidadeAtual,
          quantidadeMinima: produto.quantidadeMinima,
          unidade: produto.unidade
        })),
        funcionarios: usuarios
          .filter((usuario) => usuario.role !== 'admin' && usuario.ativo !== false && (usuario.obras || []).includes(obra._id))
          .map((usuario) => ({ _id: usuario._id, nome: usuario.nome }))
      }
    })

    return nodeResponse.success(res, resultado)
  } catch (error) {
    return configError.capture(res, error)
  }
}

export default { listar, criar, atualizar, resumo }
