import { Router } from 'express'
import controllerError from '../controllers/error.js'

const router = Router()

router.use('/', controllerError.error)

export default router
