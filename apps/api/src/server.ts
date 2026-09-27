import { buildApp } from './app.js'

const app = buildApp()

try {
  const host = process.env.JOGI_API_HOST === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1'
  await app.listen({ host, port: 3000 })
} catch {
  console.error('APIを起動できませんでした。port 3000の使用状況を確認してください。')
  process.exitCode = 1
}
