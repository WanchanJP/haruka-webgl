"use client";

import { useEffect, useState } from "react";
import { loadUnity } from "@/lib/unity";

/**
 * 不可視の Unity ホスト
 * ルートページ（/）でバックグラウンドで Unity を起動し、
 * キャプチャ機能を提供する
 */
export default function HiddenUnityHost() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;

    const initUnity = async () => {
      try {
        // 既に初期化済みならスキップ
        if ((window as any).unityInstance) {
          console.log(
            "[HiddenUnityHost] Unity instance already exists, reusing"
          );
          setStatus("ready");
          return;
        }

        setStatus("loading");
        console.log("[HiddenUnityHost] Initializing hidden Unity instance...");

        // 隠しキャンバスが無ければ作成
        let canvas = document.getElementById(
          "unity-canvas"
        ) as HTMLCanvasElement | null;

        if (!canvas) {
          console.log("[HiddenUnityHost] Creating hidden canvas element");
          canvas = document.createElement("canvas");
          canvas.id = "unity-canvas";
          canvas.style.position = "fixed";
          canvas.style.left = "-9999px";
          canvas.style.top = "-9999px";
          canvas.style.width = "640px";
          canvas.style.height = "480px";
          canvas.style.pointerEvents = "none";
          canvas.style.zIndex = "-1000";
          document.body.appendChild(canvas);
        } else {
          console.log("[HiddenUnityHost] Canvas element already exists");
        }

        // Unity 初期化（タイムアウト付き・プログレス表示付き）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Unity initialization timed out after 90 seconds in HiddenUnityHost"
              )
            );
          }, 90000); // 90秒に設定（余裕を持たせつつ無駄に長くしない）
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

        try {
          await Promise.race([
            loadUnity((p) => {
              console.log(`[HiddenUnityHost] Progress: ${(p * 100).toFixed(1)}%`);
              if (mounted) {
                clearInterval(progressInterval); // 実際のプログレスが来たら疑似プログレスを停止
                setProgress(Math.round(p * 100));
              }
            }),
            timeoutPromise
          ]);
        } finally {
          clearInterval(progressInterval);
          if (mounted) {
            setProgress(100); // 完了時は100%
          }
        }

        if (mounted) {
          console.log("[HiddenUnityHost] ✅ Unity initialized successfully");
          setStatus("ready");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[HiddenUnityHost] ❌ Unity initialization failed:", err);
        if (mounted) {
          setError(message);
          setStatus("error");
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
          background: "rgba(0, 0, 0, 0.8)",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "11px",
          fontFamily: "monospace",
          zIndex: 10001,
          maxWidth: "250px",
        }}
      >
        <div
          style={{
            color: status === "loading" ? "#ff0" : "#f00",
          }}
        >
          🔧 Hidden Unity: {status}
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
                height: "4px",
                background: "#333",
                borderRadius: "2px",
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
          <div style={{ color: "#f00", marginTop: "4px", fontSize: "10px" }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return null;
}
