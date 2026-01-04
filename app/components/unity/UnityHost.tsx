"use client";

// Unity WebGL を可視化された Canvas でホストするコンポーネント
// HiddenUnityHost をベースに、画面上に表示する版

import { useEffect, useState, useRef } from "react";
import { loadUnity } from "@/lib/unity";

export default function UnityHost() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // StrictMode で二重実行されるのを防ぐ
    if (hasInitialized.current) {
      console.log(
        "[UnityHost] Already initialized, skipping (StrictMode double-mount)"
      );
      return;
    }

    let mounted = true;

    const addLog = (message: string) => {
      console.log(`[UnityHost] ${message}`);
    };

    addLog("Component mounted");

    const initUnity = async () => {
      try {
        // 既に初期化済みならスキップ
        if ((window as any).unityInstance) {
          addLog("Unity instance already exists, reusing");
          setStatus("ready");
          return;
        }

        setStatus("loading");
        addLog("Initializing Unity instance...");

        // Canvas 要素を作成
        let canvas = document.getElementById(
          "unity-canvas"
        ) as HTMLCanvasElement | null;

        if (!canvas) {
          addLog("Creating canvas element");
          canvas = document.createElement("canvas");
          canvas.id = "unity-canvas";
          canvas.tabIndex = 0;
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.display = "block";

          // コンテナに追加
          if (containerRef.current) {
            containerRef.current.appendChild(canvas);
          } else {
            document.body.appendChild(canvas);
          }
        }

        // Unity 初期化（タイムアウト付き）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            addLog("❌ Timeout reached (90 seconds)");
            reject(
              new Error("Unity initialization timed out after 90 seconds")
            );
          }, 90000);
        });

        try {
          addLog("Calling loadUnity()...");
          const startTime = Date.now();

          await Promise.race([
            loadUnity((p) => {
              const progressPercent = (p * 100).toFixed(1);
              addLog(`Progress: ${progressPercent}%`);
              if (mounted) {
                setProgress(Math.round(p * 100));
              }
            }),
            timeoutPromise,
          ]);

          const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
          addLog(`✅ Unity loaded successfully in ${loadTime}s`);
        } catch (loadError) {
          addLog(
            `❌ Load error: ${
              loadError instanceof Error ? loadError.message : String(loadError)
            }`
          );
          throw loadError;
        }

        if (mounted) {
          addLog("✅ Initialization complete");
          hasInitialized.current = true;
          setStatus("ready");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        addLog(`❌ Fatal error: ${message}`);
        console.error("[UnityHost] Unity initialization failed:", err);

        if (mounted) {
          setError(message);
          setStatus("error");
          hasInitialized.current = true;
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
          console.log("[UnityHost] Resuming Unity AudioContext");
          instance.Module.resumeAudioContext();
        }
      } catch (e) {
        console.warn("[UnityHost] Failed to resume AudioContext:", e);
      }
    };

    document.addEventListener("click", resumeAudio, { once: true });
    document.addEventListener("touchstart", resumeAudio, { once: true });
    document.addEventListener("keydown", resumeAudio, { once: true });

    return () => {
      document.removeEventListener("click", resumeAudio);
      document.removeEventListener("touchstart", resumeAudio);
      document.removeEventListener("keydown", resumeAudio);
    };
  }, [status]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1024px",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Unity Canvas コンテナ */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#000",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        }}
      />

      {/* ステータス表示 */}
      {status === "loading" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "white",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "18px", marginBottom: "16px" }}>
            読み込み中... {progress}%
          </div>
          <div
            style={{
              width: "200px",
              height: "8px",
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #667eea, #764ba2)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#ff6b6b",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>❌</div>
          <div style={{ fontSize: "18px", marginBottom: "8px" }}>
            読み込みに失敗しました
          </div>
          <div style={{ fontSize: "14px", color: "#ccc" }}>{error}</div>
        </div>
      )}
    </div>
  );
}
