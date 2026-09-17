import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import NodeValidator from 'densyy-node-toolbox/core/tools/node-validator.js'

const nodeResponse = new NodeResponse()

async function validateRequest(res, body, rules) {
  const validator = new NodeValidator(rules)
  await validator.validate(body)

  const error = validator.firstError()
  if (!error) return true

  return sendMessage(res, error)
}

function sendMessage(res, message) {
  return nodeResponse.simpleError(res, 422, message)
}

export default {
  validateRequest,
  sendMessage
}
