import nodeToken from 'densyy-node-toolbox/core/middlewares/node-token.js'

async function middlewareToken(req, res, next) {
  const TOKEN_USUARIO = process.env.TOKEN_USUARIO
  const secrets = [TOKEN_USUARIO]

  const tokenOk = await nodeToken(req, res, ...secrets)
  if (tokenOk === true) return next()

  return false
}

export default middlewareToken
