"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/app/globals.css";

export default function DebugPage() {
  const [info, setInfo] = useState({
    hasOnUnityImageReceived: false,
    onUnityImageReceivedType: "undefined",
    hasCanvas: false,
    canvasWidth: 0,
    canvasHeight: 0,
    userAgent: "",
  });

  useEffect(() => {
    const canvas = document.getElementById("rt-canv-0") as HTMLCanvasElement | null;
    setInfo({
      hasOnUnityImageReceived: typeof window.onUnityImageReceived === "function",
      onUnityImageReceivedType: typeof window.onUnityImageReceived,
      hasCanvas: canvas !== null,
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      userAgent: navigator.userAgent,
    });
  }, []);

  const handleTestReceive = () => {
    if (typeof window.onUnityImageReceived !== "function") {
      alert("window.onUnityImageReceived is not registered!");
      return;
    }

    // 128x128のグラデーションテスト画像を生成
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, "#00c6ff");
    grad.addColorStop(1, "#0072ff");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#fff";
    g.font = "20px sans-serif";
    g.fillText("Test", 40, 70);

    const b64 = c.toDataURL("image/png").split(",")[1];
    window.onUnityImageReceived(b64, 128, 128, 0);
  };

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
      </div>

      <h1>System Debug Page</h1>

      <section>
        <h2>Runtime Information</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.75rem", fontWeight: "600" }}>
                window.onUnityImageReceived
              </td>
              <td style={{ padding: "0.75rem" }}>
                {info.hasOnUnityImageReceived ? (
                  <span style={{ color: "#4CAF50", fontWeight: "600" }}>✅ Registered</span>
                ) : (
                  <span style={{ color: "#F44336", fontWeight: "600" }}>❌ Not found</span>
                )}
                {` (${info.onUnityImageReceivedType})`}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.75rem", fontWeight: "600" }}>
                Canvas #rt-canv-0
              </td>
              <td style={{ padding: "0.75rem" }}>
                {info.hasCanvas ? (
                  <span style={{ color: "#4CAF50", fontWeight: "600" }}>
                    ✅ Found ({info.canvasWidth}x{info.canvasHeight})
                  </span>
                ) : (
                  <span style={{ color: "#F44336", fontWeight: "600" }}>❌ Not found</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "0.75rem", fontWeight: "600" }}>User Agent</td>
              <td
                style={{
                  padding: "0.75rem",
                  fontSize: "0.75rem",
                  wordBreak: "break-all",
                }}
              >
                {info.userAgent}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Canvas Receiver Test</h2>
        <canvas
          id="rt-canv-0"
          className="preview-canvas"
          style={{
            width: "128px",
            height: "128px",
            margin: "1rem auto",
          }}
        >
          Canvas not supported
        </canvas>
        <button
          className="test-button"
          onClick={handleTestReceive}
          style={{ display: "block", margin: "0 auto" }}
        >
          🧪 Test onUnityImageReceived
        </button>
        <p className="canvas-hint">
          Click the button to manually call window.onUnityImageReceived with test data
        </p>
      </section>

      <section>
        <h2>Navigation</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link
            href="/debug/unity"
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            🔧 Unity Debug Page
          </Link>
        </div>
      </section>
    </main>
  );
}
