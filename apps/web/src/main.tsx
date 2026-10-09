import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivateCacheGuard } from './api/session-cache.ts';
import { router } from './router.tsx';
// 書体（Zen Maru Gothic）はビルドに含めて同じ origin から配信する（外部へ通信しない、#146）。使う太さだけを読む
import '@fontsource/zen-maru-gothic/400.css';
import '@fontsource/zen-maru-gothic/500.css';
import '@fontsource/zen-maru-gothic/700.css';
import './styles.css';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('root element is missing');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* ログインしている人が変わったら、前の人の Goal・記録・予測をキャッシュから消す */}
      <PrivateCacheGuard />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
