import admin from 'firebase-admin'

let inicializado = false

/*
 * `admin.initializeApp()` é síncrono e não abre conexão de verdade — o
 * Firestore é HTTP por baixo dos panos, então não existe "falha ao conectar
 * no boot" como havia com o Mongoose (por isso não há `.catch`/`process.exit`
 * aqui).
 *
 * O backend roda fora do Google Cloud (self-hosted no Render, pra não
 * depender do plano Blaze) — sem credencial automática do ambiente, então
 * precisa de uma service account explícita em produção
 * (`FIREBASE_SERVICE_ACCOUNT_JSON`, o conteúdo inteiro do JSON baixado no
 * console do Firebase, como variável de ambiente).
 *
 * Em desenvolvimento local, `FIRESTORE_EMULATOR_HOST` (setado no `.env`)
 * redireciona todo o SDK pro Firestore Emulator antes mesmo de checar
 * credencial — por isso não precisa de service account pra rodar local.
 */
function conectar() {
  if (inicializado) return

  const options = { projectId: process.env.FIREBASE_PROJECT_ID }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    options.credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  }

  admin.initializeApp(options)
  inicializado = true
}

function obterFirestore() {
  conectar()
  return admin.firestore()
}

export default { conectar, obterFirestore }
