import validateHelper from './validate.js'

// Mesmo teto de `repositories/produtos.js` (LIMITE_QUANTIDADE) — duplicado
// aqui de propósito como primeira barreira (o controller aplica o teto de
// verdade via `quantidadeValida`; isto aqui só rejeita cedo, antes de gastar
// uma query).
const LIMITE_QUANTIDADE = 1_000_000

const rulesCriar = Object.freeze({
  obraId: 'required|string|maxLength:100',
  categoria: 'required|string|maxLength:20',
  nome: 'required|string|maxLength:120',
  unidade: 'required|string|maxLength:20',
  quantidadeAtual: `number|min:0|max:${LIMITE_QUANTIDADE}`,
  quantidadeMinima: `number|min:0|max:${LIMITE_QUANTIDADE}`,
  bitola: 'string|maxLength:20',
  comprimentoBarraMetros: `number|min:0|max:${LIMITE_QUANTIDADE}`,
  observacoes: 'string|maxLength:500'
})

const rulesEditar = Object.freeze({
  nome: 'string|maxLength:120',
  unidade: 'string|maxLength:20',
  quantidadeMinima: `number|min:0|max:${LIMITE_QUANTIDADE}`,
  bitola: 'string|maxLength:20',
  comprimentoBarraMetros: `number|min:0|max:${LIMITE_QUANTIDADE}`,
  observacoes: 'string|maxLength:500'
})

const rulesQuantidade = Object.freeze({
  quantidade: `required|number|min:0|max:${LIMITE_QUANTIDADE}`,
  observacao: 'string|maxLength:300'
})

const rulesCorte = Object.freeze({
  metrosUsados: `required|number|min:0|max:${LIMITE_QUANTIDADE}`,
  observacao: 'string|maxLength:300'
})

const rulesAjuste = Object.freeze({
  quantidadeAtual: `required|number|min:0|max:${LIMITE_QUANTIDADE}`,
  observacao: 'string|maxLength:300'
})

function build(rules) {
  return async function (req, res, next) {
    const validateOk = await validateHelper.validateRequest(res, req.body, rules)
    if (validateOk === true) return next()
    return false
  }
}

export default {
  criar: build(rulesCriar),
  editar: build(rulesEditar),
  quantidade: build(rulesQuantidade),
  corte: build(rulesCorte),
  ajuste: build(rulesAjuste)
}
