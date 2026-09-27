# Issue #57: percentile同順位・参照版移行の合成比較

**Supporting Artifact / Not a Source of Truth.** 本番の変換規約は未決。実録音、ReccoBeats、Playback、実Userの評価には使用していない。

## 再実行

リポジトリのルートで `node experiments/stack-bakeoff/scripts/ml-percentile-options.mjs` を実行する。Node.js標準機能のみを使い、乱数・DB・外部APIは使わない。[比較スクリプト](../scripts/ml-percentile-options.mjs)が全7特徴の入力、各percentileとContext、版差の数値、境界・不正入力の検査を出力する。小数表示は6桁へ丸め、percentile・Context・B/fの計算は丸め前の値で行う。

## 条件と計算式

Feature Reference v1は架空の録音A〜D、v2はEを1件追加したA〜E。各録音の7特徴はスクリプトへ固定している。AをSeed、DをCandidateとする。Playback Mappingの条件は参照集合に含めない。

参照数をN、対象値より小さい値の数をL、等しい値の数をEとして、同順位の3案を比較した。`lower=L/N`、`mid=(L+E/2)/N`、`upper=(L+E)/N`。いずれも同じ値に同じpercentileを割り当て、値が上がればpercentileは下がらない。正式Contextは仕様どおり `φ=[1,-|q1(D)-q1(A)|,…,-|q7(D)-q7(A)|]/√8`。1件のLIKE観測だけを仮定し、`B=I+φφᵀ`、`f=φ` で版差を比較した。Posteriorの品質や推薦精度の比較ではない。

## 観測結果

| 同順位案 | v1でAのdanceability q | v1でDのdanceability q | v1のdanceability Context成分 | v1→v2のContext差 L2 | v1→v2のB差 Frobenius |
| --- | ---: | ---: | ---: | ---: | ---: |
| lower | 0 | 0.75 | -0.265165 | 0.055902 | 0.080100 |
| mid | 0.375 | 0.875 | -0.176777 | 0.071261 | 0.094134 |
| upper | 0.75 | 1 | -0.088388 | 0.091856 | 0.105664 |

v1のdanceabilityはA/B/Cが0.2、Dが0.8のため、AのL=0、E=3である。同じ録音と評価でも同順位案だけでContextが変わる。mid案ではE追加後、Aのqは0.375→0.3、Dは0.875→0.9、両者のdanceability距離は0.5→0.6になった。全7特徴のContext差L2は0.071261、1観測の`f`差L2も0.071261、`B`差Frobeniusは0.094134。同一Posteriorへ両版の観測を黙って足せないことを、このfixtureでも確認した。

参照範囲外のtempo 90と140は、3案すべてでそれぞれq=0とq=1になった。これは今回の3式の結果であり、本番の範囲外規約の採択ではない。7特徴の欠損とNaNは比較スクリプトの入力検査で明示的に失敗する。どの録音を参照母集団から除外するか、実データの欠損処理は未決のままである。

## 選択肢とTrade-off

| 論点 | 候補 | 利点 | 制約・リスク |
| --- | --- | --- | --- |
| 同順位 | lower / mid / upper | lowerは最小の同順位群を0に、upperは最大の同順位群を1にできる。midは同順位群の中央に置き、片側への偏りを抑える | 本fixtureでは同一のA→DでContext成分が-0.265165〜-0.088388まで変わる。どの方式も参照版の更新で値が動く |
| 旧Posteriorを拒否し新状態から開始 | 版不一致を失敗させ、v2はpriorから開始 | 実装と検査が単純で版混在を防ぐ | 既存ユーザーの学習結果を引き継げない |
| 旧Posteriorを明示的に再構築 | 通常のFeedback更新とは別の移行として、元のAnchorを保持したcanonical評価と対象録音からv2用Contextを計算し、別版のState全体を作る。旧Contextと旧Stateは改変・混合しない | 学習履歴を引き継げる可能性 | 保存できる原特徴・Anchor・履歴・利用権と明示的な移行設計が必要。過去に提示したContextとv2用Contextは意味が異なるため、移行版と監査が必要 |
| 旧版と新版を並行維持 | 既存状態はv1、新状態はv2に固定 | 既存Posteriorをそのまま保持できる | 旧参照集合・変換を利用可能に保ち、複数版を運用する費用と権利確認が必要 |

**推奨候補（未採択）:** 同順位はmidを第一候補とし、基準を固定して版を明示する。版不一致は必ず拒否し、初期段階は新状態をpriorから開始する単純な移行を第一候補とする。再構築・並行維持は、保持可能な履歴と利用権が確認できた場合に再検討する。midの利点は同順位群を中央に置く対称性であり、この小さなfixtureだけで推薦品質が優れるとは言えない。

## #41で必要なチーム判断

1. 同順位をlower / mid / upperのどれで定義するか。対象値が参照集合内にない場合と参照範囲外、欠損・NaNの正式な扱いを併せて定める。
2. Feature Referenceをいつ新しい版へ更新し、既存セッション・旧Posteriorを拒否／再構築／並行維持のどれで扱うか。context/transform/model版をどの単位で固定するかを定める。
3. 実データの保存・ML利用条件を#38で確認するまで、合成結果を実Catalog成立の証拠にしない。

判断後に[Product Spec](../../../docs/product-spec.md)と[Architecture](../../../docs/architecture.md)の該当Decision Logおよび#41へ反映する。本Issueでは本番コードと正式判断を変更しない。
