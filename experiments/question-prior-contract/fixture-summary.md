# 共通固定例（未採択案）

| ID | 材料 | a事後 / b事後 | 中心 | 完了 | 実績 / 実遷移 | あと何回分 |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | 未回答 / 未回答 | Beta(2,2) / Beta(2,2) | NO_SKIP_ORIGIN_TRANSITION | insufficient NO_DONE_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F02 | UNKNOWN / UNKNOWN | Beta(2,2) / Beta(2,2) | NO_SKIP_ORIGIN_TRANSITION | insufficient NO_DONE_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F03 | MID / MID | Beta(2,2) / Beta(2,2) | g50=1, g80=3 | available TODAY_DONE (3 / 6日) | 60 / 0 | 3 |
| F04 | 未回答 / LOW | Beta(2,2) / Beta(1,3) | g50=3, g80=12 | insufficient NO_DONE_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F05 | HIGH / 未回答 | Beta(3,1) / Beta(2,2) | NO_SKIP_ORIGIN_TRANSITION | insufficient NO_SKIP_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F06 | LOW / HIGH | Beta(1,3) / Beta(3,1) | g50=1, g80=2 | available TODAY_DONE (4 / 5日) | 60 / 0 | 3 |
| F07 | 未回答 / LOW | Beta(3,2) / Beta(1,3) | g50=3, g80=12 | available TODAY_DONE (3 / 11日) | 60 / 1 | 3 |
| F08 | HIGH / 未回答 | Beta(3,1) / Beta(3,2) | g50=1, g80=2 | available TODAY_DONE (2 / 4日) | 60 / 1 | 3 |
| F09 | HIGH / LOW | Beta(3,1) / Beta(2,3) | g50=2, g80=5 | available TODAY_DONE (2 / 4日) | 60 / 1 | 3 |
| F10 | HIGH / HIGH | Beta(3,1) / Beta(4,1) | g50=1, g80=1 | available TODAY_DONE (2 / 3日) | 60 / 1 | 3 |
| F11 | LOW / HIGH | Beta(1,3) / Beta(3,1) | g50=1, g80=2 | available TODAY_DONE (6 / 7日) | 40 / 0 | 4 |
| F12 | 未回答 / 未回答 | Beta(2,2) / Beta(3,2) | g50=1, g80=2 | insufficient NO_DONE_ORIGIN_TRANSITION | 60 / 1 | 3 |
| F13 | UNKNOWN / UNKNOWN | Beta(2,3) / Beta(3,2) | g50=1, g80=2 | available TODAY_DONE (4 / 5日) | 60 / 2 | 3 |
| F14 | LOW / HIGH | Beta(1,3) / Beta(4,1) | TODAY_RECORDED | available CURRENT_STATE (2 / 2日) | 7 / 1 | 1 |
| F15 | HIGH / UNKNOWN | Beta(3,1) / Beta(2,2) | TODAY_RECORDED | insufficient NO_SKIP_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F16 | LOW / LOW | Beta(1,3) / Beta(1,3) | COMPLETED | completed | 100 / 0 | 0 |
| F17 | MID / MID | Beta(2,2) / Beta(2,2) | g50=1, g80=3 | available TODAY_DONE (0 / 0日) | 15 / 0 | 1 |
| F18 | HIGH / HIGH | Beta(3,1) / Beta(3,1) | g50=1, g80=2 | available TODAY_DONE (None / None日) | 0 / 0 | 4000 |

計算例18件、入力不正例4件、保存／UI統合例10件。実装のテスト成功件数ではありません。非自明な完了DP9例はNode22.15.1／Windows／seed20261012／K200／H1095で条件付き独立CDFと一致。共有samplerの数値確認であり、材料gate・API／DB／UI接続・精度や採用runtimeの保証ではありません。再現はverify-completion.mjsとcompletion-replay-results.jsonを参照。
