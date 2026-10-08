/** 明示されたアプリ内の戻り先を保ち、指定がなければGoal一覧を開く。 */
export function authSearch(search: Record<string, unknown>): { redirect: string } {
  return {
    redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//')
      ? search.redirect
      : '/goals',
  };
}
