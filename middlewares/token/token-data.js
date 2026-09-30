import NodeJWT from 'densyy-node-toolbox/core/tools/node-jwt.js'
import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import repositoryUsuarios from '../../repositories/usuarios.js'
import configError from '../../configs/error.js'

const nodeJWT = new NodeJWT()
const nodeResponse = new NodeResponse()

/*
 * Roda DEPOIS de `middlewareToken` (que já validou assinatura/expiração). O
 * token só prova QUEM é — role e `ativo` são lidos do banco A CADA
 * requisição, não confiados ao payload assinado no login.
 *
 * É de propósito, mesmo custando uma query a mais: se o admin desativar a
 * conta do cliente (ou mudar o role), o efeito precisa valer na PRÓXIMA
 * requisição, não só depois que o token expirar. Só 2 contas usam este
 * sistema — o custo da query é irrelevante perto do risco de um acesso
 * revogado continuar funcionando.
 */
async function middlewareTokenData(req, res, next) {
  const token = req.headers['x-access-token']
  const data = nodeJWT.getData(token)

  if (!data || !data.data?.idUsuario) {
    return nodeResponse.simpleError(res, 401, 'O token está mal formatado.')
  }

  // Sem try/catch aqui, uma queda do Mongo pendurava a requisição pra sempre
  // (middleware async rejeitado não vira erro do Express 4 — some em silêncio,
  // sem 500, sem log de rota). 503 é o correto: é indisponibilidade de
  // dependência, não bug de aplicação.
  let usuario
  try {
    usuario = await repositoryUsuarios.receberPorID(data.data.idUsuario)
  } catch (error) {
    return configError.capture(res, error)
  }

  if (!usuario || usuario.ativo === false) {
    return nodeResponse.simpleError(res, 401, 'Sessão inválida. Faça login novamente.')
  }

  req.usuario = {
    id: String(usuario._id),
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role === 'admin' ? 'admin' : 'cliente',
    obras: Array.isArray(usuario.obras) ? usuario.obras.map(String) : [],
    // Superadmin (dono do sistema): invisível para os administradores da empresa.
    oculto: usuario.oculto === true
  }
  req.params.idUsuario = req.usuario.id

  return next()
}

export default middlewareTokenData
