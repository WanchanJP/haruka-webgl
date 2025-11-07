"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import PanelCanvas from "@/components/PanelCanvas";
import PanelDebugHUD from "@/components/PanelDebugHUD";
import HiddenUnityHost from "@/components/HiddenUnityHost";
import { sampleScene } from "@/lib/layout/panel-sample";
import type { PanelID, VisibleRange } from "@/lib/layout/panel-types";
import { getVisibleRangeFromContainer } from "@/lib/layout/visibility";
import "@/styles/panel.css";

export default function Home() {
  const [debug, setDebug] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [visiblePanelIds, setVisiblePanelIds] = useState<PanelID[]>([]);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    top: 0,
    bottom: 0,
  });
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Panel Enter/Leave handlers
  const handlePanelEnter = useCallback((id: PanelID) => {
    console.log(`[Panel] Enter: ${id}`);
    setVisiblePanelIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const handlePanelLeave = useCallback((id: PanelID) => {
    console.log(`[Panel] Leave: ${id}`);
    setVisiblePanelIds((prev) => prev.filter((pid) => pid !== id));
  }, []);

  // Keyboard shortcut: D key for debug toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        setDebug((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Track scroll position and visible range
  useEffect(() => {
    const updateScrollInfo = () => {
      const container = document.querySelector(
        ".panel-scroll-container"
      ) as HTMLElement;
      if (!container) return;

      setScrollTop(container.scrollTop);
      const range = getVisibleRangeFromContainer(container);
      setVisibleRange(range);
    };

    const container = document.querySelector(".panel-scroll-container");
    if (container) {
      container.addEventListener("scroll", updateScrollInfo, { passive: true });
      updateScrollInfo(); // Initial update
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", updateScrollInfo);
      }
    };
  }, []);

  return (
    <>
      {/* Hidden Unity Host */}
      <HiddenUnityHost />

      {/* Header with link to debug page */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "rgba(255, 255, 255, 0.95)",
          borderBottom: "1px solid #ddd",
          padding: "8px 16px",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
          Haruka WebGL - Panel Layout
        </h1>
        <Link
          href="/debug/unity"
          style={{
            padding: "6px 12px",
            background: "#667eea",
            color: "white",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          🔧 Unity Debug
        </Link>
      </header>

      {/* Main panel canvas */}
      <main style={{ marginTop: "48px" }}>
        <PanelCanvas
          scene={sampleScene}
          onPanelEnter={handlePanelEnter}
          onPanelLeave={handlePanelLeave}
          debug={debug}
          showMask={showMask}
        />
      </main>

      {/* Debug HUD */}
      {debug && (
        <PanelDebugHUD
          visibleRange={visibleRange}
          visiblePanelIds={visiblePanelIds}
          scrollTop={scrollTop}
          debug={debug}
          showMask={showMask}
          onDebugToggle={setDebug}
          onShowMaskToggle={setShowMask}
        />
      )}
    </>
  );
}
