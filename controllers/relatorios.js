import PDFDocument from 'pdfkit'
import repositoryProdutos from '../repositories/produtos.js'
import configError from '../configs/error.js'

/*
 * Relatório de estoque em PDF.
 *
 * O documento é levado para a obra impresso ou aberto no celular, então o
 * desenho segue a mesma hierarquia da tela: primeiro o que FALTA (bloco
 * vermelho, antes de tudo), depois o estoque por categoria em tabela.
 *
 * As cores são exatamente as do app (assets/css/variaveis.sass). O vermelho é
 * reservado a estoque baixo — se ele aparecer em qualquer outro lugar, perde o
 * significado e o relatório deixa de ser lido de relance.
 */
const COR = Object.freeze({
  marca: '#1B4965',
  texto: '#14181F',
  cinza: '#5B6470',
  linha: '#E1E6EC',
  gelo: '#F1F4F8',
  branco: '#FFFFFF',
  vermelho: '#C0362B',
  vermelhoFundo: '#F7E7E5',
  verde: '#0F7B3E'
})

const NOMES_CATEGORIA = Object.freeze({
  cimento: 'Cimento',
  ferro: 'Ferro',
  trelica: 'Treliças',
  outro: 'Outros produtos'
})

const ORDEM_CATEGORIAS = Object.freeze(['cimento', 'ferro', 'trelica', 'outro'])

// Mesmo vocabulário do frontend: "1 saco" / "12 sacos". Escrever "12 saco" num
// documento que vai para o fornecedor passa desleixo.
const UNIDADES = Object.freeze({
  saco: ['saco', 'sacos'],
  kg: ['kg', 'kg'],
  barra: ['barra', 'barras'],
  metro: ['metro', 'metros'],
  unidade: ['unidade', 'unidades']
})

const MARGEM = 42
const ALTURA_LINHA = 22
const ALTURA_RODAPE = 46

const formatadorNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

function formatarQuantidade(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? formatadorNumero.format(numero) : '0'
}

function rotuloUnidade(unidade, quantidade) {
  const par = UNIDADES[unidade]
  if (!par) return unidade || ''
  return Number(quantidade) === 1 ? par[0] : par[1]
}

function formatarDataHora(data) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

function nomeDoArquivo(data) {
  const iso = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(data)
  return `estoque-${iso}.pdf`
}

function agruparPorCategoria(produtos) {
  const grupos = new Map()
  for (const produto of produtos) {
    const lista = grupos.get(produto.categoria) || []
    lista.push(produto)
    grupos.set(produto.categoria, lista)
  }
  return grupos
}

function estaAbaixoDoMinimo(produto) {
  return produto.quantidadeAtual <= produto.quantidadeMinima
}

/*
 * Colunas por categoria. Ferro tem duas a mais (bitola e sobras) e por isso a
 * coluna do nome encolhe — é a única que aceita perder espaço sem truncar o
 * dado numérico, que é o que se confere de relance.
 */
function colunasDe(categoria) {
  if (categoria === 'ferro') {
    return [
      { chave: 'nome', titulo: 'Produto', largura: 170 },
      { chave: 'bitola', titulo: 'Bitola', largura: 55 },
      { chave: 'atual', titulo: 'Em estoque', largura: 85, alinhamento: 'right' },
      { chave: 'minimo', titulo: 'Mínimo', largura: 60, alinhamento: 'right' },
      { chave: 'sobras', titulo: 'Sobras', largura: 60, alinhamento: 'right' },
      { chave: 'situacao', titulo: 'Situação', largura: 81, alinhamento: 'right' }
    ]
  }

  return [
    { chave: 'nome', titulo: 'Produto', largura: 255 },
    { chave: 'atual', titulo: 'Em estoque', largura: 100, alinhamento: 'right' },
    { chave: 'minimo', titulo: 'Mínimo', largura: 75, alinhamento: 'right' },
    { chave: 'situacao', titulo: 'Situação', largura: 81, alinhamento: 'right' }
  ]
}

function valoresDaLinha(produto, categoria) {
  const valores = {
    nome: produto.nome,
    atual: `${formatarQuantidade(produto.quantidadeAtual)} ${rotuloUnidade(produto.unidade, produto.quantidadeAtual)}`,
    minimo: formatarQuantidade(produto.quantidadeMinima),
    situacao: estaAbaixoDoMinimo(produto) ? 'REPOR' : 'OK'
  }

  if (categoria === 'ferro') {
    valores.bitola = produto.bitola || '—'
    valores.sobras = produto.sobrasMetros > 0 ? `${formatarQuantidade(produto.sobrasMetros)} m` : '—'
  }

  return valores
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function larguraUtil(doc) {
  return doc.page.width - MARGEM * 2
}

function desenharCabecalho(doc, geradoEm, ehPrimeira) {
  const altura = ehPrimeira ? 86 : 48

  // Faixa sangrada até a borda: é o que dá cara de documento da empresa em vez
  // de texto solto numa folha.
  doc.rect(0, 0, doc.page.width, altura).fill(COR.marca)

  doc
    .fillColor(COR.branco)
    .font('Helvetica-Bold')
    .fontSize(ehPrimeira ? 20 : 13)
    .text('Relatório de Estoque', MARGEM, ehPrimeira ? 28 : 17)

  if (ehPrimeira) {
    doc.font('Helvetica').fontSize(10).fillColor('#C6D6E2').text('Eng Civil — controle de estoque da obra', MARGEM, 55)

    doc.fontSize(9).fillColor('#C6D6E2').text(`Gerado em ${geradoEm}`, MARGEM, 28, { width: larguraUtil(doc), align: 'right' })
  } else {
    doc.font('Helvetica').fontSize(9).fillColor('#C6D6E2').text(geradoEm, MARGEM, 21, { width: larguraUtil(doc), align: 'right' })
  }

  doc.y = altura + 24
  doc.x = MARGEM
  doc.fillColor(COR.texto)
}

function desenharResumo(doc, produtos, emFalta) {
  const largura = larguraUtil(doc)
  const altura = 54
  const topo = doc.y

  doc.roundedRect(MARGEM, topo, largura, altura, 8).fillAndStroke(COR.gelo, COR.linha)

  const celula = largura / 3
  const blocos = [
    { rotulo: 'Produtos cadastrados', valor: String(produtos.length), cor: COR.texto },
    { rotulo: 'Precisam de reposição', valor: String(emFalta.length), cor: emFalta.length ? COR.vermelho : COR.verde },
    { rotulo: 'Categorias em uso', valor: String(new Set(produtos.map((p) => p.categoria)).size), cor: COR.texto }
  ]

  blocos.forEach((bloco, indice) => {
    const x = MARGEM + celula * indice

    // Divisórias internas, exceto antes do primeiro bloco.
    if (indice > 0) {
      doc
        .moveTo(x, topo + 12)
        .lineTo(x, topo + altura - 12)
        .lineWidth(1)
        .stroke(COR.linha)
    }

    doc.font('Helvetica-Bold').fontSize(16).fillColor(bloco.cor).text(bloco.valor, x + 16, topo + 12, { width: celula - 32 })
    doc.font('Helvetica').fontSize(8.5).fillColor(COR.cinza).text(bloco.rotulo.toUpperCase(), x + 16, topo + 33, { width: celula - 32, characterSpacing: 0.4 })
  })

  doc.y = topo + altura + 20
  doc.x = MARGEM
}

/*
 * Bloco de reposição — a razão de existir do relatório.
 *
 * Vem ANTES das tabelas de propósito: quem abre o PDF quer saber o que
 * comprar, não conferir o que está sobrando.
 */
function desenharAlertas(doc, emFalta) {
  if (emFalta.length === 0) return

  const largura = larguraUtil(doc)
  const altura = 34 + emFalta.length * 16 + 12
  const topo = doc.y

  doc.roundedRect(MARGEM, topo, largura, altura, 8).fillAndStroke(COR.vermelhoFundo, COR.vermelho)

  const titulo = emFalta.length === 1 ? '1 produto precisa de reposição' : `${emFalta.length} produtos precisam de reposição`
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COR.vermelho).text(titulo, MARGEM + 16, topo + 14)

  let y = topo + 34
  for (const produto of emFalta) {
    const nome = produto.bitola ? `${produto.nome} · ${produto.bitola}` : produto.nome
    const quantidade = `${formatarQuantidade(produto.quantidadeAtual)} de ${formatarQuantidade(produto.quantidadeMinima)} ${rotuloUnidade(produto.unidade, produto.quantidadeMinima)}`

    doc.font('Helvetica').fontSize(9.5).fillColor(COR.texto).text(`${NOMES_CATEGORIA[produto.categoria] || produto.categoria}: ${nome}`, MARGEM + 16, y, { width: largura - 190, ellipsis: true, lineBreak: false })
    doc.font('Helvetica-Bold').fillColor(COR.vermelho).text(quantidade, MARGEM + largura - 174, y, { width: 158, align: 'right' })

    y += 16
  }

  doc.y = topo + altura + 22
  doc.x = MARGEM
}

function desenharTituloCategoria(doc, categoria, itens) {
  const emFalta = itens.filter(estaAbaixoDoMinimo).length

  doc.font('Helvetica-Bold').fontSize(13).fillColor(COR.marca).text(NOMES_CATEGORIA[categoria] || categoria, MARGEM, doc.y)

  const contagem = `${itens.length} ${itens.length === 1 ? 'produto' : 'produtos'}${emFalta ? ` · ${emFalta} abaixo do mínimo` : ''}`
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(emFalta ? COR.vermelho : COR.cinza)
    .text(contagem, MARGEM, doc.y - 13, { width: larguraUtil(doc), align: 'right' })

  doc.y += 6
}

function desenharCabecalhoTabela(doc, colunas) {
  const topo = doc.y
  doc.rect(MARGEM, topo, larguraUtil(doc), ALTURA_LINHA).fill(COR.marca)

  let x = MARGEM
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COR.branco)

  for (const coluna of colunas) {
    doc.text(coluna.titulo.toUpperCase(), x + 10, topo + 7, {
      width: coluna.largura - 20,
      align: coluna.alinhamento || 'left',
      ellipsis: true,
      lineBreak: false
    })
    x += coluna.largura
  }

  doc.y = topo + ALTURA_LINHA
}

function desenharLinha(doc, produto, categoria, colunas, indice) {
  const topo = doc.y
  const falta = estaAbaixoDoMinimo(produto)
  const largura = larguraUtil(doc)

  // Zebra + destaque: a linha em falta ganha fundo vermelho claro e uma barra
  // na lateral. Quem imprime em preto e branco continua enxergando o destaque
  // pela barra, não só pela cor.
  if (falta) {
    doc.rect(MARGEM, topo, largura, ALTURA_LINHA).fill(COR.vermelhoFundo)
    doc.rect(MARGEM, topo, 3, ALTURA_LINHA).fill(COR.vermelho)
  } else if (indice % 2 === 1) {
    doc.rect(MARGEM, topo, largura, ALTURA_LINHA).fill(COR.gelo)
  }

  const valores = valoresDaLinha(produto, categoria)
  let x = MARGEM

  for (const coluna of colunas) {
    const ehSituacao = coluna.chave === 'situacao'
    const ehNome = coluna.chave === 'nome'

    doc
      .font(ehNome || ehSituacao ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9.5)
      .fillColor(falta && (ehSituacao || ehNome) ? COR.vermelho : ehSituacao ? COR.verde : COR.texto)
      .text(valores[coluna.chave] ?? '—', x + 10, topo + 7, {
        width: coluna.largura - 20,
        align: coluna.alinhamento || 'left',
        ellipsis: true,
        lineBreak: false
      })

    x += coluna.largura
  }

  doc
    .moveTo(MARGEM, topo + ALTURA_LINHA)
    .lineTo(MARGEM + largura, topo + ALTURA_LINHA)
    .lineWidth(0.5)
    .stroke(COR.linha)

  doc.y = topo + ALTURA_LINHA
}

// Espaço que ainda cabe antes de invadir o rodapé.
function cabeNaPagina(doc, altura) {
  return doc.y + altura <= doc.page.height - ALTURA_RODAPE
}

function desenharObservacoes(doc, produto) {
  if (!produto.observacoes) return

  const texto = `${produto.nome}: ${produto.observacoes}`
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(COR.cinza).text(texto, MARGEM + 10, doc.y + 4, { width: larguraUtil(doc) - 20, ellipsis: true, lineBreak: false })
  doc.y += 6
}

function desenharTabela(doc, categoria, itens, geradoEm) {
  const colunas = colunasDe(categoria)

  // Título + cabeçalho + uma linha: se isso não couber, a categoria começa na
  // página seguinte. Cabeçalho órfão no fim da folha é o defeito clássico de
  // relatório gerado em laço.
  if (!cabeNaPagina(doc, 30 + ALTURA_LINHA * 2)) {
    doc.addPage()
    desenharCabecalho(doc, geradoEm, false)
  }

  desenharTituloCategoria(doc, categoria, itens)
  desenharCabecalhoTabela(doc, colunas)

  itens.forEach((produto, indice) => {
    if (!cabeNaPagina(doc, ALTURA_LINHA)) {
      doc.addPage()
      desenharCabecalho(doc, geradoEm, false)
      desenharCabecalhoTabela(doc, colunas)
    }

    desenharLinha(doc, produto, categoria, colunas, indice)
    desenharObservacoes(doc, produto)
  })

  doc.y += 18
  doc.x = MARGEM
}

function desenharRodapes(doc) {
  const intervalo = doc.bufferedPageRange()

  for (let i = 0; i < intervalo.count; i++) {
    doc.switchToPage(intervalo.start + i)

    const y = doc.page.height - 32

    /*
     * `y` (altura - 32) fica ABAIXO do limite de conteúdo da página
     * (altura - margem inferior de 42px). Escrever ali faz o PDFKit achar que
     * o texto não coube e criar uma página nova sozinho — com duas chamadas
     * de `.text()` no rodapé, viravam duas páginas em branco no fim do
     * documento. Zerar a margem inferior só durante o desenho do rodapé é o
     * jeito padrão do PDFKit de liberar essa faixa sem disparar quebra de página.
     */
    const margemOriginal = doc.page.margins.bottom
    doc.page.margins.bottom = 0

    doc
      .moveTo(MARGEM, y - 10)
      .lineTo(doc.page.width - MARGEM, y - 10)
      .lineWidth(0.5)
      .stroke(COR.linha)

    doc.font('Helvetica').fontSize(8).fillColor(COR.cinza).text('Eng Civil — documento gerado pelo sistema de controle de estoque', MARGEM, y, { width: larguraUtil(doc) / 2, lineBreak: false })

    doc.text(`Página ${i + 1} de ${intervalo.count}`, MARGEM + larguraUtil(doc) / 2, y, { width: larguraUtil(doc) / 2, align: 'right', lineBreak: false })

    doc.page.margins.bottom = margemOriginal
  }
}

async function estoquePdf(req, res) {
  try {
    const produtos = await repositoryProdutos.listar()
    const grupos = agruparPorCategoria(produtos)
    const emFalta = produtos.filter(estaAbaixoDoMinimo)
    const agora = new Date()
    const geradoEm = formatarDataHora(agora)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${nomeDoArquivo(agora)}"`)

    /*
     * `bufferPages` é o que permite escrever "Página 1 de 4": sem ele o total
     * só se conhece quando o documento já foi transmitido, e o rodapé teria de
     * mentir ou omitir o total.
     *
     * `autoFirstPage: false` porque a primeira página é criada logo abaixo já
     * com o cabeçalho — senão sobraria uma folha em branco no começo.
     */
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
      bufferPages: true,
      autoFirstPage: false,
      info: {
        Title: 'Relatório de Estoque — Eng Civil',
        Author: 'Eng Civil',
        Subject: `Posição do estoque em ${geradoEm}`
      }
    })

    doc.pipe(res)

    doc.addPage()
    desenharCabecalho(doc, geradoEm, true)

    if (produtos.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor(COR.cinza).text('Nenhum produto cadastrado no estoque.', MARGEM, doc.y)
    } else {
      desenharResumo(doc, produtos, emFalta)
      desenharAlertas(doc, emFalta)

      for (const categoria of ORDEM_CATEGORIAS) {
        const itens = grupos.get(categoria)
        if (!itens || itens.length === 0) continue

        // Em falta primeiro, depois alfabético — a mesma ordem da tela, para
        // quem compara o papel com o celular não se perder.
        const ordenados = [...itens].sort((a, b) => {
          const faltaA = estaAbaixoDoMinimo(a)
          const faltaB = estaAbaixoDoMinimo(b)
          if (faltaA !== faltaB) return faltaA ? -1 : 1
          return String(a.nome).localeCompare(String(b.nome), 'pt-BR')
        })

        desenharTabela(doc, categoria, ordenados, geradoEm)
      }
    }

    desenharRodapes(doc)
    doc.end()
  } catch (error) {
    return configError.capture(res, error)
  }
}

export default { estoquePdf }
