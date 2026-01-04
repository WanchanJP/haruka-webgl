"use client";

import UnityLazyLoader from "../components/UnityLazyLoader";

export default function UnityPage() {
  return (
    <main style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto" }}>
      <h1>Unity WebGL Lazy Load デモ</h1>
      <p>
        「Unity を起動」ボタンを押すまで、Unity のスクリプトは一切読み込まれません。
      </p>

      <UnityLazyLoader
        buildPath="/unity/Build/haruka"
        canvasWidth={960}
        canvasHeight={600}
        onUnityReady={(instance) => {
          console.log("[Page] Unity Ready!", instance);
          // 必要なら Unity へメッセージ送信
          // instance.SendMessage("GameManager", "OnWebReady", "");
        }}
        onProgress={(progress) => {
          console.log(`[Page] Loading: ${Math.round(progress * 100)}%`);
        }}
        onError={(error) => {
          console.error("[Page] Unity Error:", error);
        }}
      />
    </main>
  );
}
