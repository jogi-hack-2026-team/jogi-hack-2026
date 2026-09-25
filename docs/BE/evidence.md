# BE EvidenceとPerformance Report

**Supporting Artifact / Not a Source of Truth**。正式判断は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。閲覧・コード確認日: 2026-09-25。論文の知見、公式仕様、過去実験、人間の判断を区別する。

## EV-BE-01

- Accessed Date: 2026-09-25
- Type: LOCAL_POC (historical)
- Source / Author / Date: チームPoC。[backend.test.ts](../../experiments/stack-bakeoff/tests/backend.test.ts)、[verification](../../experiments/stack-bakeoff/results/verification.json)、[再評価](../../experiments/stack-bakeoff/results/reevaluation-verification.json)。
- Reviewed section / Conditions: 2026-09-24〜25、Node 22.15.1、local PostgreSQL 18.6、Hono/Fastify共通Service。各13ケース＋数値1＋親test2=runner29成功。
- Supports: 他Guest拒否、同一ID再送、revision競合、rollback、TraceとInteractionの一括保存、canonical再計算。
- Does not support / Limitations: 本番schema/ログ/所有者共通State、実外部API、Secure Cookie、公開セキュリティの試験ではない。独立Sessionの成功を共有owner Stateの競合安全性へ拡張しない。
- Applied to: D-08 / 10〜13、DI-BE-01〜03。

## EV-BE-02

- Accessed Date: 2026-09-25
- Type: LOCAL_POC (historical)
- Source / Author / Date: チームPoC。[backend-metrics.json](../../experiments/stack-bakeoff/results/backend-metrics.json)、[scale-metrics.json](../../experiments/stack-bakeoff/results/scale-metrics.json)、[scale.ts](../../experiments/stack-bakeoff/scripts/scale.ts)。
- Reviewed section / Conditions: localhost、Hono→Fastify固定順、DBはDocker tmpfs。通常計測warm-up5＋30session。scaleは各2 OS process、各pool max12、単発100並列、pool観測2ms間隔。
- Supports: 同一Feedback集中時も一度だけ反映。pool総数と待機を考慮する必要がある。数値の一覧と未計測項目は下記。
- Does not support / Limitations: 固定順、単発、DB/network込み。Framework差の統計的優位、継続RPS、本番SLO、Cloud Run/Neonの動作保証ではない。履歴をSQL投入し5commit制限を迂回した試験は継続探索UXを検証しない。
- Applied to: D-10〜12 / 14、E-06、DI-BE-03。

## EV-BE-03

- Accessed Date: 2026-09-25
- Type: SPEC
- Source / Author / Date: Fastify maintainers、latest docs。[Validation / Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)、[Type Providers](https://fastify.dev/docs/latest/Reference/Type-Providers/)、[Logging](https://fastify.dev/docs/latest/Reference/Logging/)、[LTS](https://fastify.dev/docs/latest/Reference/LTS/)。Context7 /fastify/fastify。
- Reviewed section / Conditions: 入力JSON Schema、応答serializer、型provider、Pino logger設定、LTS方針。
- Supports: HTTP境界でvalidation・応答型・ログ方針を統一できる。schemaは信頼できる開発時定義とし、初期validationでDB処理をしない。
- Does not support / Limitations: PoCは共通手動validatorとlogger:falseで、この便益を性能比較していない。log有効化だけでSecretを防げずredaction試験が必要。LTSは同majorの無条件2年保証ではない。
- Applied to: D-11、DI-BE-01 / 04。

## EV-BE-04

- Accessed Date: 2026-09-25
- Type: SPEC
- Source / Author / Date: Hono maintainers。[RPC](https://hono.dev/docs/guides/rpc)、Context7 /websites/hono_dev。
- Reviewed section / Conditions: validator入力・route応答からclient型を推論するRPC契約。
- Supports: Web Standards、多runtime/Workers、薄いHTTP adapter、RPCの有力な代替。
- Does not support / Limitations: Honoにvalidation/型安全性がないとは言わない。transaction成功は共通Service/DBの証拠でFastify固有の優越ではない。
- Applied to: D-11のWhy Not Alternatives。

## EV-BE-05

- Accessed Date: 2026-09-25
- Type: SPEC
- Source / Author / Date: PostgreSQL Global Development Group。[Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)、Context7 /websites/postgresql_current。
- Reviewed section / Conditions: Row-Level Locks、FOR UPDATE、deadlock。
- Supports: 同一State更新をtransactionの行lockで直列化する。順序を揃え、短いtransactionにする。
- Does not support / Limitations: 隔離レベル、deadlock retry、owner Stateのlock対象は別途設計。MySQLなど他Engineに同種能力がないという証拠ではない。
- Applied to: D-12、DI-BE-02 / 03。

## EV-BE-06

- Accessed Date: 2026-09-25
- Type: SPEC
- Source / Author / Date: Google Cloud。[Container contract](https://docs.cloud.google.com/run/docs/container-contract)、[Maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances)、Context7 /websites/cloud_google_run。
- Reviewed section / Conditions: 通常HTTP server container、instance制御とDB接続上限の関係。
- Supports: Cloud RunでNode/Fastifyを配置し、concurrency/instances/poolを一緒に制御する選択肢。
- Does not support / Limitations: Cloud SQL向けの接続数をNeonへ転用しない。region/latency/cold start/費用/最終受入は未検証。max instancesだけで移行時を含む厳密な総接続数を保証しない。
- Applied to: D-14、Deployment gate。

## EV-BE-07

- Accessed Date: 2026-09-25
- Type: SPEC
- Source / Author / Date: Neon。[Connection pooling](https://neon.com/docs/connect/connection-pooling)、[Compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle)、[Scale to zero](https://neon.com/docs/guides/scale-to-zero-guide)。Context7 /neondatabase/website。
- Reviewed section / Conditions: PgBouncer transaction pooling、idle/suspendedからの再開。
- Supports: 低初期負荷への適合見込みと、transaction単位接続・wake-upの考慮が必要なこと。
- Does not support / Limitations: 全session機能の互換を保証しない。session SET依存・migration・prepared statementは採用driver/endpointで検証。無料枠=無制限でも永続無料保証でもない。
- Applied to: D-14。最終受入はCONDITIONAL。Authは[公式overview](https://neon.com/docs/auth/overview)を入口とするOPEN候補で稼働未確認。

## EV-BE-08

- Accessed Date: 2026-09-25
- Type: SPEC (rights partly unresolved)
- Source / Author / Date: ReccoBeats / LatteBits、[Terms of Service](https://reccobeats.com/docs/documentation/terms-of-service)（2026-05-25更新）、[Audio Features](https://reccobeats.com/docs/apis/get-audio-features)。YouTube [IFrame API](https://developers.google.com/youtube/iframe_api_reference)、[Developer Policies](https://developers.google.com/youtube/terms/developer-policies)、[Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)。
- Reviewed section / Conditions: ReccoBeats Terms §§1〜6全文とFeature schema、YouTube player events/errors・必須機能。公式公開文書を読み、実曲取得・再生・音源アップロードはしていない。
- Supports: ReccoBeatsの個人/商用利用無料、メタデータのSpotify由来、独自分析指標という運営者の説明を確認。YouTube onReadyを再生開始にせずPLAYING・error・autoplay拒否を別扱いにする。
- Does not support / Limitations: ReccoBeatsの独自生成主張を独立監査したわけではない。保存/学習許諾は下記の未解決点。YouTube metadata/embeddableだけでは録音一致・地域再生を保証しない。
- Applied to: A-04、R-02 / 04 / 09 / 15、DI-FE-03 / BE-02。

### 保存・学習用途の追加確認

2026-09-25に公式Terms本文まで確認した。「Terms未取得」から「Terms確認済み、個別用途の許諾はOPEN」へ更新する。

| データ・用途 | 確認結果 | 残る確認 |
| --- | --- | --- |
| ReccoBeats APIの個人・商用利用 | Terms §1に無料利用の明記あり | 過剰trafficは停止対象。サービス継続/SLAなし |
| 推薦結果のリクエスト削減用cache | [Rate LimitingのBest Practices](https://reccobeats.com/docs/documentation/rate-limiting)で公式に推奨 | TTL・特徴量全体の永久保管・dataset公開までを許した記載ではない |
| 曲名・artist・album・release等のmetadata | §2でSpotify由来、第三者条件の遵守責任は利用者と記載 | 出所別の保存/表示/更新/削除要件と権利の範囲 |
| ReccoBeats analytical metrics | §2で独自サービス生成と説明 | DB永続保存、versioned参照集合、percentile変換、LinTS更新・推論入力、simulation用datasetの明示許諾は本文にない |
| データ再配布・公開Git fixture | 明示許諾を確認できない | API利用無料から再配布許可を推定しない |
| 音源そのもの | Feature APIの利用条件は音源利用権ではない | YouTube/Spotify音源の取得・抽出・再ホストをこの構成へ足さない |

[Spotify Developer Terms](https://developer.spotify.com/terms)（Version 10、2025-05-15発効）の§II.8のContent定義、§IV.2.1のML/AI学習・入力禁止、§IV.3の保存/一時cache制限も確認した。metadataもContent定義に含まれる。ReccoBeats経由で適用条件が消えるとは判断しない。一方、§I.3はSpotify Platform利用による契約成立を定めており、ReccoBeatsのみを使う当アプリへ同契約が当然に直接適用されるとも断定しない。独自生成とされる数値の権利範囲・upstreamの許諾連鎖は未確認。LinTSは生成AIではないがMLであり、その違いだけで例外にしない。

### 許諾精査の結論

通常のアプリ組込みはTerms §1と[API紹介](https://reccobeats.com/docs/apis/reccobeats-api)、推薦結果cacheはRate Limitingに肯定的根拠がある。[Audio Feature Extraction](https://reccobeats.com/docs/documentation/Analysis/audio-features-extraction)も推薦システムでの利用を用途として挙げる。ただし、音源upload APIの用途説明を、既存Catalog APIの数値の全量保存・再配布・任意モデル学習への包括許諾と同一視しない。

Terms本文にReccoBeats独自数値のML利用を明示禁止する条項も見つからなかった。したがって結論は**禁止確定でも無条件許諾済みでもなく、用途別CONDITIONAL**。一般利用の許可から実装に必要な処理が認められる解釈はあり得るが、永続参照集合と学習Stateまでの範囲は本文から確定できない。追加の書面確認はこのプロジェクトの採用判断に必要なEvidenceであり、「すべてのAPI利用に個別承諾が法的に必須」とする判断ではない。

調査範囲は公式Terms全文、Introduction、Rate Limiting、API紹介、Feature API/Extraction、Changelogおよび公式domain内検索。Changelogにも2026-05-25のTerms追加がある。公開文書の範囲で別のdataset/MLライセンスは発見できず、非公開契約や個別許諾の存在は未確認。第三者ブログ/利用例/非公式OpenAPIのライセンスを、ReccoBeats Dataの権利証拠にしていない。

### 運営者へ確認する具体的範囲

以下は確認項目案であり、実際の送信本文ではない。2026-09-25に依頼者からReccoBeatsへメール送信済みとの報告があり、回答待ち。送信本文・回答は未確認。宛先は[公式TermsのContact](https://reccobeats.com/docs/documentation/terms-of-service)から確認し、回答者・日付・対象endpoint・許可範囲・条件・規約版を記録する。

1. `/v1/audio-features`の既存Catalog数値は、upload解析結果と同様に独自生成であり、第三者との契約上、下記利用を許諾できるか。Spotify ID/ISRC/href/metadataと数値の権利を分けて回答してほしい。
2. 小規模な公開音楽探索Web appで数値をPostgreSQLへ保存し、version固定のpercentile参照集合を作れるか。許容曲数・保存期間・refresh/delete・帰属表示はあるか。
3. 数値差をcontextとして、User自身のLIKE/NEUTRAL/DISLIKEからGaussian linear Thompson samplingをオンライン更新・推論する用途は許されるか。生成音楽・音声モデルの学習ではない。派生percentile・B/f・Context/Traceの保持も含めてほしい。
4. metadataはUI表示と録音照合だけ、数値は推薦入力として分離する場合、metadataの取得元・表示link・保持/削除条件は何か。Spotify規約との整合を裏付ける権限・許諾範囲を示せるか。
5. ハッカソンdemo、後日の商用公開、offline評価、少数fixtureの公開Git保存はそれぞれ可能か。dataset再配布は通常利用と別に回答してほしい。

回答が独自数値だけを許可するならmetadataは別gateのまま。単に「商用利用無料」と返った場合も2〜4の解決とはしない。第三者権利について権限のない相手の回答だけで解除しない。期限付きcacheしか許されない場合は永久Reference/Trace設計との整合を再検討する。確認が取れなければ権利確認済み別データでP0を行い、API採用を再提案する。

**Engineering gate:** 永続Feature Catalogと学習を許諾済みとして扱わない。運営者へ、数値特徴量/metadataを分けて、保存期間、派生percentile、オンラインLinTS、学習済みStateの保持、削除要求、dataset再配布、第三者権利を確認し、書面をEvidenceへ追加する。問い合わせ済みでも許諾確認完了とは扱わない。確認前でも権利確認済みデータまたは合成データの数値検証は進められる。

YouTubeのAPI Dataは種別ごとの保存/refresh/delete条件を確認する（Developer Policies III.E.4）。動画IDだけを持てば全保存制限がなくなるとはしない。認証/非認証、mapping、検証日時を区別し、本番のretentionと再検証規約を実装前に決める。

## EV-BE-09

- Accessed Date: 2026-09-25
- Type: SPEC (measurement plan)
- Source / Author / Date: Node.js maintainers。[perf_hooks](https://nodejs.org/api/perf_hooks.html)、Context7 /nodejs/node。
- Reviewed section / Conditions: monitorEventLoopDelay、eventLoopUtilizationの区間差分と単位。
- Supports: HTTP待ちと同期CPUによる詰まりを別観測する。ELUはCPU利用率そのものではない。
- Does not support / Limitations: 現PoCはevent loop/CPUの測定なし。main branchのAPIを採用Node versionでそのまま使えると仮定しない。
- Applied to: E-06、DI-BE-04、下記測定計画。

## 過去のPerformance Result

単位ms、丸め表示。元の全値・試験条件はEV-BE-02のJSONを正本とする。今回再測定はしていない。

| 測定 | Hono | Fastify |
| --- | --- | --- |
| recommendation median / p95、30session | 8.68 / 10.96 | 7.61 / 9.03 |
| feedback median | 9.29 | 8.03 |
| import後startup | 5.31 | 305.07 |
| 同一Feedback100並列 total / median / p95 | 441.35 / 281.80 / 393.69 | 306.07 / 204.95 / 288.14 |
| 独立Session100並列 total / median / p95 | 161.76 / 103.83 / 146.71 | 137.33 / 91.92 / 122.59 |
| 100 / 1,000 / 10,000履歴からrebuild、各1回 | 15.54 / 17.96 / 51.16 | 13.24 / 16.23 / 54.86 |
| 各processのpool peak connection / waiting count | 12 / 38 | 12 / 38 |

waiting=38は待機件数であり38msではない。startupはimport後のlisten準備で、container cold startやNeon wake-upではない。100並列の総時間の逆数を定常throughputとして報告しない。p99、持続RPS、CPU、memory、event loop delay、DB query/lock/pool待機時間、candidate取得・matrix処理の個別時間は**未測定**。

## 次回の測定計画

| 対象 | 記録項目 | 条件・比較方法 |
| --- | --- | --- |
| HTTP / Scenario | p50/p95/p99、成功/失敗/timeout、offeredとcompleted RPS | seed/catalog/state固定、warm-up・測定時間・試行回数を事前に決め、実行順交替。単一user/独立owner/同一ownerを分離 |
| Process | CPU秒・利用率、RSS/heap、event loop delay histogramとELU | 計測窓と単位、GC、Node/package/OS/CPU/memoryを記録。ELUをCPUと混同しない |
| Database | query、transaction、row lock、pool取得待ち、active/idle/waiting | request traceへ関連付け、Secret/SQL実値を記録しない。複数instance総pool数を測る |
| Recommendation | DB候補取得、filter/union、Seed距離、Probe生成、solve/sample、Trace保存 | Catalog 30→1k→10k→100k、3/5Seed、履歴100→1k→10k、候補上限を変え品質指標も併記 |
| Cloud | cold/warm、Neon wake-up、region間latency、同時接続総数 | 本番と同じdriver/pooler/migration、再起動/再送/rollbackを含める。課金を伴う試験は別承認Scope |

SLO・同時user数・予算閾値はOPEN。計測前に人間が受入条件を決める。結果には日付、commit、設定、raw data、失敗・外れ値、反復ばらつきを添える。測定後に基準を動かして成功扱いしない。
