export type AuthActionError = { code?: string | undefined; message?: string | undefined };
type Result = { error?: AuthActionError | null };
type Callbacks = {
  setBusy: (busy: boolean) => void;
  onError: (error: AuthActionError) => void;
  onSuccess: () => Promise<unknown>;
};

export async function runAuthAction(action: () => Promise<Result>, callbacks: Callbacks): Promise<void> {
  callbacks.setBusy(true);
  try {
    const result = await action();
    if (result.error) {
      callbacks.onError(result.error);
      return;
    }
    await callbacks.onSuccess();
  } catch {
    callbacks.onError({ code: 'NETWORK_ERROR', message: '通信に失敗しました。接続を確認して再試行してください。' });
  } finally {
    callbacks.setBusy(false);
  }
}
