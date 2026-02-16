# 2026 女子スロープスタイル 予選 セクション別スコア Web

memo.md の要件に沿って、CSV を読み込みテーブル表示・セクション毎の得点ソートができる静的サイトです。CSV は `index.html` 内に埋め込まれており、外部ファイル参照は不要です。

## 使い方

- ファイル構成
  - `index.html` … 画面本体（CSVデータを内包）
  - `script.js` … CSV 読み込み・描画・ソート
  - `style.css` … スタイル

- ローカルで開く方法
  - CSV は `index.html` に埋め込み済みのため、`index.html` を直接開いて動作します。
  - HTTP サーバ経由で開く場合もそのまま動作します。

## 操作

- ヘッダーをクリックすると、その列でソートできます（数値は降順が初期）。

## デプロイ

- 静的ホスティングで動作します（GitHub Pages / Netlify 等）。
- ルートに以下のファイルがあれば動作します:
  - `index.html`, `style.css`, `script.js`, `.nojekyll`

### GitHub Pages へのデプロイ（Actions で自動公開）

1) GitHub で新規リポジトリを作成し、このフォルダの内容を `main` ブランチに push します。

2) このリポジトリには `.github/workflows/deploy-pages.yml` を同梱済みです。最初の push でワークフローが実行され、Pages に公開されます。

3) 公開URLは Actions の `Deploy to GitHub Pages` ステップに表示されます（例: `https://<ユーザー>.github.io/<リポジトリ名>/`）。

補足:
- デフォルトブランチが `main` 以外なら、`deploy-pages.yml` の `branches: ["main"]` を変更してください。
- カスタムドメインを使う場合は、リポジトリの Settings > Pages でドメインを設定し、`CNAME` ファイルをルートに追加してください。

## 補足

- CSV の行末に含まれる `$` は読み込み時に除去しています。
- 数値列は `Rank`, `S1~S6 Score`, `Sections(60%)`, `Composition(40%)`, `Score(100%)` を自動判定しています。
