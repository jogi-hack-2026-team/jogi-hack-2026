import { buildApp } from './app.js'

const app = buildApp()

try {
  await app.listen({ host: '127.0.0.1', port: 3000 })
} catch {
  console.error('APIを起動できませんでした。port 3000の使用状況を確認してください。')
  process.exitCode = 1
}
