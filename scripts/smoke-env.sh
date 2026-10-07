# shの実装によって関数前の一時代入が残るため、認証設定不足の検証だけをsubshellへ隔離する。
without_auth_secret() (
  export BETTER_AUTH_SECRET=''
  "$@"
)
