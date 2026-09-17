import { Router } from 'express'
import controllerIndex from '../controllers/index.js'

const router = Router()

router.get('/', controllerIndex.index)
router.get('/hoje', controllerIndex.hoje)

export default router
