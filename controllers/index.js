import NodeResponse from 'densyy-node-toolbox/core/tools/node-response.js'
import packageJson from '../package.json' with { type: 'json' }

const nodeResponse = new NodeResponse()

function index (_req, res) {
  const { version, name } = packageJson
  return nodeResponse.success(res, `Bem vindo à ${name} (${version})`)
}

function hoje (_req, res) {
  const agora = new Date()
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const partes = Object.fromEntries(fmt.formatToParts(agora).map((p) => [p.type, p.value]))
  return nodeResponse.success(res, {
    dataISO: agora.toISOString(),
    dataBR: `${partes.day}/${partes.month}/${partes.year}`,
    dia: partes.day,
    mes: partes.month,
    ano: partes.year,
    hora: partes.hour,
    minuto: partes.minute,
    segundo: partes.second,
    timezone: 'America/Sao_Paulo'
  })
}

export default { index, hoje }
