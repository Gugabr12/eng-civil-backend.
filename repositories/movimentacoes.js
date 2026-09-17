import DB from './db.js'

const model = new DB('movimentacoes')

function registrar(dados) {
  const payload = {
    produtoId: dados.produtoId,
    tipo: dados.tipo,
    quantidade: dados.quantidade,
    unidade: dados.unidade || '',
    usuarioId: dados.usuarioId,
    observacao: dados.observacao || '',
    data: new Date()
  }
  return model.add(payload)
}

// Filtro por `produtoId` + ordenação por `data` exige um índice composto no
// Firestore (ver `firestore.indexes.json`).
function listarPorProduto(produtoId, limite = 50) {
  return model.filter({ produtoId }, null, { data: -1 }, limite)
}

export default {
  registrar,
  listarPorProduto
}
