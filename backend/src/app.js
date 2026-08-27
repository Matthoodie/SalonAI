import {
  errorHandler,
  notFoundHandler,
} from './middleware/errorHandler.js'

import express from 'express'

const app = express()

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'salonai-backend',
  })
})

app.use(notFoundHandler)
app.use(errorHandler)

export default app