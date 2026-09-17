import DB from './db.js'
import configFirestore from '../configs/firestore.js'

const model = new DB('usuarios')

// O e-mail (normalizado) É o ID do documento — dá unicidade de graça (o
// Firestore não tem índice único nativo como o Mongo tinha) e troca a busca
// por regex case-insensitive por um `.doc(id).get()` direto.
function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function findOne(filters, select) {
  return model.findOne(filters, select)
}

function filter(filters, select, sort) {
  return model.filter(filters, select, sort)
}

function exists(filters) {
  if (filters?.email) return model.exists({ _id: normalizarEmail(filters.email) })
  return model.exists(filters)
}

// Busca por e-mail — usada no login. Devolve o documento cru (com `senha`),
// diferente de `receberPorID`, porque `entrar()` precisa comparar a senha.
function receberPorEmail(email) {
  const alvo = normalizarEmail(email)
  if (!alvo) return null
  return model.findOne({ _id: alvo })
}

// Whitelist explícita: nunca devolve `senha`, mesmo que o documento ganhe campo novo.
async function receberPorID(id) {
  const usuario = await model.findOne({ _id: id })
  if (!usuario) return null

  return {
    _id: usuario._id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    ativo: usuario.ativo,
    dataUltimoAcesso: usuario.dataUltimoAcesso,
    dataRegistro: usuario.dataRegistro
  }
}

async function listar() {
  const usuarios = await model.filter({}, null, null)
  return usuarios
    .map(({ senha, ...resto }) => resto)
    .sort((a, b) => new Date(b.dataRegistro) - new Date(a.dataRegistro))
}

// `.doc(email).create()` lança se o documento já existir — é o equivalente ao
// índice único do Mongo, e fecha a janela de corrida entre o `exists()` que o
// controller já faz antes de chamar isto e a escrita de verdade.
async function adicionar(dados) {
  const email = normalizarEmail(dados.email)
  const payload = {
    nome: dados.nome,
    email,
    senha: dados.senha,
    role: dados.role === 'admin' ? 'admin' : 'cliente',
    ativo: true,
    dataUltimoAcesso: null,
    dataRegistro: new Date()
  }

  try {
    await configFirestore.obterFirestore().collection('usuarios').doc(email).create(payload)
  } catch (error) {
    if (error?.code === 6) {
      const conflito = new Error('Já existe uma conta com este email.')
      conflito.status = 409
      throw conflito
    }
    throw error
  }

  return { _id: email, ...payload }
}

function alterarAtivo(id, ativo) {
  return model.edit({ _id: id }, { ativo: !!ativo })
}

function alterarSenha(id, senhaHash) {
  return model.edit({ _id: id }, { senha: senhaHash })
}

function alterarUltimoAcesso(id) {
  return model.edit({ _id: id }, { dataUltimoAcesso: new Date() })
}

export default {
  findOne,
  filter,
  exists,
  receberPorEmail,
  receberPorID,
  listar,
  adicionar,
  alterarAtivo,
  alterarSenha,
  alterarUltimoAcesso
}
