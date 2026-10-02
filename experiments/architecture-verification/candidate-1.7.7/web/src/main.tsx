// Supporting Artifact / Not a Source of Truth (Issue #84). Minimal screens, no design.
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider, useNavigate } from '@tanstack/react-router';
import { createAuthClient } from 'better-auth/react';
import { StrictMode, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError } from './api.ts';

const auth = createAuthClient();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (n, e) => !(e instanceof ApiError && [401, 404, 422].includes(e.status)) && n < 2 } },
});

function Root() {
  const session = auth.useSession();
  const navigate = useNavigate();
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 560, margin: '2rem auto', padding: '0 16px' }}>
      <h1>Future ROI spike</h1>
      <p data-testid="session">{session.isPending ? 'checking…' : session.data ? `signed in: ${session.data.user.email}` : 'signed out'}</p>
      {session.data && (
        <p>
          <Link to="/goals">Goals</Link>{' '}
          <button
            onClick={async () => {
              await auth.signOut();
              queryClient.clear();
              await navigate({ to: '/' });
            }}
          >
            Sign out
          </button>
        </p>
      )}
      <Outlet />
    </main>
  );
}

function Home() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    const password = String(f.get('password'));
    const mode = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    const r = mode === 'up' ? await auth.signUp.email({ email, password, name: email.split('@')[0] }) : await auth.signIn.email({ email, password });
    if (r.error) setError(`${r.error.status} ${r.error.message ?? ''}`);
    else await navigate({ to: '/goals' });
  }
  return (
    <form onSubmit={submit}>
      <p><label>Email <input name="email" type="email" required /></label></p>
      <p><label>Password <input name="password" type="password" required minLength={12} /></label></p>
      <button name="mode" value="in">Sign in</button> <button name="mode" value="up">Register</button>
      <p role="alert">{error}</p>
    </form>
  );
}

function Goals() {
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ['goals'], queryFn: api.listGoals });
  const create = useMutation({
    mutationFn: (title: string) =>
      api.createGoal({ title, unit: 'minutes', totalRequired: 6000, sessionAmount: 30, initialProgress: 0, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
  if (goals.error instanceof ApiError && goals.error.status === 401) return <p role="alert">401: sign in required</p>;
  return (
    <section>
      <h2>Goals</h2>
      <form onSubmit={(e) => { e.preventDefault(); const t = new FormData(e.currentTarget).get('title'); if (t) create.mutate(String(t)); e.currentTarget.reset(); }}>
        <input name="title" placeholder="title" required /> <button>Add goal</button>
      </form>
      <ul>
        {goals.data?.map((g) => (
          <li key={g.id}><Link to="/goals/$goalId" params={{ goalId: g.id }}>{g.title}</Link></li>
        ))}
      </ul>
    </section>
  );
}

function GoalToday() {
  const { goalId } = goalRoute.useParams();
  const qc = useQueryClient();
  const today = useQuery({ queryKey: ['today', goalId], queryFn: () => api.today(goalId) });
  const log = useMutation({
    mutationFn: (status: 'DONE' | 'SKIPPED') => api.putLog(goalId, today.data!.today, status === 'DONE' ? { status, amount: 30 } : { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['today', goalId] }),
  });
  if (today.error) return <p role="alert">{today.error instanceof ApiError ? `${today.error.status}: ${today.error.message}` : 'error'}</p>;
  if (!today.data) return <p>loading…</p>;
  return (
    <section>
      <h2>Today {today.data.today}</h2>
      <p data-testid="today-log">log: {today.data.todayLog ? today.data.todayLog.status : 'none'}</p>
      <p>yesterday missing: {String(today.data.yesterdayMissing)}</p>
      <p>prediction: placeholder ({today.data.prediction.observedDays} observed days)</p>
      <button onClick={() => log.mutate('DONE')}>Done</button> <button onClick={() => log.mutate('SKIPPED')}>Skip today</button>
    </section>
  );
}

const rootRoute = createRootRoute({ component: Root });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home });
const goalsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/goals', component: Goals });
const goalRoute = createRoute({ getParentRoute: () => rootRoute, path: '/goals/$goalId', component: GoalToday });
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, goalsRoute, goalRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
