import fastify from 'fastify'

export function buildApp() {
  const app = fastify({ logger: false })

  app.get('/api/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', enum: ['ok'] } },
        },
      },
    },
  }, async () => ({ status: 'ok' }))

  return app
}
