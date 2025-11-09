# Unity 側 Bridge 実装ガイド

## 🎯 現在の状況

Web 側から `Bridge.StartCapture(index=0;intervalMs=500)` は正しく送信されていますが、Unity から画像が返ってきていません。

## 📋 必要な実装

### 1. Bridge.cs（完全版）

Unity プロジェクトの `Assets/Scripts/Bridge.cs` を作成または更新してください：

```csharp
using UnityEngine;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class Bridge : MonoBehaviour
{
    #if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void eval(string code);
    #endif

    private Dictionary<int, CaptureSender> captureSenders = new Dictionary<int, CaptureSender>();

    void Start()
    {
        Debug.Log("[Bridge] Initializing...");

        // すべての CaptureSender を検索して登録
        CaptureSender[] senders = FindObjectsOfType<CaptureSender>();
        Debug.Log($"[Bridge] Found {senders.Length} CaptureSender(s)");

        foreach (var sender in senders)
        {
            if (sender.Index >= 0)
            {
                captureSenders[sender.Index] = sender;
                sender.enabled = false; // 初期状態は無効
                Debug.Log($"[Bridge] Registered CaptureSender index={sender.Index}");
            }
        }

        // Web 側に準備完了を通知
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            eval("window.onBridgeReady && window.onBridgeReady()");
            Debug.Log("[Bridge] ✅ Sent ready signal to JavaScript");
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[Bridge] Failed to send ready signal: {e.Message}");
        }
        #else
        Debug.Log("[Bridge] ⚠️ Not WebGL build, skipping ready signal");
        #endif
    }

    /// <summary>
    /// Web 側から呼ばれる：キャプチャを開始
    /// payload 例: "index=0;intervalMs=500"
    /// </summary>
    public void StartCapture(string payload)
    {
        Debug.Log($"[Bridge] StartCapture called with payload: {payload}");

        try
        {
            var parts = payload.Split(';');
            int index = -1;
            int intervalMs = 500;

            foreach (var part in parts)
            {
                var kv = part.Split('=');
                if (kv.Length == 2)
                {
                    if (kv[0] == "index")
                    {
                        index = int.Parse(kv[1]);
                    }
                    else if (kv[0] == "intervalMs")
                    {
                        intervalMs = int.Parse(kv[1]);
                    }
                }
            }

            if (index < 0)
            {
                Debug.LogError($"[Bridge] Invalid index in payload: {payload}");
                return;
            }

            if (captureSenders.ContainsKey(index))
            {
                var sender = captureSenders[index];
                sender.intervalMs = intervalMs;
                sender.enabled = true;
                Debug.Log($"[Bridge] ✅ Started capture for index={index}, intervalMs={intervalMs}");
            }
            else
            {
                Debug.LogError($"[Bridge] CaptureSender index={index} not found!");
                Debug.Log($"[Bridge] Available indexes: {string.Join(", ", captureSenders.Keys)}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[Bridge] StartCapture error: {e.Message}");
        }
    }

    /// <summary>
    /// Web 側から呼ばれる：キャプチャを停止
    /// payload 例: "index=0"
    /// </summary>
    public void StopCapture(string payload)
    {
        Debug.Log($"[Bridge] StopCapture called with payload: {payload}");

        try
        {
            var parts = payload.Split('=');
            if (parts.Length == 2 && parts[0] == "index")
            {
                int index = int.Parse(parts[1]);

                if (captureSenders.ContainsKey(index))
                {
                    captureSenders[index].enabled = false;
                    Debug.Log($"[Bridge] ✅ Stopped capture for index={index}");
                }
                else
                {
                    Debug.LogError($"[Bridge] CaptureSender index={index} not found!");
                }
            }
            else
            {
                Debug.LogError($"[Bridge] Invalid payload: {payload}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[Bridge] StopCapture error: {e.Message}");
        }
    }

    /// <summary>
    /// Web 側から呼ばれる：キャプチャ間隔を変更
    /// payload 例: "index=0;intervalMs=250"
    /// </summary>
    public void SetInterval(string payload)
    {
        Debug.Log($"[Bridge] SetInterval called with payload: {payload}");

        try
        {
            var parts = payload.Split(';');
            int index = -1;
            int intervalMs = 500;

            foreach (var part in parts)
            {
                var kv = part.Split('=');
                if (kv.Length == 2)
                {
                    if (kv[0] == "index")
                    {
                        index = int.Parse(kv[1]);
                    }
                    else if (kv[0] == "intervalMs")
                    {
                        intervalMs = int.Parse(kv[1]);
                    }
                }
            }

            if (index >= 0 && captureSenders.ContainsKey(index))
            {
                captureSenders[index].intervalMs = intervalMs;
                Debug.Log($"[Bridge] ✅ Set interval for index={index} to {intervalMs}ms");
            }
            else
            {
                Debug.LogError($"[Bridge] Invalid index or not found: {index}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[Bridge] SetInterval error: {e.Message}");
        }
    }
}
```

---

### 2. CaptureSender.cs に必要な公開プロパティ

`CaptureSender.cs` で以下のプロパティが `public` であることを確認してください：

```csharp
public class CaptureSender : MonoBehaviour
{
    public int Index = 0;           // ⭐ これが public である必要がある
    public int intervalMs = 500;    // ⭐ これが public である必要がある

    // その他のフィールド...
}
```

---

### 3. GameObject 構成の確認

Unity Scene の Hierarchy で以下の構成になっていることを確認：

```
[Scene Hierarchy]
├── Bridge  ← Bridge.cs がアタッチされている
├── CaptureSender_0  ← CaptureSender.cs がアタッチ、Index=0 に設定
│   └── (MangaCamera への参照など)
└── MangaCamera  ← RenderTexture に描画するカメラ
```

**重要**: GameObject の名前は何でも良いですが、`CaptureSender` コンポーネントの `Index` プロパティが正しく設定されている必要があります。

---

### 4. WebGL ビルド設定の確認

Unity Editor のメニューから：

1. **File > Build Settings**
2. **Platform: WebGL** を選択
3. **Player Settings > Other Settings > Configuration**
   - **API Compatibility Level**: `.NET 4.x` または `.NET Standard 2.1`
4. **Build** を実行

---

## 🧪 デバッグ手順

### Unity エディタでの確認

1. Unity Console で以下のログが出るか確認：
   ```
   [Bridge] Initializing...
   [Bridge] Found 1 CaptureSender(s)
   [Bridge] Registered CaptureSender index=0
   ```

2. Web 側から Start を送信した時：
   ```
   [Bridge] StartCapture called with payload: index=0;intervalMs=500
   [Bridge] ✅ Started capture for index=0, intervalMs=500
   ```

3. エラーが出る場合：
   ```
   [Bridge] CaptureSender index=0 not found!
   [Bridge] Available indexes: (空の場合、CaptureSender が見つかっていない)
   ```

### ビルド後の確認

WebGL ビルドを実行し、ブラウザの Unity Console（赤いボタンをクリック）で同様のログを確認してください。

---

## 🔍 よくある問題

### 問題 1: "CaptureSender index=0 not found!"

**原因**: `CaptureSender` コンポーネントの `Index` プロパティが設定されていない、または GameObject が無効

**解決策**:
- Scene の Hierarchy で `CaptureSender` コンポーネントがアタッチされた GameObject を探す
- Inspector で `Index` が `0` に設定されていることを確認
- GameObject が有効（チェックボックスがオン）であることを確認

### 問題 2: "Found 0 CaptureSender(s)"

**原因**: `CaptureSender` コンポーネントが Scene に存在しない

**解決策**:
- Scene に `CaptureSender` コンポーネントを持つ GameObject を追加
- または既存の GameObject に `CaptureSender.cs` をアタッチ

### 問題 3: Bridge の準備完了シグナルが送られない

**原因**: WebGL ビルドではない、または `eval()` が利用できない

**解決策**:
- Platform が WebGL になっていることを確認
- ビルドを実行してブラウザで確認
- Unity Editor では動作しない（`#if UNITY_WEBGL && !UNITY_EDITOR` による）

---

## ✅ 実装完了後の期待される動作

1. Web ページを開くと、ブラウザコンソールに：
   ```
   [Unity] 🎯 Bridge is ready!
   ```

2. Unity パネルが可視範囲に入ると：
   ```
   [Unity] ✅ Sent: Bridge.StartCapture("index=0;intervalMs=500")
   [Unity] 📋 Details: GameObject="Bridge", Method="StartCapture", Param="index=0;intervalMs=500"
   ```

3. Unity Console に：
   ```
   [Bridge] StartCapture called with payload: index=0;intervalMs=500
   [Bridge] ✅ Started capture for index=0, intervalMs=500
   [CaptureSender] Starting capture (index=0)...
   ```

4. Web 側のデバッグパネルで：
   - **Bridge Ready**: ✅ Ready
   - **Images Received**: 1, 2, 3... (増加)

---

## 📞 次のステップ

1. 上記の `Bridge.cs` を実装
2. `CaptureSender.cs` の `Index` プロパティが `public` であることを確認
3. Unity でビルド
4. ブラウザで動作確認
5. Unity Console と Browser Console の両方でログを確認

問題が解決しない場合は、Unity Console のログ全体を共有してください。
