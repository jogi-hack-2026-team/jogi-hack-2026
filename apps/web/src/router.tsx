import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { HealthPage } from './routes/HealthPage.tsx';
import { Home } from './routes/Home.tsx';

function Layout() {
  return (
    <main>
      <header>
        <h1>Future ROI</h1>
        <nav aria-label="主要">
          <Link to="/">ホーム</Link> <Link to="/health">接続確認</Link>
        </nav>
      </header>
      <Outlet />
    </main>
  );
}

const rootRoute = createRootRoute({ component: Layout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home });
const healthRoute = createRoute({ getParentRoute: () => rootRoute, path: '/health', component: HealthPage });

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, healthRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
