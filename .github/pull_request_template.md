## 概要
- 変更内容を1〜3行で

## チェックリスト（必須）
- [ ] `/docs/api_contract.md` に **違反なし**（関数名・DOM ID・.jslib名・GameObject名を変更していない）
- [ ] `npm run lint` が成功
- [ ] `npm run typecheck` が成功
- [ ] `npm run build` が成功
- [ ] `#unity-canvas` / `#rt-canv-0` のDOM構造を壊していない
- [ ] `lib/unity.ts` の公開関数（`loadUnity`, `sendMessageToUnity`）のシグネチャを変更していない
- [ ] ログ・デバッグコードを必要最低限に整理済み

## 動作確認
- 開発起動: `npm run dev`
- Unityビルド配置: `public/unity/Build/<name>.*`
- 確認手順（画面遷移・ボタンクリックなど）:

## 影響範囲
- 依存ファイル・機能（例：`page.tsx`, `unity.ts`, `.jslib`）

## 備考
- スクリーンショットやコンソールログがあれば添付
