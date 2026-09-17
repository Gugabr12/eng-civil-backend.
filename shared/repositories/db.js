/**
 * Wrapper de acesso a dados — versão Firestore (Admin SDK).
 *
 * Antes este arquivo delegava tudo pro Mongoose (ver histórico do repo). A
 * migração pro Firebase trocou só esta camada: mantém a MESMA interface
 * pública (findOne/filter/exists/count/add/addMany/edit/editMany/del/delMany)
 * pra que os repositories de domínio (usuarios/produtos/movimentacoes) quase
 * não precisassem mudar. `aggregate`/`editAtomic`/`bulk` da versão antiga não
 * tinham uso fora dos 4 casos de estoque que agora usam `runTransaction()`
 * direto em `repositories/produtos.js` (mais simples de auditar do que
 * generalizar operadores estilo Mongo pro Firestore).
 *
 * A instância do Firestore é injetada (mesma ideia da versão Mongoose): quem
 * consome faz, uma vez, no seu `repositories/db.js` local:
 *
 *   import configFirestore from '../configs/firestore.js'
 *   import criarDB from '../shared/repositories/db.js'
 *   export default criarDB(configFirestore.obterFirestore())
 *
 * `new DB('produtos')` aponta pra uma collection do Firestore pelo nome —
 * todo documento retornado inclui `_id: <id do documento>` pra manter o
 * mesmo contrato que o resto do sistema (e o frontend) já espera.
 */
export default function criarDB(firestore) {
  function aplicarFiltros(query, filters = {}) {
    let resultado = query
    for (const [campo, valor] of Object.entries(filters || {})) {
      resultado = resultado.where(campo, '==', valor)
    }
    return resultado
  }

  return class DB {
    constructor(colecao) {
      this.colecao = firestore.collection(colecao)
    }

    async findOne(filters = {}) {
      if (filters?._id) {
        const doc = await this.colecao.doc(String(filters._id)).get()
        if (!doc.exists) return null

        const dados = { _id: doc.id, ...doc.data() }
        const { _id, ...extras } = filters
        for (const [campo, valor] of Object.entries(extras)) {
          if (dados[campo] !== valor) return null
        }
        return dados
      }

      const snap = await aplicarFiltros(this.colecao, filters).limit(1).get()
      if (snap.empty) return null

      const doc = snap.docs[0]
      return { _id: doc.id, ...doc.data() }
    }

    async filter(filters, select, sort, limite) {
      let query = aplicarFiltros(this.colecao, filters)

      if (sort) {
        for (const [campo, direcao] of Object.entries(sort)) {
          query = query.orderBy(campo, direcao === -1 ? 'desc' : 'asc')
        }
      }
      if (limite) query = query.limit(limite)

      const snap = await query.get()
      return snap.docs.map((doc) => ({ _id: doc.id, ...doc.data() }))
    }

    async exists(filters) {
      return !!(await this.findOne(filters))
    }

    async count(filters) {
      const snap = await aplicarFiltros(this.colecao, filters).count().get()
      return snap.data().count
    }

    async add(payload) {
      const ref = await this.colecao.add(payload)
      return { _id: ref.id, ...payload }
    }

    async addMany(payloads) {
      const batch = firestore.batch()
      const refs = payloads.map((payload) => {
        const ref = this.colecao.doc()
        batch.set(ref, payload)
        return ref
      })
      await batch.commit()
      return refs.map((ref, indice) => ({ _id: ref.id, ...payloads[indice] }))
    }

    // Lê, confere os filtros extras (além de `_id`) contra o documento atual e
    // só então escreve — equivalente ao filtro de guarda que o
    // `findOneAndUpdate` do Mongo fazia numa operação só. Retorna o documento
    // JÁ atualizado, ou `null` quando não existe ou os filtros extras não batem.
    async edit(filters, payload) {
      const { _id, ...extras } = filters
      const ref = this.colecao.doc(String(_id))

      const antes = await ref.get()
      if (!antes.exists) return null

      const atual = antes.data()
      for (const [campo, valor] of Object.entries(extras)) {
        if (atual[campo] !== valor) return null
      }

      await ref.update(payload)
      const depois = await ref.get()
      return { _id: depois.id, ...depois.data() }
    }

    async editMany(filters, payload) {
      const snap = await aplicarFiltros(this.colecao, filters).get()
      const batch = firestore.batch()
      snap.docs.forEach((doc) => batch.update(doc.ref, payload))
      await batch.commit()
      return snap.size
    }

    async del(filters) {
      const doc = await this.findOne(filters)
      if (!doc) return null
      await this.colecao.doc(doc._id).delete()
      return doc
    }

    async delMany(filters) {
      const snap = await aplicarFiltros(this.colecao, filters).get()
      const batch = firestore.batch()
      snap.docs.forEach((doc) => batch.delete(doc.ref))
      await batch.commit()
      return snap.size
    }
  }
}
