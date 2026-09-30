import validateHelper from './validate.js'

// minLength 10: são só 2 contas neste sistema e não há 2FA — o comprimento da
// senha é a principal defesa contra força bruta, então vale ser mais estrito
// que o mínimo de 6 comum em produtos com mais camadas de proteção.
const rulesCriar = Object.freeze({
  nome: 'required|string|maxLength:100',
  email: 'required|string|email|maxLength:150',
  senha: 'required|string|minLength:10|maxLength:200',
  role: 'required|string|maxLength:10'
})

const rulesAlterarObras = Object.freeze({
  obras: 'required|array'
})

const rulesAlterarAtivo = Object.freeze({
  ativo: 'required|boolean'
})

const rulesRedefinirSenha = Object.freeze({
  senha: 'required|string|minLength:10|maxLength:200'
})

async function criar(req, res, next) {
  const validateOk = await validateHelper.validateRequest(res, req.body, rulesCriar)
  if (validateOk === true) return next()
  return false
}

async function alterarObras(req, res, next) {
  const validateOk = await validateHelper.validateRequest(res, req.body, rulesAlterarObras)
  if (validateOk === true) return next()
  return false
}

async function alterarAtivo(req, res, next) {
  const validateOk = await validateHelper.validateRequest(res, req.body, rulesAlterarAtivo)
  if (validateOk === true) return next()
  return false
}

async function redefinirSenha(req, res, next) {
  const validateOk = await validateHelper.validateRequest(res, req.body, rulesRedefinirSenha)
  if (validateOk === true) return next()
  return false
}

export default { criar, alterarAtivo, alterarObras, redefinirSenha }
