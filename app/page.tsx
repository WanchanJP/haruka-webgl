"use client";

import Link from "next/link";
import "./globals.css";

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        gap: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#222" }}>
        Haruka no Kanata Web
      </h1>

      <p style={{ fontSize: "1.125rem", color: "#555", maxWidth: "600px" }}>
        Unity WebGL を使った体験版の開発ホームです。
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/debug/unity"
          style={{
            padding: "0.75rem 1.5rem",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
            transition: "all 0.3s ease",
          }}
        >
          🔧 Unity 検証ページへ
        </Link>

        <Link
          href="/debug"
          style={{
            padding: "0.75rem 1.5rem",
            background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(245, 87, 108, 0.3)",
            transition: "all 0.3s ease",
          }}
        >
          🔍 システムデバッグ
        </Link>
      </div>

      <footer style={{ marginTop: "4rem", fontSize: "0.875rem", color: "#999" }}>
        <p>Next.js 15 + Unity WebGL Integration</p>
      </footer>
    </main>
  );
}
