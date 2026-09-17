/*
 * Cria o primeiro usuário admin. Rodar uma vez, manualmente:
 *
 *   npm run seed:admin -- "Seu Nome" seu@email.com "senha-forte"
 *
 * Não existe cadastro público neste sistema — toda conta nasce por aqui ou
 * pela tela de admin (POST /usuarios, que exige já estar logado como admin).
 * Este script é só para destravar a PRIMEIRA conta, quando o banco está vazio.
 *
 * O `.env` é carregado via `node --env-file` (ver script `seed:admin` do
 * package.json), não por `dotenv` aqui dentro: em ESM os imports são hoisted
 * e `repositories/usuarios.js` já inicializa o Firestore no momento em que é
 * importado — um `dotenv.config()` depois do import chegaria tarde demais.
 */
import NodePassword from 'densyy-node-toolbox/core/tools/node-password.js'
import repositoryUsuarios from '../repositories/usuarios.js'

const nodePassword = new NodePassword()

async function main() {
  const [nome, email, senha] = process.argv.slice(2)

  if (!nome || !email || !senha) {
    console.error('Uso: node bin/seed-admin.js "Nome" email@exemplo.com senha')
    process.exit(1)
  }

  if (senha.length < 10) {
    console.error('A senha precisa ter pelo menos 10 caracteres.')
    process.exit(1)
  }

  const jaExiste = await repositoryUsuarios.exists({ email })
  if (jaExiste) {
    console.error(`Já existe uma conta com o email ${email}.`)
    process.exit(1)
  }

  const senhaHash = await nodePassword.toHash(senha, process.env.BCRYPT_KEY)
  await repositoryUsuarios.adicionar({ nome, email, senha: senhaHash, role: 'admin' })

  console.info(`Admin criado: ${email}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
