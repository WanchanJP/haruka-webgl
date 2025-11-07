"use client";

import type { VisibleRange, PanelID } from "@/lib/layout/panel-types";

type PanelDebugHUDProps = {
  visibleRange: VisibleRange;
  visiblePanelIds: PanelID[];
  scrollTop: number;
  debug: boolean;
  showMask: boolean;
  onDebugToggle: (enabled: boolean) => void;
  onShowMaskToggle: (enabled: boolean) => void;
};

export default function PanelDebugHUD({
  visibleRange,
  visiblePanelIds,
  scrollTop,
  debug,
  showMask,
  onDebugToggle,
  onShowMaskToggle,
}: PanelDebugHUDProps) {
  return (
    <div
      className="panel-debug-hud"
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        background: "rgba(0, 0, 0, 0.85)",
        color: "#00ff00",
        padding: "12px 16px",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: 10000,
        maxWidth: "300px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{ marginBottom: "8px", fontWeight: "bold", color: "#ffff00" }}>
        🔧 Debug HUD
      </div>

      <div style={{ marginBottom: "4px" }}>
        <span style={{ color: "#888" }}>Scroll:</span>{" "}
        <span style={{ color: "#fff" }}>{scrollTop.toFixed(0)}px</span>
      </div>

      <div style={{ marginBottom: "4px" }}>
        <span style={{ color: "#888" }}>Visible:</span>{" "}
        <span style={{ color: "#fff" }}>
          {visibleRange.top.toFixed(0)} - {visibleRange.bottom.toFixed(0)}
        </span>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <span style={{ color: "#888" }}>Panels:</span>{" "}
        <span style={{ color: "#00ff00", fontWeight: "bold" }}>
          {visiblePanelIds.length}
        </span>
      </div>

      {visiblePanelIds.length > 0 && (
        <div
          style={{
            marginBottom: "8px",
            maxHeight: "120px",
            overflowY: "auto",
            fontSize: "11px",
          }}
        >
          <div style={{ color: "#888", marginBottom: "4px" }}>
            Visible Panel IDs:
          </div>
          {visiblePanelIds.map((id) => (
            <div
              key={id}
              style={{
                color: "#0ff",
                padding: "2px 4px",
                background: "rgba(0, 255, 255, 0.1)",
                borderRadius: "2px",
                marginBottom: "2px",
              }}
            >
              {id}
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: "1px solid #444", paddingTop: "8px" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "6px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => onDebugToggle(e.target.checked)}
            style={{ marginRight: "8px" }}
          />
          <span style={{ color: debug ? "#0f0" : "#888" }}>枠線・ID表示</span>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={showMask}
            onChange={(e) => onShowMaskToggle(e.target.checked)}
            style={{ marginRight: "8px" }}
          />
          <span style={{ color: showMask ? "#f0f" : "#888" }}>マスク境界</span>
        </label>
      </div>

      <div
        style={{
          marginTop: "8px",
          paddingTop: "8px",
          borderTop: "1px solid #444",
          fontSize: "10px",
          color: "#666",
        }}
      >
        Press [D] to toggle debug
      </div>
    </div>
  );
}
