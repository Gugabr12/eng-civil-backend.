import configFirestore from '../configs/firestore.js'
import criarDB from '../shared/repositories/db.js'

/**
 * Wrapper de acesso a dados.
 *
 * A implementação vive em `shared/repositories/db.js` — aqui só injetamos a
 * instância do Firestore deste serviço.
 */
export default criarDB(configFirestore.obterFirestore())
