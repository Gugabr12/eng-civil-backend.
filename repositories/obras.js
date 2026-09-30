import DB from './db.js'

const model = new DB('obras')

async function listar({ incluirInativas = false } = {}) {
  const obras = await model.filter(incluirInativas ? {} : { ativo: true }, null, null)
  return obras.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function receberPorID(id) {
  if (!id || typeof id !== 'string') return null
  return model.findOne({ _id: id })
}

function adicionar(dados) {
  return model.add({
    nome: String(dados.nome).trim(),
    ativo: true,
    dataCriacao: new Date()
  })
}

function editar(id, dados) {
  const payload = {}
  if (typeof dados.nome === 'string') payload.nome = dados.nome.trim()
  if (typeof dados.ativo === 'boolean') payload.ativo = dados.ativo
  return model.edit({ _id: id }, payload)
}

export default { listar, receberPorID, adicionar, editar }
