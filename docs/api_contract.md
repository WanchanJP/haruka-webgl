# API Contract — ハルカノカナタ Web版

**目的:**  
Unity WebGL と Next.js(TypeScript) 間でやり取りする API・DOM・通信の仕様を明確に定義する。  
この契約に反する変更（改名・削除）は原則禁止。

---

## 🧭 概要
- Unity → JavaScript: 画像データを送信して `<canvas>` に描画
- JavaScript → Unity: Capture命令を送信して RenderTextureを転送
- 双方向通信の入口・出口を明示する

---

## 1️⃣ JavaScript (Next.js) 側仕様

### グローバル変数
| 名前 | 型 | 説明 |
|------|----|------|
| `window.unityInstance` | `any` | Unity WebGLの実行インスタンス。`SendMessage`経由で命令を送信。 |
| `window.onUnityImageReceived` | `(data: Uint8Array, width: number, height: number) => void` | Unityから画像データを受信するための関数。 |

### 関数
| 関数名 | 引数 | 戻り値 | 説明 |
|---------|-------|--------|------|
| `loadUnity(): Promise<any>` | - | Unityインスタンス | WebGLビルドをロードし、`window.unityInstance`を初期化する。 |
| `sendMessageToUnity(goName: string, method: string, param?: string | number)` | GameObject名, メソッド名, パラメータ(任意) | void | Unityへメッセージを送信。Bridge経由で動作。 |

---

## 2️⃣ DOM構造 (固定ID)

### Unity埋め込み
| ID | 要素 | サイズ | 説明 |
|----|------|---------|------|
| `#unity-canvas` | `<canvas>` | 任意（例: 640x480） | Unity WebGL本体の描画用Canvas |

### 受信プレビュー
| ID | 要素 | サイズ | 説明 |
|----|------|---------|------|
| `#rt-canv-0` | `<canvas>` | 256x256 | Unityから受信した画像を描画するCanvas。複数枚対応を想定。 |

---

## 3️⃣ Unity 側仕様

### GameObject / スクリプト
| オブジェクト | メソッド | 機能 | 呼び出し元 |
|---------------|-----------|-------|-------------|
| `Bridge` | `CaptureAndSend()` | RenderTextureを読み取り、JavaScriptへ転送 | JS (`sendMessageToUnity`) |

### スクリプト: `CaptureSender.cs`
| フィールド | 型 | 説明 |
|------------|----|------|
| `captureCamera` | `Camera` | キャプチャ対象カメラ |
| `renderTex` | `RenderTexture` | 出力先RenderTexture |

### 送信関数
| 関数名 | 役割 | 呼び出し元 |
|---------|------|-------------|
| `ReceiveImageData(ptr, length, width, height)` | Unity → JSで画像データを送信 | `.jslib`（WebBridge.jslib） |

---

## 4️⃣ JavaScriptライブラリ (.jslib)

### ファイル
`Assets/Plugins/WebBridge.jslib`

### 内容仕様
```javascript
mergeInto(LibraryManager.library, {
  ReceiveImageData: function (ptr, length, width, height) {
    var bytes = new Uint8Array(Module.HEAPU8.buffer, ptr, length);
    if (typeof window.onUnityImageReceived === "function") {
      window.onUnityImageReceived(new Uint8Array(bytes), width, height);
    }
  }
});
````

---

## 5️⃣ データ仕様 (画像転送)

| 項目     | 型                  | 説明                                             |
| ------ | ------------------ | ---------------------------------------------- |
| 解像度    | int                | RenderTexture.width / RenderTexture.height に一致 |
| ピクセル形式 | RGBA32 (リトルエンディアン) | `Texture2D.GetRawTextureData()`のバイト列           |
| 転送形式   | Uint8Array         | JS側で ImageData に変換し Canvas に描画                 |
| 転送方向   | Unity → JS         | 双方向通信は必要に応じて拡張可                                |

---

## 6️⃣ ファイル配置ルール

| パス                                | 内容                                                            |
| --------------------------------- | ------------------------------------------------------------- |
| `public/unity/Build/`             | Unity WebGL ビルド成果物一式（.wasm, .data, .framework.js, .loader.js） |
| `lib/unity.ts`                    | Unity 読み込み・通信処理                                               |
| `global.d.ts`                     | window拡張定義                                                    |
| `app/page.tsx`                    | UI・ボタン・Canvas描画                                               |
| `Assets/Plugins/WebBridge.jslib`  | Unity → JS 転送                                                 |
| `Assets/Scripts/CaptureSender.cs` | JS ← Unity 転送制御                                               |

---

## 7️⃣ 拡張・将来仕様（予約済み）

| 項目             | 内容                                    |
| -------------- | ------------------------------------- |
| 複数Canvas対応     | `#rt-canv-1`, `#rt-canv-2` などを追加で受信予定 |
| WebGPU対応       | Unity 6.1以降のAPI更新時に検証予定               |
| IndexedDBキャッシュ | `.data` ファイルのストリーミング最適化               |
| Brotli再圧縮      | CDN配信時にCloudflare Rulesを利用予定          |

---

## 8️⃣ テスト観点

| 検証項目                 | 確認方法                                            |
| -------------------- | ----------------------------------------------- |
| Unityビルドが正しく読み込まれる   | `npm run dev` → ステータス「準備完了」                     |
| JS→UnityのCapture呼び出し | Consoleに `[CaptureSender] Sent ... bytes`       |
| Unity→JSの画像受信        | `window.onUnityImageReceived` が呼ばれ Canvasに描画される |
| 黒画面になる               | RenderTextureが正しく設定されていない                       |
| 上下反転する               | `ctx.scale(1,-1)`で反転対応可                         |

---

*Last updated: 2025-11-06*
