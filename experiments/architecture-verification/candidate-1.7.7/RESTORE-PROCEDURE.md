# 隔離DBの復元後session失効手順

Supporting Artifact。検証用手順であり、本番復旧の採択ではない。

1. 外部受付を停止し、進行中HTTPをdrainする。既存DBは変更しない。
2. 新しい隔離復元先へuser/account/session/goal/action_logを復元する。
3. 受付を再開する前に`verify/restore-revoke.ts`を実行する。引数ではDB URLを渡さず、今回生成したloopback試験DBの`DATABASE_URL`と`SPIKE_RESTORE_CONFIRM=isolated-restored-db`だけをプロセス環境に渡す。URL/Secretを表示しない。
4. exit 0、`restored-sessions-revoked`と削除件数、session件数0を確認する。失敗時は受付を再開しない。
5. 旧Cookieで401、新規ログインで新しいsessionを作れることを確認する。
6. **削除済user・古いpassword/accountの巻戻しは未解決。**復元外の削除記録、削除要求再適用、password変更後の巻戻しへの対処を運用担当が決め、別途検証する。

CLIは明示確認のない実行とloopback以外を拒否する。Neon PITR・クラウド接続・本番DBに対する実行は未承認・未検証。APIから実行できるrouteは追加していない。
