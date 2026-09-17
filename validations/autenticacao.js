import validateHelper from './validate.js'

const rulesEntrar = Object.freeze({
  email: 'required|string|email|maxLength:150',
  senha: 'required|string|minLength:1|maxLength:200'
})

async function entrar(req, res, next) {
  const validateOk = await validateHelper.validateRequest(res, req.body, rulesEntrar)
  if (validateOk === true) return next()
  return false
}

export default { entrar }
