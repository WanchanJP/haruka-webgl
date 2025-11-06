"use client";

import { useCallback, useEffect, useState } from "react";
import { loadUnity, sendMessageToUnity, drawBase64ToCanvas } from "@/lib/unity";

type UnityStatus = "idle" | "loading" | "ready" | "error";

/**
 * テスト用のチェッカーボード画像を生成（Unityなしで動作確認用）
 * @param size - 画像サイズ（正方形）
 * @returns Base64エンコードされたPNG画像データ（プレフィックスなし）
 */
function generateTestImageBase64(size = 256): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const tile = size / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#ddd" : "#555";
      g.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  g.fillStyle = "#e91e63";
  g.fillRect(size * 0.35, size * 0.35, size * 0.3, size * 0.3);
  return c.toDataURL("image/png").split(",")[1]; // base64部分のみ
}

export default function Home() {
  const [status, setStatus] = useState<UnityStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Unity初期化
  useEffect(() => {
    const initUnity = async () => {
      setStatus("loading");
      setErrorMessage("");

      try {
        console.log("Starting Unity initialization from page.tsx...");

        // タイムアウト設定（60秒）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Unity initialization timed out after 60 seconds. Check browser console for details."
              )
            );
          }, 60000);
        });

        // Unity初期化とタイムアウトを競合させる
        await Promise.race([loadUnity(), timeoutPromise]);

        console.log("Unity initialization completed successfully");
        setStatus("ready");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Unity initialization failed:", error);
        setErrorMessage(message);
        setStatus("error");
      }
    };

    initUnity();
  }, []);

  // Captureボタンハンドラ（Unity → JavaScript）
  const handleCapture = useCallback(() => {
    if (status !== "ready") {
      console.warn("Unity is not ready yet");
      return;
    }

    // Unity側のBridge.CaptureAndSendを呼び出す
    sendMessageToUnity("Bridge", "CaptureAndSend");
  }, [status]);

  // テスト描画ハンドラ（Unityなし）
  const handleTestDraw = useCallback(() => {
    const b64 = generateTestImageBase64(256);
    // window.onUnityImageReceived が登録されていればそれを使用、なければ直接描画
    if (window.onUnityImageReceived) {
      window.onUnityImageReceived(b64, 256, 256, 0);
    } else {
      drawBase64ToCanvas(b64, 256, 256, 0);
    }
  }, []);

  // ステータス表示用のラベルと色
  const getStatusDisplay = () => {
    switch (status) {
      case "idle":
        return { label: "待機中", color: "#666" };
      case "loading":
        return { label: "Unity読み込み中...", color: "#2196F3" };
      case "ready":
        return { label: "準備完了", color: "#4CAF50" };
      case "error":
        return { label: "エラー", color: "#F44336" };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <main className="container">
      <h1>Haruka WebGL</h1>

      {/* ステータス表示 */}
      <section className="status-section">
        <div className="status-indicator">
          <span
            className="status-badge"
            style={{ backgroundColor: statusDisplay.color }}
          >
            {statusDisplay.label}
          </span>
          {errorMessage && (
            <div className="error-message">
              <strong>エラー詳細:</strong> {errorMessage}
            </div>
          )}
        </div>
      </section>

      {/* Unity埋め込みエリア */}
      <section className="unity-section">
        <h2>Unity Content</h2>
        <div id="unity-root" className="unity-container">
          {/* Unity実キャンバス */}
          <canvas
            id="unity-canvas"
            className="unity-canvas"
            style={{
              width: "640px",
              height: "480px",
              display: "block",
            }}
          />
          <p className="unity-hint">
            Unity WebGLがバックグラウンドで実行中です
          </p>
        </div>
      </section>

      {/* Canvas Previewセクション（受け取り用） */}
      <section className="canvas-section">
        <h2>Canvas Preview</h2>
        <div style={{ fontSize: "0.875rem", opacity: 0.7, marginBottom: "0.5rem" }}>
          Receiver: #rt-canv-0
        </div>
        <canvas
          id="rt-canv-0"
          className="preview-canvas"
          style={{
            width: "256px",
            height: "256px",
          }}
        >
          Canvas not supported
        </canvas>
        <p className="canvas-hint">受信データがここに描画されます</p>
      </section>

      {/* 操作パネル */}
      <section className="control-section">
        <h2>操作</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            className="capture-button"
            onClick={handleCapture}
            disabled={status !== "ready"}
            title="Unity から画像をキャプチャ（Unity起動済みが必要）"
          >
            📸 Capture
          </button>
          <button
            className="test-button"
            onClick={handleTestDraw}
            title="UnityなしでCanvas描画をテスト"
          >
            🧪 Canvasテスト（Unityなし）
          </button>
        </div>
        <p className="control-hint">
          {status === "ready"
            ? "📸: Unity からキャプチャ / 🧪: Unityなしテスト"
            : "Unity準備中... 🧪ボタンは使用可能です"}
        </p>
      </section>
    </main>
  );
}
