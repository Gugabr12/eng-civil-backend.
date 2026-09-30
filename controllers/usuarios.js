import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import NodePassword from 'densyy-node-toolbox/core/tools/node-password.js'
import repositoryUsuarios from '../repositories/usuarios.js'
import repositoryObras from '../repositories/obras.js'
import configError from '../configs/error.js'

const nodeResponse = new NodeResponse()
const nodePassword = new NodePassword()

// Só ids de obras que existem. Devolve a lista limpa ou `null` se algo for inválido.
async function obrasValidas(ids) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id)) return null
  const unicos = [...new Set(ids)]
  const existentes = await Promise.all(unicos.map((id) => repositoryObras.receberPorID(id)))
  if (existentes.some((obra) => !obra)) return null
  return unicos
}

async function listar(req, res) {
  try {
    const usuarios = await repositoryUsuarios.listar()
    return nodeResponse.success(res, usuarios)
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function criar(req, res) {
  const { body } = req

  try {
    if (body.role !== 'admin' && body.role !== 'cliente') {
      return nodeResponse.simpleError(res, 422, 'role deve ser "admin" ou "cliente".')
    }

    let obras = []
    if (body.role === 'cliente') {
      obras = await obrasValidas(body.obras)
      if (!obras || obras.length === 0) return nodeResponse.simpleError(res, 422, 'Escolha pelo menos uma obra existente para o funcionário.')
    }

    const jaExiste = await repositoryUsuarios.exists({ email: body.email })
    if (jaExiste) return nodeResponse.simpleError(res, 409, 'Já existe uma conta com este email.')

    const key = process.env.BCRYPT_KEY
    const senhaHash = await nodePassword.toHash(body.senha, key)

    const resultado = await repositoryUsuarios.adicionar({
      nome: body.nome,
      email: body.email,
      senha: senhaHash,
      role: body.role,
      obras
    })

    const criado = Array.isArray(resultado) ? resultado[0] : resultado
    const usuario = await repositoryUsuarios.receberPorID(criado._id)

    return nodeResponse.create(res, usuario)
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function alterarObras(req, res) {
  try {
    const alvo = await repositoryUsuarios.receberPorID(req.params.id)
    if (!alvo) return nodeResponse.simpleError(res, 404, 'Usuário não encontrado.')
    if (alvo.role === 'admin') return nodeResponse.simpleError(res, 422, 'Administrador já enxerga todas as obras.')

    const obras = await obrasValidas(req.body.obras)
    if (!obras || obras.length === 0) return nodeResponse.simpleError(res, 422, 'Escolha pelo menos uma obra existente.')

    await repositoryUsuarios.alterarObras(req.params.id, obras)
    return nodeResponse.success(res, await repositoryUsuarios.receberPorID(req.params.id))
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function alterarAtivo(req, res) {
  try {
    // Admin não consegue desativar a própria conta — evita o cenário de
    // ficar trancado do lado de fora sem outro admin para reverter.
    if (String(req.params.id) === String(req.usuario.id)) {
      return nodeResponse.simpleError(res, 422, 'Você não pode desativar a própria conta.')
    }

    await repositoryUsuarios.alterarAtivo(req.params.id, req.body.ativo)
    const usuario = await repositoryUsuarios.receberPorID(req.params.id)
    return nodeResponse.success(res, usuario)
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function redefinirSenha(req, res) {
  try {
    const key = process.env.BCRYPT_KEY
    const senhaHash = await nodePassword.toHash(req.body.senha, key)
    await repositoryUsuarios.alterarSenha(req.params.id, senhaHash)
    return nodeResponse.success(res, { message: 'Senha redefinida.' })
  } catch (error) {
    return configError.capture(res, error)
  }
}

export default {
  listar,
  criar,
  alterarAtivo,
  alterarObras,
  redefinirSenha
}
