import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import NodePassword from 'densyy-node-toolbox/core/tools/node-password.js'
import repositoryUsuarios from '../repositories/usuarios.js'
import configError from '../configs/error.js'

const nodeResponse = new NodeResponse()
const nodePassword = new NodePassword()

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

    const jaExiste = await repositoryUsuarios.exists({ email: body.email })
    if (jaExiste) return nodeResponse.simpleError(res, 409, 'Já existe uma conta com este email.')

    const key = process.env.BCRYPT_KEY
    const senhaHash = await nodePassword.toHash(body.senha, key)

    const resultado = await repositoryUsuarios.adicionar({
      nome: body.nome,
      email: body.email,
      senha: senhaHash,
      role: body.role
    })

    const criado = Array.isArray(resultado) ? resultado[0] : resultado
    const usuario = await repositoryUsuarios.receberPorID(criado._id)

    return nodeResponse.create(res, usuario)
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
  redefinirSenha
}
