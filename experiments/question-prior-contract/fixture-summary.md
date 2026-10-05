# 共通固定例（未採択案）

| ID | 材料 | a事後 / b事後 | 中心 | 完了 | 実績 / 実遷移 | あと何回分 |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | 未回答 / 未回答 | Beta(2,2) / Beta(2,2) | NO_SKIP_ORIGIN_TRANSITION | insufficient NO_DONE_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F02 | UNKNOWN / UNKNOWN | Beta(2,2) / Beta(2,2) | NO_SKIP_ORIGIN_TRANSITION | insufficient NO_DONE_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F03 | MID / MID | Beta(2,2) / Beta(2,2) | g50=1, g80=3 | available TODAY_DONE | 60 / 0 | 3 |
| F04 | 未回答 / LOW | Beta(2,2) / Beta(1,3) | g50=3, g80=12 | insufficient NO_DONE_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F05 | HIGH / 未回答 | Beta(3,1) / Beta(2,2) | NO_SKIP_ORIGIN_TRANSITION | insufficient NO_SKIP_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F06 | LOW / HIGH | Beta(1,3) / Beta(3,1) | g50=1, g80=2 | available TODAY_DONE | 60 / 0 | 3 |
| F07 | 未回答 / LOW | Beta(3,2) / Beta(1,3) | g50=3, g80=12 | available TODAY_DONE | 60 / 1 | 3 |
| F08 | HIGH / 未回答 | Beta(3,1) / Beta(3,2) | g50=1, g80=2 | available TODAY_DONE | 60 / 1 | 3 |
| F09 | HIGH / LOW | Beta(3,1) / Beta(2,3) | g50=2, g80=5 | available TODAY_DONE | 60 / 1 | 3 |
| F10 | HIGH / HIGH | Beta(3,1) / Beta(4,1) | g50=1, g80=1 | available TODAY_DONE | 60 / 1 | 3 |
| F11 | LOW / HIGH | Beta(1,3) / Beta(3,1) | g50=1, g80=2 | available TODAY_DONE | 40 / 0 | 4 |
| F12 | 未回答 / 未回答 | Beta(2,2) / Beta(3,2) | g50=1, g80=2 | insufficient NO_DONE_ORIGIN_TRANSITION | 60 / 1 | 3 |
| F13 | UNKNOWN / UNKNOWN | Beta(2,3) / Beta(3,2) | g50=1, g80=2 | available TODAY_DONE | 60 / 2 | 3 |
| F14 | LOW / HIGH | Beta(1,3) / Beta(4,1) | TODAY_RECORDED | available CURRENT_STATE | 7 / 1 | 1 |
| F15 | HIGH / UNKNOWN | Beta(3,1) / Beta(2,2) | TODAY_RECORDED | insufficient NO_SKIP_ORIGIN_TRANSITION | 60 / 0 | 3 |
| F16 | LOW / LOW | Beta(1,3) / Beta(1,3) | COMPLETED | completed | 100 / 0 | 0 |
| F17 | MID / MID | Beta(2,2) / Beta(2,2) | g50=1, g80=3 | available TODAY_DONE | 15 / 0 | 1 |
| F18 | HIGH / HIGH | Beta(3,1) / Beta(3,1) | g50=1, g80=2 | available TODAY_DONE | 0 / 0 | 4000 |

計算例18件、入力不正例4件、保存／UI統合例10件。実装のテスト成功件数ではありません。完了DPの非自明な日数goldenは未算出で、既存RNG・採用runtime・Engine拡張の検証で追加します。
