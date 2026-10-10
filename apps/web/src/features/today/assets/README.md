# Today の朝焼け・山並み資産

`dawn-landscape.webp` は承認済みデザイン「かけ合わせ3：朝焼けの山並み（青空×森）」の提供 HTML (`future-roi-dawn-reference.html`) に含まれる背景を再利用したものです。

- 参照: https://claude.ai/artifact/KQDeWMput5bt77NEj4J4Kb#artboard-eb122470b18c
- 原画 HTML SHA-256: `ba78313e9f198acc1acf9bd7a5e71901a0b654a9953229d476909f3c5bc5cf4c`
- 390 px 幅で元の `.sky` 全体を描画し、`.bar` と `.hero` の編集可能な UI 文字を `visibility: hidden` にした。原画の空と3層の山を保持し、新しい CSS / SVG の描画は実装へ持ち込んでいない。
- 3倍の描画解像度: 1170 × 990 px。原画の `.sky` 実測高さは 329.4375 CSS px。
- WebP は lossless。元の PNG とデコード後の RGB 全画素が一致することを確認済み。

## Zen Old Mincho

`zen-old-mincho.css` を利用する Today のスタイルから import し、`font-family: 'Zen Old Mincho', serif` と `font-weight: 900` を指定します。フォントは同一オリジンから配信でき、外部 CDN 接続を必要としません。

- 出典: https://fontsource.org/fonts/zen-old-mincho
- 取得元: `@fontsource/zen-old-mincho` 5.3.0 の公式 npm tarball
- https://registry.npmjs.org/@fontsource/zen-old-mincho/-/zen-old-mincho-5.3.0.tgz
- npm の SHA-512 integrity を照合済み。
- 900 の Unicode-range 分割 WOFF2 のみをそのまま収録。CSS では相対パスを `./fonts/` へ変更し、重複する WOFF fallback を省略している。
- 122 ファイル、2,705,020 bytes。ブラウザは使用する文字を含む Unicode-range のファイルを取得する。
- SIL Open Font License 1.1。全文は `zen-old-mincho-LICENSE.txt`。字体・フォントファイル内容は変更していない。
