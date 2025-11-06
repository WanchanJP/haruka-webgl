# Unity WebGL Bridge - 統合ガイド

このドキュメントは、Unity WebGLプロジェクトとNext.jsアプリケーション間でRGBA画像データを送受信するためのブリッジ実装ガイドです。

---

## 📋 概要

- **Next.js側**: `window.onUnityImageReceived` でUnityからの画像データを受信し、`<canvas id="rt-canv-0">` に描画
- **Unity側**: `ReceiveImageData` jslibプラグインを使ってJavaScriptにデータを送信
- **通信フロー**: Next.js → Unity (`SendMessage`) → Unity → Next.js (`onUnityImageReceived`)

---

## 🔧 Unity側の実装

### 1. jslib プラグインの作成

**ファイル名**: `Assets/Plugins/WebBridge.jslib`

```javascript
mergeInto(LibraryManager.library, {
  ReceiveImageData: function (ptr, length, width, height) {
    try {
      var bytes = new Uint8Array(Module.HEAPU8.buffer, ptr, length);
      if (typeof window.onUnityImageReceived === "function") {
        window.onUnityImageReceived(new Uint8Array(bytes), width, height);
      } else {
        console.warn("window.onUnityImageReceived is not defined");
      }
    } catch (e) {
      console.error("ReceiveImageData failed:", e);
    }
  }
});
```

**説明**:
- `ptr`: Unityのネイティブメモリポインタアドレス
- `length`: バイト配列のサイズ
- `width`, `height`: 画像の解像度
- `Module.HEAPU8.buffer`: UnityのWebAssemblyヒープメモリにアクセス
- `window.onUnityImageReceived`: Next.js側で登録したハンドラ関数を呼び出し

---

### 2. C# スクリプトの作成

**ファイル名**: `Assets/Scripts/CaptureSender.cs`

```csharp
using UnityEngine;
using System;
using System.Runtime.InteropServices;

public class CaptureSender : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void ReceiveImageData(IntPtr ptr, int length, int width, int height);
#endif

    public Camera captureCamera;
    public RenderTexture renderTex;

    /// <summary>
    /// カメラをRenderTextureに描画し、画像データをJavaScript側に送信
    /// </summary>
    public void CaptureAndSend()
    {
        if (captureCamera == null || renderTex == null)
        {
            Debug.LogWarning("[CaptureSender] Camera or RenderTexture not set.");
            return;
        }

        // カメラをRenderTextureに描画
        var prevTarget = captureCamera.targetTexture;
        captureCamera.targetTexture = renderTex;
        captureCamera.Render();
        captureCamera.targetTexture = prevTarget;

        // RenderTextureをTexture2Dに読み込み
        var prev = RenderTexture.active;
        RenderTexture.active = renderTex;

        var tex = new Texture2D(renderTex.width, renderTex.height, TextureFormat.RGBA32, false, false);
        tex.ReadPixels(new Rect(0, 0, renderTex.width, renderTex.height), 0, 0);
        tex.Apply(false, false);

        RenderTexture.active = prev;

        // RGBA生データを取得
        byte[] raw = tex.GetRawTextureData();

#if UNITY_WEBGL && !UNITY_EDITOR
        // JavaScript側にデータを送信
        var handle = GCHandle.Alloc(raw, GCHandleType.Pinned);
        try
        {
            ReceiveImageData(handle.AddrOfPinnedObject(), raw.Length, tex.width, tex.height);
        }
        finally
        {
            handle.Free();
        }
#else
        Debug.Log("[CaptureSender] ReceiveImageData is only available in WebGL builds.");
#endif

        // 一時テクスチャを破棄
        UnityEngine.Object.Destroy(tex);

        Debug.Log($"[CaptureSender] Sent {raw.Length} bytes ({renderTex.width}x{renderTex.height})");
    }
}
```

**重要ポイント**:
- `TextureFormat.RGBA32`: 1ピクセルあたり4バイト（R, G, B, A）
- `GCHandle.Alloc`: ガベージコレクション中にメモリが移動しないようにピン留め
- `#if UNITY_WEBGL && !UNITY_EDITOR`: エディタでは動作せず、WebGLビルドでのみ実行

---

### 3. シーン設定

1. **GameObjectの作成**
   - Hierarchyで右クリック → `Create Empty`
   - 名前を `Bridge` に変更（JavaScript側から `sendMessageToUnity("Bridge", "CaptureAndSend")` で呼び出すため）

2. **スクリプトのアタッチ**
   - `Bridge` オブジェクトに `CaptureSender` スクリプトをアタッチ

3. **Inspector設定**
   - **Capture Camera**: キャプチャ対象のカメラを割り当て（例: Main Camera）
   - **Render Tex**: 256x256のRenderTextureアセットを作成して割り当て

4. **RenderTexture作成**
   - Project → 右クリック → `Create` → `Render Texture`
   - 名前: `CaptureRT`
   - サイズ: `256 x 256`
   - Color Format: `ARGB32` または `Default`

---

### 4. WebGLビルド設定

**File → Build Settings → WebGL**

| 設定項目 | 推奨値 | 理由 |
|---------|--------|------|
| **Compression Format** | `Disabled` | Next.js dev サーバーで検証しやすい（本番では `Gzip` 推奨） |
| **Data Caching** | `Enabled` | ロード時間短縮 |
| **Code Optimization** | `Runtime Speed` | 実行速度優先 |

**Player Settings (Edit → Project Settings → Player → WebGL)**

| 設定項目 | 推奨値 |
|---------|--------|
| **Color Space** | `Linear` または `Gamma` |
| **Auto Graphics API** | `Enabled` |

---

## 🌐 Next.js側の実装状況

### 既に実装済みの項目

✅ **global.d.ts**: `window.onUnityImageReceived` の型定義
✅ **lib/unity.ts**: `sendMessageToUnity()` の実装
✅ **app/page.tsx**: 画像受信ハンドラの登録と Canvas 描画処理

### 動作フロー

```
1. ユーザーが「📸 Capture」ボタンをクリック
   ↓
2. sendMessageToUnity("Bridge", "CaptureAndSend") 実行
   ↓
3. Unity側の Bridge.CaptureAndSend() が呼ばれる
   ↓
4. RenderTextureをキャプチャして RGBA データを取得
   ↓
5. ReceiveImageData() で JavaScript に送信
   ↓
6. window.onUnityImageReceived(data, width, height) が呼ばれる
   ↓
7. Canvas (#rt-canv-0) に ImageData として描画
```

---

## ✅ 動作確認チェックリスト

### Next.js側

- [ ] `npm run dev` で http://localhost:3000 を開く
- [ ] ステータスが「準備完了」になる
- [ ] ブラウザコンソールに `[Bridge] Registering image receive handler...` が表示される

### Unity側

- [ ] WebGLビルドを `public/unity/Build/` に配置
- [ ] `lib/unity.ts` の `BUILD_BASE` がビルド名と一致
- [ ] シーンに `Bridge` GameObject が存在
- [ ] `CaptureSender` の `captureCamera` と `renderTex` が設定済み

### 統合テスト

- [ ] 「📸 Capture」ボタンを押す
- [ ] コンソールに `[Unity] Sent: Bridge.CaptureAndSend()` が表示される
- [ ] Unity Console に `[CaptureSender] Sent XXXX bytes (256x256)` が表示される
- [ ] ブラウザコンソールに `[Bridge] Received image data: XXXX bytes (256x256)` が表示される
- [ ] `#rt-canv-0` Canvas に画像が描画される

---

## 🐛 トラブルシューティング

### 問題: Canvas が真っ黒

**原因と解決策**:
- RenderTexture に何も描画されていない → カメラのレイヤー設定を確認
- カメラが無効化されている → `captureCamera.enabled = true` を確認
- 明るさが0 → Scene のライティング設定を確認

**検証方法**:
```csharp
// Unityエディタで RenderTexture の内容を確認
public RawImage debugDisplay;
debugDisplay.texture = renderTex; // Inspector で確認
```

---

### 問題: 画像が上下反転している

**原因**: Unity の座標系（Y軸上向き）と Canvas の座標系（Y軸下向き）の違い

**解決策**: `app/page.tsx` の以下のコメント部分を有効化

```typescript
// 上下反転描画
ctx.save();
ctx.translate(0, canvas.height);
ctx.scale(1, -1);
ctx.putImageData(imageData, 0, 0);
ctx.restore();
```

---

### 問題: `window.onUnityImageReceived is not defined`

**原因**: Next.jsページがまだマウントされていない、またはハンドラ登録前にUnityが送信

**解決策**:
- Unity初期化が完了してから（`status === "ready"`）ボタンを押す
- ブラウザコンソールで `window.onUnityImageReceived` が定義されているか確認

---

### 問題: データサイズが合わない

**期待値**: `width × height × 4` バイト（RGBA32の場合）

例: 256 × 256 × 4 = **262,144 バイト**

**確認方法**:
```csharp
Debug.Log($"Expected: {tex.width * tex.height * 4}, Actual: {raw.Length}");
```

一致しない場合は `TextureFormat.RGBA32` を再確認

---

## 📚 参考リンク

- [Unity WebGL Documentation](https://docs.unity3d.com/Manual/webgl-interactingwithbrowserscripting.html)
- [Canvas API - MDN](https://developer.mozilla.org/ja/docs/Web/API/Canvas_API)
- [Next.js App Router - useEffect](https://nextjs.org/docs/app/building-your-application/rendering/client-components#using-client-components)

---

## 📝 今後の拡張案

- [ ] 複数カメラ対応（パラメータでカメラIDを送信）
- [ ] PNG/JPEG圧縮してBase64で送信（データ量削減）
- [ ] リアルタイムストリーミング（毎フレーム送信）
- [ ] TypeScript で UnityInstance の型定義を強化

---

**最終更新**: 2025-11-06
**バージョン**: 1.0.0
