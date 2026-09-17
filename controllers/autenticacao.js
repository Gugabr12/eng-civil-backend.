import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import NodeJWT from 'densyy-node-toolbox/core/tools/node-jwt.js'
import NodePassword from 'densyy-node-toolbox/core/tools/node-password.js'
import repositoryUsuarios from '../repositories/usuarios.js'
import configError from '../configs/error.js'

const nodeResponse = new NodeResponse()
const nodeJWT = new NodeJWT()
const nodePassword = new NodePassword()

// Hash "morto" (bcrypt de uma string qualquer) só para gastar o mesmo tempo
// de CPU que um `compare` real quando o e-mail não existe — sem isso, login
// com e-mail inexistente responde bem mais rápido que senha errada, e esse
// atraso vira oráculo de "essa conta existe?".
let HASH_FALSO = null
async function hashFalso() {
  if (!HASH_FALSO) HASH_FALSO = await nodePassword.toHash('sem-conta-com-este-email', process.env.BCRYPT_KEY)
  return HASH_FALSO
}

/*
 * Lockout por CONTA (chave = e-mail), separado do rate limit por IP em
 * `middlewares/rateLimit.js`. O de IP sozinho é contornável mandando um
 * `X-Forwarded-For` diferente a cada tentativa; travar por e-mail não liga
 * pra quantos IPs o atacante usa.
 *
 * Em memória do processo — funciona porque hoje roda uma instância só. Se um
 * dia isto escalar horizontalmente, precisa virar um store compartilhado
 * (Redis), senão cada instância conta separado e o limite efetivo multiplica
 * pelo número de instâncias.
 */
const tentativasFalhas = new Map()
const MAX_TENTATIVAS = 5
const JANELA_BLOQUEIO_MS = 15 * 60 * 1000

function chaveTentativa(email) {
  return String(email || '').trim().toLowerCase()
}

function estaBloqueado(email) {
  const registro = tentativasFalhas.get(chaveTentativa(email))
  if (!registro?.bloqueadoAte) return 0
  const restanteMs = registro.bloqueadoAte - Date.now()
  return restanteMs > 0 ? restanteMs : 0
}

function registrarFalha(email) {
  const chave = chaveTentativa(email)
  const registro = tentativasFalhas.get(chave) || { count: 0, bloqueadoAte: 0 }
  registro.count += 1
  if (registro.count >= MAX_TENTATIVAS) {
    registro.bloqueadoAte = Date.now() + JANELA_BLOQUEIO_MS
    registro.count = 0
  }
  tentativasFalhas.set(chave, registro)
}

function limparTentativas(email) {
  tentativasFalhas.delete(chaveTentativa(email))
}

// Só 2 contas, criadas pelo admin — sem autocadastro público e sem o desafio
// por e-mail em duas etapas (aquele fluxo existe para proteger uma base de
// clientes/pagamentos; aqui a superfície de ataque é outra).
function emitirToken(usuario) {
  const secret = process.env.TOKEN_USUARIO
  return nodeJWT.generateToken({ idUsuario: usuario._id, role: usuario.role }, secret)
}

async function entrar(req, res) {
  const { body } = req

  try {
    const bloqueioMs = estaBloqueado(body.email)
    if (bloqueioMs > 0) {
      const minutos = Math.ceil(bloqueioMs / 60000)
      return nodeResponse.simpleError(res, 429, `Muitas tentativas para esta conta. Tente novamente em ${minutos} minuto(s).`)
    }

    const usuario = await repositoryUsuarios.receberPorEmail(body.email)
    const key = process.env.BCRYPT_KEY

    // Senha é conferida ANTES de olhar `ativo` — e mesmo quando a conta não
    // existe, ainda rodamos um `compare` contra um hash morto. As duas coisas
    // seguram o mesmo tempo de resposta e a mesma mensagem (422) para "não
    // existe", "senha errada" e "existe mas está desativada com senha
    // errada" — só quem acerta a senha de uma conta desativada aprende que
    // ela está desativada, e nesse ponto a informação já não vale nada.
    const senhaOk = usuario?.senha
      ? await nodePassword.compare(body.senha, usuario.senha, key)
      : await nodePassword.compare(body.senha, await hashFalso(), key).then(() => false)

    if (!usuario || !senhaOk) {
      registrarFalha(body.email)
      return nodeResponse.simpleError(res, 422, 'Email ou senha inválidos.')
    }

    if (usuario.ativo === false) {
      return nodeResponse.simpleError(res, 403, 'Esta conta está desativada.')
    }

    limparTentativas(body.email)
    await repositoryUsuarios.alterarUltimoAcesso(usuario._id)

    return nodeResponse.success(res, {
      token: emitirToken(usuario),
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role
      }
    })
  } catch (error) {
    return configError.capture(res, error)
  }
}

async function eu(req, res) {
  try {
    const usuario = await repositoryUsuarios.receberPorID(req.usuario.id)
    if (!usuario) return nodeResponse.simpleError(res, 404, 'Usuário não encontrado.')
    return nodeResponse.success(res, usuario)
  } catch (error) {
    return configError.capture(res, error)
  }
}

export default {
  entrar,
  eu
}
