"use client";

import { useCallback, useEffect, useState } from "react";
import { loadUnity, sendMessageToUnity, drawBase64ToCanvas, startUnityCapture, stopUnityCapture, setUnityCaptureInterval } from "@/lib/unity";
import Link from "next/link";
import "@/app/globals.css";

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

export default function DebugUnityPage() {
  const [status, setStatus] = useState<UnityStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Unity初期化
  useEffect(() => {
    const initUnity = async () => {
      setStatus("loading");
      setErrorMessage("");

      try {
        console.log("Starting Unity initialization from /debug/unity...");

        // タイムアウト設定（90秒）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Unity initialization timed out after 90 seconds. Check browser console for details."
              )
            );
          }, 90000);
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

  // 継続的キャプチャの制御
  const handleStartCapture = useCallback(() => {
    if (status !== "ready") {
      console.warn("Unity is not ready yet");
      return;
    }
    startUnityCapture(0, 500);
  }, [status]);

  const handleStopCapture = useCallback(() => {
    if (status !== "ready") {
      console.warn("Unity is not ready yet");
      return;
    }
    stopUnityCapture(0);
  }, [status]);

  const handleSetInterval = useCallback((intervalMs: number) => {
    if (status !== "ready") {
      console.warn("Unity is not ready yet");
      return;
    }
    setUnityCaptureInterval(0, intervalMs);
  }, [status]);

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
      <div style={{ width: "100%", marginBottom: "1rem" }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.5rem 1rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "4px",
            textDecoration: "none",
            color: "#333",
            fontSize: "0.875rem",
            transition: "all 0.2s ease",
          }}
        >
          ← ホームに戻る
        </Link>
        <Link
          href="/debug/unity-minimal"
          style={{
            display: "inline-block",
            padding: "0.5rem 1rem",
            background: "#FF9800",
            color: "white",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: "500",
          }}
        >
          🔬 Minimal Debug
        </Link>
      </div>

      <h1>Unity WebGL Debug Page</h1>

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
            tabIndex={0}
            className="unity-canvas"
            style={{
              width: "640px",
              height: "480px",
              display: "block",
              outline: "none",
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

        <h3 style={{ fontSize: "1rem", marginTop: "1rem", marginBottom: "0.5rem" }}>単発キャプチャ</h3>
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

        <h3 style={{ fontSize: "1rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>継続的キャプチャ制御 (index=0)</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <button
            onClick={handleStartCapture}
            disabled={status !== "ready"}
            style={{
              padding: "0.5rem 1rem",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: status === "ready" ? "pointer" : "not-allowed",
              opacity: status === "ready" ? 1 : 0.5,
            }}
            title="継続的キャプチャを開始 (500ms間隔)"
          >
            ▶️ Start (500ms)
          </button>
          <button
            onClick={handleStopCapture}
            disabled={status !== "ready"}
            style={{
              padding: "0.5rem 1rem",
              background: "#F44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: status === "ready" ? "pointer" : "not-allowed",
              opacity: status === "ready" ? 1 : 0.5,
            }}
            title="継続的キャプチャを停止"
          >
            ⏹️ Stop
          </button>
        </div>

        <h3 style={{ fontSize: "1rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>間隔変更</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => handleSetInterval(250)}
            disabled={status !== "ready"}
            style={{
              padding: "0.5rem 1rem",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: status === "ready" ? "pointer" : "not-allowed",
              opacity: status === "ready" ? 1 : 0.5,
            }}
            title="キャプチャ間隔を250msに設定"
          >
            ⚡ 250ms
          </button>
          <button
            onClick={() => handleSetInterval(500)}
            disabled={status !== "ready"}
            style={{
              padding: "0.5rem 1rem",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: status === "ready" ? "pointer" : "not-allowed",
              opacity: status === "ready" ? 1 : 0.5,
            }}
            title="キャプチャ間隔を500msに設定"
          >
            ⚙️ 500ms
          </button>
          <button
            onClick={() => handleSetInterval(1000)}
            disabled={status !== "ready"}
            style={{
              padding: "0.5rem 1rem",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: status === "ready" ? "pointer" : "not-allowed",
              opacity: status === "ready" ? 1 : 0.5,
            }}
            title="キャプチャ間隔を1000msに設定"
          >
            🐢 1000ms
          </button>
        </div>

        <p className="control-hint" style={{ marginTop: "1rem" }}>
          {status === "ready"
            ? "▶️ Start でキャプチャ開始 / ⏹️ Stop で停止 / 間隔ボタンで速度変更"
            : "Unity準備中..."}
        </p>
      </section>
    </main>
  );
}
