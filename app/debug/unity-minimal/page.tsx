"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

// Unity初期化の最小限の実装
const BUILD_BASE = "/unity/Build/haruka";

interface UnityConfig {
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string;
  streamingAssetsUrl: string;
  companyName: string;
  productName: string;
  productVersion: string;
  matchWebGLToCanvasSize?: boolean;
  devicePixelRatio?: number;
}

const LOGS_STORAGE_KEY = "unity-minimal-debug-logs";

export default function UnityMinimalDebugPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [memoryInfo, setMemoryInfo] = useState<{
    used: number;
    limit: number;
    percentage: number;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasInitialized = useRef(false);

  // コンポーネントマウント時に過去のログを読み込む
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLogs([
            "========== Previous Session Logs ==========",
            ...parsed,
            "========== Current Session ==========",
          ]);
        }
      }
    } catch (e) {
      console.error("Failed to load previous logs:", e);
    }
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setLogs((prev) => {
      const newLogs = [...prev, logEntry];

      // localStorage に保存（最新200行まで）
      try {
        const recentLogs = newLogs.slice(-200);
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(recentLogs));
      } catch (e) {
        console.error("Failed to save log:", e);
      }

      return newLogs;
    });
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Unity Bridge の準備完了を受け取る関数を定義
    (window as any).onBridgeReady = () => {
      addLog("✅ Unity Bridge is ready!");
      console.log("[Unity Bridge] Ready signal received from Unity");
    };

    // Unity からの画像受信関数を定義（ダミー）
    (window as any).onUnityImageReceived = (b64: string, w: number, h: number, index = 0) => {
      addLog(`📸 Image received: ${w}x${h}, index=${index}, size=${b64.length} chars`);
      console.log(`[Unity] Image received: ${w}x${h}, index=${index}`);
    };

    // デバイス情報を収集
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      memory: (navigator as any).deviceMemory || "unknown",
      cores: navigator.hardwareConcurrency || "unknown",
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      dpr: window.devicePixelRatio || 1,
      jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit
        ? `${((performance as any).memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} MB`
        : "unknown",
    };
    setDeviceInfo(info);
    addLog(`Device: ${JSON.stringify(info)}`);

    // メモリAPIの利用可否をチェック
    const hasMemoryAPI = !!(performance as any).memory;
    addLog(`💾 Memory API available: ${hasMemoryAPI ? "YES" : "NO"}`);

    if (!hasMemoryAPI) {
      addLog(`⚠️ performance.memory is not available on this browser`);
      addLog(`   This is a Chrome-specific API and may not work on mobile Safari`);
    }

    // メモリ監視を開始
    const memoryCheckInterval = setInterval(() => {
      if ((performance as any).memory) {
        const mem = (performance as any).memory;
        const used = parseFloat((mem.usedJSHeapSize / 1024 / 1024).toFixed(0));
        const limit = parseFloat((mem.jsHeapSizeLimit / 1024 / 1024).toFixed(0));
        const percentage = parseFloat(((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1));

        // State を更新（UI表示用）
        setMemoryInfo({ used, limit, percentage });

        addLog(`💾 Memory: ${used}/${limit} MB (${percentage}%)`);

        // メモリ使用率が90%を超えたら警告
        if (percentage > 90) {
          addLog(`⚠️ WARNING: Memory usage critical! ${percentage}%`);
        }
      } else {
        // メモリAPIが利用できない場合でも、UIを表示するために固定値を設定
        setMemoryInfo({ used: 0, limit: 0, percentage: 0 });
      }
    }, 2000); // 2秒ごとにチェック（より頻繁に）

    const initUnity = async () => {
      try {
        setStatus("loading");
        addLog("Starting Unity initialization...");

        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error("Canvas element not found");
        }

        addLog(`Canvas found: ${canvas.width}x${canvas.height}`);

        // ローダースクリプトを読み込む
        addLog(`Loading Unity loader from: ${BUILD_BASE}.loader.js`);
        const loaderStartTime = Date.now();

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `${BUILD_BASE}.loader.js`;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load script: ${BUILD_BASE}.loader.js`));
          document.body.appendChild(script);
        });

        const loaderTime = Date.now() - loaderStartTime;
        addLog(`Loader loaded in ${loaderTime}ms`);

        // createUnityInstance が利用可能か確認
        if (typeof (window as any).createUnityInstance !== "function") {
          throw new Error("createUnityInstance is not available");
        }
        addLog("createUnityInstance is available");

        // Unity ファイルの圧縮形式を検出
        try {
          const checkCompression = async () => {
            const dataUrl = `${BUILD_BASE}.data`;
            const response = await fetch(dataUrl, { method: "HEAD" });
            const contentEncoding = response.headers.get("content-encoding");
            const contentLength = response.headers.get("content-length");
            const actualUrl = response.url;

            addLog(`📦 Unity Compression Check:`);
            addLog(`  - URL requested: ${dataUrl}`);
            addLog(`  - URL resolved: ${actualUrl}`);
            addLog(`  - Content-Encoding: ${contentEncoding || "none"}`);
            addLog(`  - Content-Length: ${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + " MB" : "unknown"}`);

            if (contentEncoding === "gzip") {
              addLog(`  ✅ GZIP compression is active!`);
            } else if (actualUrl.endsWith(".gz")) {
              addLog(`  ⚠️ File is .gz but Content-Encoding header is missing`);
            } else {
              addLog(`  ❌ No compression detected (uncompressed build)`);
            }
          };

          await checkCompression();
        } catch (e) {
          addLog(`⚠️ Failed to check compression: ${e}`);
        }

        // Unity設定
        const config: UnityConfig = {
          dataUrl: `${BUILD_BASE}.data`,
          frameworkUrl: `${BUILD_BASE}.framework.js`,
          codeUrl: `${BUILD_BASE}.wasm`,
          streamingAssetsUrl: "StreamingAssets",
          companyName: "DefaultCompany",
          productName: "Haruka WebGL",
          productVersion: "0.3.0",
          matchWebGLToCanvasSize: false,
          devicePixelRatio: 1,
        };

        addLog("Creating Unity instance...");
        const instanceStartTime = Date.now();

        // タイムアウト設定（90秒）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Unity initialization timed out after 90 seconds"));
          }, 90000);
        });

        const createInstancePromise = (window as any).createUnityInstance(
          canvas,
          config,
          (p: number) => {
            const progressPercent = Math.round(p * 100);
            setProgress(progressPercent);
            addLog(`Progress: ${progressPercent}%`);
          }
        );

        const instance = await Promise.race([createInstancePromise, timeoutPromise]);

        const instanceTime = Date.now() - instanceStartTime;
        addLog(`Unity instance created in ${(instanceTime / 1000).toFixed(2)}s`);

        (window as any).unityInstance = instance;

        // Canvas にフォーカスを設定（キーボード入力を確実に受け取るため）
        if (canvas) {
          canvas.focus();
          addLog("Canvas focused for keyboard input");
        }

        addLog("Unity initialized successfully!");
        setStatus("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        addLog(`ERROR: ${message}`);
        console.error("Unity initialization failed:", err);
        setStatus("error");
      }
    };

    initUnity();

    return () => {
      // クリーンアップ: グローバル関数を削除
      delete (window as any).onBridgeReady;
      delete (window as any).onUnityImageReceived;

      // メモリ監視を停止
      clearInterval(memoryCheckInterval);
    };
  }, []);

  const copyLogs = () => {
    const text = [
      "========== Unity Minimal Debug Logs ==========",
      "",
      "Device Info:",
      JSON.stringify(deviceInfo, null, 2),
      "",
      "Logs:",
      ...logs,
    ].join("\n");

    navigator.clipboard.writeText(text);
    alert("ログをクリップボードにコピーしました");
  };

  const clearLogs = () => {
    if (confirm("ログをクリアしてページを再読み込みしますか？")) {
      localStorage.removeItem(LOGS_STORAGE_KEY);
      window.location.reload();
    }
  };

  const getMemoryColor = () => {
    if (!memoryInfo) return "#4CAF50";
    if (memoryInfo.percentage >= 90) return "#f44336"; // 赤
    if (memoryInfo.percentage >= 75) return "#FF9800"; // オレンジ
    if (memoryInfo.percentage >= 50) return "#FFC107"; // 黄色
    return "#4CAF50"; // 緑
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto", fontFamily: "monospace" }}>
      {/* メモリ使用量の固定表示 */}
      <div
        style={{
          position: "fixed",
          top: "10px",
          left: "10px",
          background: "rgba(0, 0, 0, 0.9)",
          color: "white",
          padding: "12px 16px",
          borderRadius: "8px",
          zIndex: 10000,
          border: `3px solid ${getMemoryColor()}`,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "4px" }}>
          MEMORY USAGE
        </div>
        {memoryInfo && memoryInfo.limit > 0 ? (
          <>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: getMemoryColor() }}>
              {memoryInfo.percentage.toFixed(1)}%
            </div>
            <div style={{ fontSize: "14px", marginTop: "4px" }}>
              {memoryInfo.used} / {memoryInfo.limit} MB
            </div>
            {memoryInfo.percentage >= 90 && (
              <div style={{ fontSize: "12px", color: "#f44336", marginTop: "4px", fontWeight: "bold" }}>
                ⚠️ CRITICAL!
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#FF9800" }}>
              N/A
            </div>
            <div style={{ fontSize: "11px", marginTop: "4px", opacity: 0.8 }}>
              API not available
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Unity Minimal Debug</h1>
        <Link href="/" style={{ padding: "8px 16px", background: "#667eea", color: "white", borderRadius: "4px", textDecoration: "none" }}>
          ← Back
        </Link>
      </div>

      {/* Status */}
      <div style={{ marginBottom: "20px", padding: "16px", background: "#f5f5f5", borderRadius: "8px" }}>
        <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>
          Status: {status.toUpperCase()}
        </div>
        {status === "loading" && (
          <div>
            <div style={{ marginBottom: "8px" }}>Progress: {progress}%</div>
            <div style={{ width: "100%", height: "20px", background: "#ddd", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #4CAF50, #8BC34A)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}
        {status === "ready" && (
          <div style={{ color: "#4CAF50", fontWeight: "bold" }}>
            ✅ Unity initialized successfully!
          </div>
        )}
        {status === "error" && (
          <div style={{ color: "#f44336", fontWeight: "bold" }}>
            ❌ Unity initialization failed
          </div>
        )}
      </div>

      {/* Device Info */}
      {deviceInfo && (
        <div style={{ marginBottom: "20px", padding: "16px", background: "#f5f5f5", borderRadius: "8px" }}>
          <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "8px" }}>Device Information</div>
          <pre style={{ fontSize: "11px", overflow: "auto", margin: 0 }}>
            {JSON.stringify(deviceInfo, null, 2)}
          </pre>
        </div>
      )}

      {/* Canvas */}
      <div style={{ marginBottom: "20px", padding: "16px", background: "#000", borderRadius: "8px", textAlign: "center" }}>
        <canvas
          ref={canvasRef}
          id="unity-canvas"
          tabIndex={0}
          style={{
            border: "2px solid #333",
            borderRadius: "4px",
            maxWidth: "100%",
            outline: "none",
          }}
          width={640}
          height={480}
        />
      </div>

      {/* Logs */}
      <div style={{ marginBottom: "20px", padding: "16px", background: "#f5f5f5", borderRadius: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>Logs ({logs.length})</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={copyLogs}
              style={{
                padding: "6px 12px",
                background: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              📋 Copy All Logs
            </button>
            <button
              onClick={clearLogs}
              style={{
                padding: "6px 12px",
                background: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              🗑️ Clear Logs
            </button>
          </div>
        </div>
        <div
          style={{
            maxHeight: "400px",
            overflow: "auto",
            background: "#1a1a1a",
            color: "#0f0",
            padding: "12px",
            borderRadius: "4px",
            fontSize: "11px",
            lineHeight: "1.4",
          }}
        >
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
