// Unity のロード中に表示する簡易オーバーレイコンポーネント
export function LoadingOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "50px",
          height: "50px",
          border: "4px solid rgba(255, 255, 255, 0.2)",
          borderTop: "4px solid white",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <p
        style={{
          color: "white",
          marginTop: "24px",
          fontSize: "16px",
          fontWeight: "500",
        }}
      >
        読み込み中...
      </p>
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
