# 2026 女子スロープスタイル 予選 セクション別スコア Web

memo.md の要件に沿って、CSV を読み込みテーブル表示・セクション毎の得点ソート・選手ハイライト(最大3人)ができる静的サイトです。

## 使い方

- ファイル構成
  - `index.html` … 画面本体
  - `script.js` … CSV 読み込み・描画・ソート・ハイライト処理
  - `style.css` … スタイル
  - `2026SB6201ANQ_rankings_wide_horizontal.csv` … 元データ

- ローカルで開く方法
  - ブラウザの制約により `file://` 直開きだと CSV の `fetch` が失敗する場合があります。
  - 簡易サーバで開くのが確実です。Python があれば以下の通り。

```
python3 -m http.server 8000
# または: python -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

## 操作

- ヘッダーをクリックすると、その列でソートできます（数値は降順が初期）。
- 「選手をハイライト」欄で候補から選手名を選び、色を選択して「追加」。最大3人まで。
- 追加後はラベルのカラーピッカーで色を変更、削除ボタンで解除できます。

## デプロイ

- 静的ホスティングで動作します（GitHub Pages / Netlify 等）。
- ルートに以下のファイルがあれば動作します:
  - `index.html`, `style.css`, `script.js`, `2026SB6201ANQ_rankings_wide_horizontal.csv`, `.nojekyll`

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
