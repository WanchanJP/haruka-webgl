"use client";

// 第1話Web版ページ。開始ボタン→Unity起動のフローを管理する。
// 初期表示では Unity をロードせず、ボタン押下で dynamic import により Unity を起動。

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/app/components/layout/Header";
import { IntroSection } from "@/app/components/episode1/IntroSection";
import { StartButton } from "@/app/components/episode1/StartButton";
import { LazyUnityHost } from "@/app/components/unity/LazyUnityHost";

export default function Episode1Page() {
  const [isStarted, setIsStarted] = useState(false);

  const handleStart = () => {
    console.log("[Episode1Page] User clicked start button");

    // 端末情報をログ出力（既存の HiddenUnityHost と同様）
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    };
    console.log(
      "[Episode1Page] Device Info:",
      JSON.stringify(deviceInfo, null, 2)
    );

    // Unity 起動フラグを立てる
    setIsStarted(true);
  };

  return (
    <>
      {/* 開発版であることを示すヘッダーバー */}
      <div
        style={{
          background: "rgba(255, 220, 100, 0.95)",
          borderBottom: "2px solid #ff9800",
          padding: "8px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: "600" }}>
            🚧 Development Version - Episode 1
          </span>
          <Link
            href="/dev"
            style={{
              padding: "4px 8px",
              background: "#667eea",
              color: "white",
              borderRadius: "4px",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            ← Dev Home
          </Link>
        </div>
      </div>

      <Header />

      <main>
        <IntroSection />

        {!isStarted && (
          <section style={{ marginBottom: "80px" }}>
            <StartButton onStart={handleStart} />
          </section>
        )}

        {isStarted && (
          <section style={{ padding: "40px 24px" }}>
            <LazyUnityHost />
          </section>
        )}
      </main>
    </>
  );
}
