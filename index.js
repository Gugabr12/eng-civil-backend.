// Entrypoint do servidor — local (porta fixa 8810, ver
// ~/.claude/rules/dev-servers.md) e em produção (Render, porta via
// process.env.PORT). Fala com o Firestore Emulator em dev
// (FIRESTORE_EMULATOR_HOST no .env) e com o Firestore real em produção.
import server from './bin/server.js'
import error from './bin/error.js'
import criarApp from './app.js'

const app = criarApp()
server.listen(app)
error.handle()
