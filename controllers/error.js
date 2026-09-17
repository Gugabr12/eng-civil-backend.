import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'

const nodeResponse = new NodeResponse()

function error(_req, res) {
  return nodeResponse.simpleError(res, 404, 'Rota inexistente.')
}

export default { error }
