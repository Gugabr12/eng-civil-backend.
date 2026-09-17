import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'

const nodeResponse = new NodeResponse()

// Roda depois de middlewareTokenData — exige req.usuario.role === 'admin'.
function exigirAdmin(req, res, next) {
  if (req.usuario?.role !== 'admin') {
    return nodeResponse.simpleError(res, 403, 'Acesso restrito ao administrador.')
  }
  return next()
}

export default exigirAdmin
