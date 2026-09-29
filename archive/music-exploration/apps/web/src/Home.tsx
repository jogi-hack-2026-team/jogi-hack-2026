import { useEffect, useState } from 'react'

type ApiState = 'checking' | 'ready' | 'unreachable'

export function Home() {
  const [apiState, setApiState] = useState<ApiState>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        setApiState(response.ok ? 'ready' : 'unreachable')
      })
      .catch(() => {
        if (!controller.signal.aborted) setApiState('unreachable')
      })
    return () => controller.abort()
  }, [])

  const status = {
    checking: '確認中',
    ready: '接続できています',
    unreachable: '接続できません。APIを起動してください',
  }[apiState]

  return (
    <main>
      <h1>JOGI HACK 2026</h1>
      <p>開発環境の起動確認画面です。プロダクト機能はこれから実装します。</p>
      <p role="status" aria-live="polite">API: {status}</p>
    </main>
  )
}
