import DB from './db.js'
import configFirestore from '../configs/firestore.js'

const model = new DB('produtos')
const COLECAO = 'produtos'

// Teto de sanidade — não existe obra com mais que isso de qualquer material.
// Bloqueia valores absurdos (Infinity, 1e400, etc.) que passariam num check
// só de "é número" e corromperiam o produto de forma permanente.
const LIMITE_QUANTIDADE = 1_000_000

async function listar(filters = {}) {
  const query = { ativo: true, ...filters }
  const produtos = await model.filter(query, null, null)
  return ordenar(produtos)
}

function receberPorID(id) {
  return model.findOne({ _id: id, ativo: true })
}

// Todo produto (mesmo inativo) — usado só para validar existência antes de
// lançar movimentação, nunca para exibir na lista.
function existeAtivo(id) {
  return model.exists({ _id: id, ativo: true })
}

// Sem equivalente a aggregation pipeline (`$expr`) no Firestore — o dataset é
// pequeno (estoque de uma empresa), então filtra em memória.
async function abaixoDoMinimo() {
  const produtos = await model.filter({ ativo: true }, null, null)
  return ordenar(produtos.filter((produto) => produto.quantidadeAtual <= produto.quantidadeMinima))
}

function ordenar(produtos) {
  return produtos.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome))
}

// Construído à parte de `payloadEditavel`: na criação todo campo precisa de
// um valor (o Firestore não tem `default` de schema como o Mongo tinha).
function adicionar(dados) {
  const quantidadeInicial = quantidadeValida(dados.quantidadeAtual)
  const quantidadeMinima = quantidadeValida(dados.quantidadeMinima)
  const comprimentoBarraMetros = quantidadeValida(dados.comprimentoBarraMetros)

  const payload = {
    categoria: typeof dados.categoria === 'string' ? dados.categoria : '',
    nome: typeof dados.nome === 'string' ? dados.nome.trim() : '',
    bitola: typeof dados.bitola === 'string' ? dados.bitola.trim() : '',
    unidade: typeof dados.unidade === 'string' ? dados.unidade : '',
    quantidadeAtual: quantidadeInicial === null ? 0 : quantidadeInicial,
    quantidadeMinima: quantidadeMinima === null ? 0 : quantidadeMinima,
    comprimentoBarraMetros: comprimentoBarraMetros === null ? 12 : comprimentoBarraMetros,
    sobrasMetros: 0,
    observacoes: typeof dados.observacoes === 'string' ? dados.observacoes.trim().slice(0, 500) : '',
    ativo: true,
    dataCriacao: new Date(),
    dataAtualizacao: new Date()
  }

  return model.add(payload)
}

/*
 * Edição de CADASTRO (nome, unidade, mínimo, bitola, observações) — de
 * propósito NÃO aceita `categoria` nem `quantidadeAtual`. O saldo só muda
 * pelas rotas de movimentação (entrada/saída/corte/usar-sobra/ajuste), que
 * registram histórico; aceitar `quantidadeAtual` aqui deixaria o `PUT`
 * reescrever o estoque sem deixar rastro nenhum em `Movimentacoes`.
 */
function editar(id, dados) {
  const payload = payloadEditavel(dados)
  payload.dataAtualizacao = new Date()
  return model.edit({ _id: id, ativo: true }, payload)
}

function inativar(id) {
  return model.edit({ _id: id }, { ativo: false, dataAtualizacao: new Date() })
}

/*
 * As 4 funções abaixo (soma/subtrai/corte/sobra) usam `runTransaction()`: lê o
 * documento, confere a mesma condição de guarda que o Mongo fazia dentro do
 * próprio filtro do update atômico (ex.: `quantidadeAtual >= quantidade`), e
 * só então escreve. É a tradução correta do padrão "guarda no filtro + $inc
 * numa operação só" — o Firestore não tem um update condicional equivalente
 * fora de uma transação.
 */

// Entrada: soma sempre pode. Sem guarda de concorrência necessária.
function somarQuantidade(id, delta) {
  return transacaoEstoque(id, (produto) => ({
    quantidadeAtual: produto.quantidadeAtual + delta
  }))
}

// Saída: bloqueia se não houver saldo suficiente — evita estoque negativo
// mesmo com duas requisições simultâneas, porque a leitura e a escrita
// acontecem dentro da mesma transação do Firestore.
function subtrairQuantidade(id, quantidade) {
  return transacaoEstoque(id, (produto) => {
    if (produto.quantidadeAtual < quantidade) return null
    return { quantidadeAtual: produto.quantidadeAtual - quantidade }
  })
}

// Corte de barra: tira 1 barra do estoque e soma o retalho em sobrasMetros.
function registrarCorte(id, sobraMetros) {
  return transacaoEstoque(id, (produto) => {
    if (produto.quantidadeAtual < 1) return null
    return {
      quantidadeAtual: produto.quantidadeAtual - 1,
      sobrasMetros: (produto.sobrasMetros || 0) + sobraMetros
    }
  })
}

// Reaproveitar sobra: mesma guarda de concorrência que a saída normal.
function usarSobra(id, metros) {
  return transacaoEstoque(id, (produto) => {
    const sobrasMetros = produto.sobrasMetros || 0
    if (sobrasMetros < metros) return null
    return { sobrasMetros: sobrasMetros - metros }
  })
}

function ajustarQuantidade(id, quantidadeAtual) {
  return model.edit({ _id: id, ativo: true }, { quantidadeAtual, dataAtualizacao: new Date() })
}

// `calcularMudancas(produtoAtual)` devolve os campos a atualizar, ou `null`
// para abortar (equivalente a "o filtro de guarda não casou" no Mongo).
async function transacaoEstoque(id, calcularMudancas) {
  const firestore = configFirestore.obterFirestore()
  const ref = firestore.collection(COLECAO).doc(String(id))

  return firestore.runTransaction(async (transacao) => {
    const snap = await transacao.get(ref)
    if (!snap.exists) return null

    const produto = { _id: snap.id, ...snap.data() }
    if (produto.ativo !== true) return null

    const mudancas = calcularMudancas(produto)
    if (!mudancas) return null

    mudancas.dataAtualizacao = new Date()
    transacao.update(ref, mudancas)
    return { ...produto, ...mudancas }
  })
}

// Valida e satura um número recebido de fora: finito, não-negativo, dentro
// do teto de sanidade. Retorna null quando o campo não veio (para o chamador
// decidir se ignora ou usa default) e não confunde com "veio 0 de propósito".
function quantidadeValida(valor) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return null
  return Math.min(Math.max(0, numero), LIMITE_QUANTIDADE)
}

function payloadEditavel(dados) {
  const payload = {}

  if (typeof dados.nome === 'string') payload.nome = dados.nome.trim()
  if (typeof dados.bitola === 'string') payload.bitola = dados.bitola.trim()
  if (typeof dados.unidade === 'string') payload.unidade = dados.unidade

  const quantidadeMinima = quantidadeValida(dados.quantidadeMinima)
  if (quantidadeMinima !== null) payload.quantidadeMinima = quantidadeMinima

  const comprimentoBarra = quantidadeValida(dados.comprimentoBarraMetros)
  if (comprimentoBarra !== null) payload.comprimentoBarraMetros = comprimentoBarra

  if (typeof dados.observacoes === 'string') payload.observacoes = dados.observacoes.trim().slice(0, 500)

  return payload
}

export default {
  listar,
  receberPorID,
  existeAtivo,
  abaixoDoMinimo,
  adicionar,
  editar,
  inativar,
  somarQuantidade,
  subtrairQuantidade,
  registrarCorte,
  usarSobra,
  ajustarQuantidade,
  LIMITE_QUANTIDADE,
  quantidadeValida
}
