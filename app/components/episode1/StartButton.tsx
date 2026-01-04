// 第1話を開始するボタンコンポーネント
type StartButtonProps = {
  onStart: () => void;
};

export function StartButton({ onStart }: StartButtonProps) {
  return (
    <div style={{ textAlign: "center", marginTop: "32px" }}>
      <button
        type="button"
        onClick={onStart}
        style={{
          padding: "16px 48px",
          fontSize: "18px",
          fontWeight: "600",
          color: "white",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          border: "none",
          borderRadius: "50px",
          cursor: "pointer",
          boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 20px rgba(102, 126, 234, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow =
            "0 4px 15px rgba(102, 126, 234, 0.4)";
        }}
      >
        🎬 第1話を体験する
      </button>
    </div>
  );
}
