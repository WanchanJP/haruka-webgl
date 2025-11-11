"use client";

import { useEffect, useState, useRef } from "react";
import { loadUnity } from "@/lib/unity";

/**
 * 不可視の Unity ホスト
 * ルートページ（/）でバックグラウンドで Unity を起動し、
 * キャプチャ機能を提供する
 */
// ログをlocalStorageに永続化するキー
const DIAGNOSTICS_STORAGE_KEY = "unity-diagnostics-logs";
const MAX_STORED_ATTEMPTS = 5; // 最大5回分のログを保持

export default function HiddenUnityHost() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const initAttemptRef = useRef(0); // コンポーネントのマウント回数を追跡
  const hasInitialized = useRef(false); // 初期化済みフラグ（StrictMode対策）

  useEffect(() => {
    // StrictModeで二重実行されるのを防ぐ
    if (hasInitialized.current) {
      console.log("[HiddenUnityHost] Already initialized, skipping (StrictMode double-mount)");
      return;
    }

    let mounted = true;
    initAttemptRef.current += 1;
    const currentAttempt = initAttemptRef.current;
    const logs: string[] = [];

    // 既存のログを読み込む
    const loadPreviousLogs = () => {
      try {
        const stored = localStorage.getItem(DIAGNOSTICS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.error("[HiddenUnityHost] Failed to load previous logs:", e);
      }
      return [];
    };

    const previousLogs = loadPreviousLogs();

    const addLog = (message: string) => {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}`;
      logs.push(logEntry);
      console.log(message);

      // localStorageに保存（最大5回分）
      try {
        const allLogs = [...previousLogs, logEntry];
        const recentLogs = allLogs.slice(-200); // 最新200行のみ保持
        localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(recentLogs));
      } catch (e) {
        console.error("[HiddenUnityHost] Failed to save log:", e);
      }
    };

    addLog(`[HiddenUnityHost] 🔄 Component mounted (attempt #${currentAttempt})`);

    // デバイス情報を収集
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      memory: (navigator as any).deviceMemory || "unknown",
      cores: navigator.hardwareConcurrency || "unknown",
      connection: (navigator as any).connection?.effectiveType || "unknown",
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      webgl: (() => {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) return "not supported";
          const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            return (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
          return "supported";
        } catch (e) {
          return "error checking";
        }
      })(),
    };

    addLog(`[HiddenUnityHost] Device Info: ${JSON.stringify(deviceInfo, null, 2)}`);

    const initUnity = async () => {
      try {
        // 既に初期化済みならスキップ
        if ((window as any).unityInstance) {
          addLog(`[HiddenUnityHost] Unity instance already exists (attempt #${currentAttempt}), reusing`);
          setStatus("ready");
          return;
        }

        setStatus("loading");
        addLog(`[HiddenUnityHost] Initializing hidden Unity instance (attempt #${currentAttempt})...`);

        // 隠しキャンバスが無ければ作成
        let canvas = document.getElementById(
          "unity-canvas"
        ) as HTMLCanvasElement | null;

        if (!canvas) {
          addLog("[HiddenUnityHost] Creating hidden canvas element");
          canvas = document.createElement("canvas");
          canvas.id = "unity-canvas";
          canvas.tabIndex = 0; // iOS Safari でキーボードフォーカスを有効化
          canvas.style.position = "fixed";
          canvas.style.left = "-9999px";
          canvas.style.top = "-9999px";
          canvas.style.width = "640px";
          canvas.style.height = "480px";
          canvas.style.pointerEvents = "none";
          canvas.style.zIndex = "-1000";
          document.body.appendChild(canvas);
        } else {
          addLog("[HiddenUnityHost] Canvas element already exists");
        }

        // Unity 初期化（タイムアウト付き・プログレス表示付き）
        addLog("[HiddenUnityHost] Setting up Unity loader...");
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            addLog("[HiddenUnityHost] ❌ Timeout reached (90 seconds)");
            reject(
              new Error(
                "Unity initialization timed out after 90 seconds"
              )
            );
          }, 90000);
        });

        // 疑似プログレスバー（Unity が実際のプログレスを報告しない場合の代替）
        let fakeProgress = 0;
        const progressInterval = setInterval(() => {
          if (fakeProgress < 90) {
            fakeProgress += Math.random() * 2; // ランダムに増加（最大90%まで）
            if (mounted) {
              setProgress(Math.round(fakeProgress));
            }
          }
        }, 200);

        // グローバルエラーハンドラを設定
        const errorHandler = (event: ErrorEvent) => {
          addLog(`[Window Error] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
        };
        const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
          addLog(`[Unhandled Rejection] ${event.reason}`);
        };
        window.addEventListener('error', errorHandler);
        window.addEventListener('unhandledrejection', unhandledRejectionHandler);

        try {
          addLog("[HiddenUnityHost] Calling loadUnity()...");
          const startTime = Date.now();

          await Promise.race([
            loadUnity((p) => {
              const progressPercent = (p * 100).toFixed(1);
              addLog(`[HiddenUnityHost] Progress: ${progressPercent}%`);
              if (mounted) {
                clearInterval(progressInterval);
                setProgress(Math.round(p * 100));
              }
            }),
            timeoutPromise,
          ]);

          const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
          addLog(`[HiddenUnityHost] ✅ Unity loaded successfully in ${loadTime}s`);
        } catch (loadError) {
          addLog(`[HiddenUnityHost] ❌ Load error: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
          throw loadError;
        } finally {
          clearInterval(progressInterval);
          window.removeEventListener('error', errorHandler);
          window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
          if (mounted) {
            setProgress(100);
          }
        }

        if (mounted) {
          addLog(`[HiddenUnityHost] ✅ Initialization complete (attempt #${currentAttempt})`);
          hasInitialized.current = true; // 成功したらフラグを立てる
          setStatus("ready");

          // 成功したらログをクリア
          try {
            localStorage.removeItem(DIAGNOSTICS_STORAGE_KEY);
          } catch (e) {
            console.error("[HiddenUnityHost] Failed to clear logs:", e);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const stack = err instanceof Error ? err.stack : undefined;

        addLog(`[HiddenUnityHost] ❌ Fatal error: ${message}`);
        if (stack) {
          addLog(`[HiddenUnityHost] Stack trace: ${stack}`);
        }

        console.error(
          `[HiddenUnityHost] ❌ Unity initialization failed (attempt #${currentAttempt}):`,
          err
        );

        if (mounted) {
          setError(message);

          // 全てのログ（過去の試行分も含む）を診断情報に含める
          const allDiagnostics = [
            ...previousLogs,
            `\n========== Current Attempt #${currentAttempt} ==========`,
            ...logs,
            `\n========== Device Info ==========`,
            JSON.stringify(deviceInfo, null, 2),
          ];

          setDiagnostics(allDiagnostics);
          setStatus("error");
          hasInitialized.current = true; // エラーでも一度だけ実行するようにフラグを立てる
        }
      }
    };

    initUnity();

    return () => {
      mounted = false;
    };
  }, []);

  // AudioContext の自動再生警告を防ぐため、初回のユーザー操作で音声を再開
  useEffect(() => {
    if (status !== "ready") return;

    const resumeAudio = () => {
      try {
        const instance = (window as any).unityInstance;
        if (instance?.Module?.resumeAudioContext) {
          console.log("[HiddenUnityHost] Resuming Unity AudioContext");
          instance.Module.resumeAudioContext();
        }
      } catch (e) {
        console.warn("[HiddenUnityHost] Failed to resume AudioContext:", e);
      }
      // イベントリスナーを削除（一度だけ実行）
      document.removeEventListener("click", resumeAudio);
      document.removeEventListener("touchstart", resumeAudio);
      document.removeEventListener("keydown", resumeAudio);
    };

    console.log("[HiddenUnityHost] Setting up audio resume listeners");
    document.addEventListener("click", resumeAudio, { once: true });
    document.addEventListener("touchstart", resumeAudio, { once: true });
    document.addEventListener("keydown", resumeAudio, { once: true });

    return () => {
      document.removeEventListener("click", resumeAudio);
      document.removeEventListener("touchstart", resumeAudio);
      document.removeEventListener("keydown", resumeAudio);
    };
  }, [status]);

  // Unity 初期化状態の表示（loading または error の時のみ表示）
  if (status === "loading" || status === "error") {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "10px",
          left: "10px",
          right: status === "error" ? "10px" : "auto",
          background: "rgba(0, 0, 0, 0.95)",
          color: "#fff",
          padding: "16px",
          borderRadius: "8px",
          fontSize: "11px",
          fontFamily: "monospace",
          zIndex: 10001,
          maxWidth: status === "error" ? "none" : "300px",
          maxHeight: status === "error" ? "80vh" : "auto",
          overflow: status === "error" ? "auto" : "visible",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            color: status === "loading" ? "#ff0" : "#f00",
            fontWeight: "bold",
            marginBottom: "8px",
            fontSize: "13px",
          }}
        >
          🔧 Unity WebGL: {status.toUpperCase()}
          {initAttemptRef.current > 1 && ` (Attempt #${initAttemptRef.current})`}
        </div>

        {status === "loading" && (
          <div style={{ marginTop: "6px" }}>
            <div
              style={{
                fontSize: "10px",
                color: "#ccc",
                marginBottom: "4px",
              }}
            >
              Loading... {progress}%
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                background: "#333",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
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

        {error && (
          <>
            <div
              style={{
                color: "#f00",
                marginTop: "8px",
                marginBottom: "12px",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              ❌ Error: {error}
            </div>

            {diagnostics.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontWeight: "bold", color: "#8BC34A" }}>
                    📊 Diagnostic Information:
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => {
                        const text = diagnostics.join("\n");
                        navigator.clipboard.writeText(text);
                        alert("診断情報をクリップボードにコピーしました");
                      }}
                      style={{
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("ログをクリアして再読み込みしますか？")) {
                          localStorage.removeItem(DIAGNOSTICS_STORAGE_KEY);
                          window.location.reload();
                        }
                      }}
                      style={{
                        background: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      🔄 Reset
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    background: "#1a1a1a",
                    padding: "8px",
                    borderRadius: "4px",
                    fontSize: "9px",
                    maxHeight: "400px",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: "1.3",
                    color: "#ccc",
                  }}
                >
                  {diagnostics.join("\n")}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}
