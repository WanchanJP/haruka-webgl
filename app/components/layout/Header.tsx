// Episode1 ページ用のシンプルなヘッダーコンポーネント
export function Header() {
  return (
    <header
      style={{
        padding: "24px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        textAlign: "center",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "700" }}>
        ハルカノカナタ Web版
      </h1>
      <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.9 }}>
        第1話
      </p>
    </header>
  );
}
