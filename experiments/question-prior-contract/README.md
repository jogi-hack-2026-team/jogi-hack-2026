# D-26 共通固定例の提案資料

**Supporting Artifact / Not a Source of Truth / 未採択**

[契約提案](../../docs/prediction/question-prior-contract-proposal.md)の計算・入力不正・保存／UI状態を同じIDで確認する資料。実Engine／HTTP／DB／UIの受入テストではない。

- [common-fixtures.json](common-fixtures.json)：計算18例、不正入力4例、保存／UI状態10例。
- [一覧](fixture-summary.md)と[数式確認結果](validation.json)。
- [build-fixtures.py](build-fixtures.py)：標準ライブラリFractionでBeta-Geometricの分位点と隣接ログを独立計算する。

Python 3がある環境で、リポジトリrootから実行する。PythonはこのSupporting資料の再現用で、製品runtimeの採択ではない。

```powershell
python experiments/question-prior-contract/build-fixtures.py
```

成功時は計算18／入力不正4／保存・UI10、independent_math_checkのPASSを表示し、このディレクトリのJSONと一覧を再生成する。失敗時は非0で終了する。Secret・DB・ネットワーク・外部packageは不要。

再現確認はこの資料の数式整合のみ。非自明な完了DPのp50／p80 numeric goldenは未算出で、既存RNG・seed・runtimeと実Engine接続で追加確認が必要。revision・409・partial answer gate・DTOは未採択。質問値の校正・予測精度・UI理解は未検証。

固定例のconfigは現行Engineからの計算用参照値です。質問回答の初期BetaはmappingCandidateと各例のposteriorへ反映しており、config.prior=2を回答済み側の実際のpriorとして扱いません。新しい質問modeのmodelVersionや公開型を採択する資料ではありません。
