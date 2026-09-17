/*
 * Libera a porta do dev server antes de subir.
 *
 * O `predev` original era uma linha de shell com `lsof` — e o npm executa
 * scripts pelo cmd.exe no Windows, onde aquilo morria em
 * "'PIDS' não é reconhecido como um comando interno", derrubando o `npm run
 * dev` inteiro antes de o Nuxt começar. Este arquivo faz o mesmo nos dois
 * sistemas.
 *
 * Nunca falha: se não achar processo (ou não puder matar), sai com 0 — travar
 * o start por causa da limpeza seria pior do que a porta ocupada, que o Nuxt
 * reporta sozinho.
 */
import { execSync } from 'node:child_process'

const porta = process.argv[2] || '8800'
const ehWindows = process.platform === 'win32'

function pidsNaPorta() {
  try {
    if (ehWindows) {
      const saida = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${porta}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      return [
        ...new Set(
          saida
            .split(/\r?\n/)
            .map((linha) => linha.trim().split(/\s+/).pop())
            .filter((pid) => pid && pid !== '0')
        )
      ]
    }

    const saida = execSync(`lsof -ti tcp:${porta}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return saida.split(/\r?\n/).filter(Boolean)
  } catch {
    // Nenhum processo escutando: os dois comandos saem com status 1 nesse caso.
    return []
  }
}

for (const pid of pidsNaPorta()) {
  try {
    execSync(ehWindows ? `taskkill /PID ${pid} /F /T` : `kill -9 ${pid}`, { stdio: 'ignore' })
    console.log(`porta ${porta} liberada (PID ${pid})`)
  } catch {
    // Processo de outro usuário ou que já morreu — segue o jogo.
  }
}
