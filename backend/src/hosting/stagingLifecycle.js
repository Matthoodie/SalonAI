import http from 'node:http'

export async function startStagingHttp({ app, pool, port, signals = process, log = console.log,
  exit = code => process.exit(code), shutdownMs = 8000, host = '0.0.0.0' }) {
  let stopping = false
  let shutdownPromise
  const server = http.createServer((req, res) => {
    if (stopping) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end('{"error":{"code":"STAGING_UNAVAILABLE"}}')
      return
    }
    app(req, res)
  })
  server.requestTimeout = 30000
  server.headersTimeout = 15000
  server.keepAliveTimeout = 5000
  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise
    stopping = true
    shutdownPromise = (async () => {
      const deadline = setTimeout(() => {
        server.closeAllConnections()
        exit(1)
      }, shutdownMs)
      deadline.unref()
      try {
        await new Promise(resolve => {
          server.close(resolve)
          server.closeIdleConnections()
        })
        await pool.end()
        log('ZRIHTAN staging stopped.')
        exit(0)
      } catch {
        log('ZRIHTAN staging shutdown failed.')
        exit(1)
      } finally {
        clearTimeout(deadline)
        signals.removeListener('SIGTERM', shutdown)
        signals.removeListener('SIGINT', shutdown)
      }
    })()
    return shutdownPromise
  }
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  server.on('error', () => { log('ZRIHTAN staging HTTP error.'); void shutdown() })
  signals.on('SIGTERM', shutdown)
  signals.on('SIGINT', shutdown)
  log('ZRIHTAN staging HTTP ready.')
  return { server, shutdown, isStopping: () => stopping }
}
