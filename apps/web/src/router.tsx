import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient, describeAuthError } from './auth/client.ts';
import { runAuthAction } from './auth/action.ts';
import { AuthForm } from './routes/AuthForm.tsx';
import { HealthPage } from './routes/HealthPage.tsx';
import { Home } from './routes/Home.tsx';
import { TodayPage } from './features/today/TodayPage.tsx';
import { GoalCreatePage, GoalEditPage } from './features/goals/GoalFormPage.tsx';
import { GoalListPage } from './features/goals/GoalListPage.tsx';

function Layout() {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  async function logout() {
    if (logoutBusy) return;
    setLogoutError(null);
    await runAuthAction(() => authClient.signOut(), {
      setBusy: setLogoutBusy,
      onError: (failure) => setLogoutError(describeAuthError(failure.code, failure.message)),
      onSuccess: () => navigate({ to: '/login', search: { redirect: '/' } }),
    });
  }
  return (
    <main>
      <header>
        <h1>Future ROI</h1>
        <nav aria-label="主要">
          <Link to="/">ホーム</Link> <Link to="/health">接続確認</Link>{' '}
          {session.isPending ? null : session.data ? (
            <>
              <span data-testid="session">{session.data.user.email}</span>{' '}
              <button type="button" onClick={logout} disabled={logoutBusy}>
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link to="/login" search={{ redirect: '/' }}>ログイン</Link> <Link to="/register" search={{ redirect: '/' }}>登録</Link>
            </>
          )}
        </nav>
        {logoutError && <p role="alert">{logoutError}</p>}
      </header>
      <Outlet />
    </main>
  );
}

// ログイン後の戻り先は同一アプリ内のpathだけに限定する（外部URLへの転送を防ぐ）。
const authSearch = (search: Record<string, unknown>) => ({
  redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//') ? search.redirect : '/',
});

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // 未ログインはログイン画面へ。戻り先を引き継ぐ。
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) throw redirect({ to: '/login', search: { redirect: location.href } });
  },
  component: Home,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: authSearch,
  component: function LoginPage() {
    const { redirect: redirectTo } = loginRoute.useSearch();
    return <AuthForm mode="login" redirectTo={redirectTo} />;
  },
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: authSearch,
  component: function RegisterPage() {
    const { redirect: redirectTo } = registerRoute.useSearch();
    return <AuthForm mode="register" redirectTo={redirectTo} />;
  },
});

const healthRoute = createRoute({ getParentRoute: () => rootRoute, path: '/health', component: HealthPage });

// Goal の一覧・作成・編集（#78）。実APIを使うので、未ログインはホームと同じくログイン画面へ送る。
const requireSignIn = async ({ location }: { location: { href: string } }) => {
  const session = await authClient.getSession();
  if (!session.data) throw redirect({ to: '/login', search: { redirect: location.href } });
};

const goalsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/goals', beforeLoad: requireSignIn, component: GoalListPage });

const goalNewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/goals/new', beforeLoad: requireSignIn, component: GoalCreatePage });

const goalEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/goals/$goalId/edit',
  beforeLoad: requireSignIn,
  component: function GoalEditRoute() {
    const { goalId } = goalEditRoute.useParams();
    return <GoalEditPage goalId={goalId} />;
  },
});

// Today Decision（#81）。いまは仮APIで表示する（限定先行。実APIとの結合は#70の基盤が揃ってから）。
const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/goals/$goalId',
  component: function TodayRoute() {
    const { goalId } = todayRoute.useParams();
    return <TodayPage goalId={goalId} />;
  },
});

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, loginRoute, registerRoute, healthRoute, todayRoute, goalsRoute, goalNewRoute, goalEditRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
