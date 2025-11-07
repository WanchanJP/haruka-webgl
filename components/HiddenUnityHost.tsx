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

        // Unity 初期化（タイムアウト付き）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Unity initialization timed out after 60 seconds in HiddenUnityHost"
              )
            );
          }, 60000);
        });

        await Promise.race([loadUnity(), timeoutPromise]);

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

  // デバッグ情報（開発時のみ表示）
  if (process.env.NODE_ENV === "development" && status !== "idle") {
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
            color:
              status === "ready"
                ? "#0f0"
                : status === "loading"
                  ? "#ff0"
                  : "#f00",
          }}
        >
          🔧 Hidden Unity: {status}
        </div>
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
