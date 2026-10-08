import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient, describeAuthError } from './auth/client.ts';
import { runAuthAction } from './auth/action.ts';
import { authSearch } from './auth/redirect.ts';
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
          <Link to="/">ホーム</Link> <Link to="/goals">Goal一覧</Link> <Link to="/health">接続確認</Link>{' '}
          {session.isPending ? null : session.data ? (
            <>
              <span data-testid="session">{session.data.user.email}</span>{' '}
              <button type="button" onClick={logout} disabled={logoutBusy}>
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link to="/login" search={{ redirect: '/goals' }}>ログイン</Link> <Link to="/register" search={{ redirect: '/goals' }}>登録</Link>
            </>
          )}
        </nav>
        {logoutError && <p role="alert">{logoutError}</p>}
      </header>
      <Outlet />
    </main>
  );
}

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // 依頼者承認の公開トップ。下のGoal4画面はrequireSignInを維持する。
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

// Goalの画面は実APIを使うので、未ログインは戻り先を保持してログイン画面へ送る。
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

// Today Decision（#81）。
const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/goals/$goalId',
  beforeLoad: requireSignIn,
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
