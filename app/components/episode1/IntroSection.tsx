// 第1話Web版の作品説明・注意書きを表示するコンポーネント
export function IntroSection() {
  return (
    <section
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "0 24px",
      }}
    >
      <div
        style={{
          background: "#f9f9f9",
          borderRadius: "12px",
          padding: "32px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "22px", color: "#333" }}>
          ようこそ
        </h2>
        <p style={{ lineHeight: "1.8", color: "#555" }}>
          『ハルカノカナタ』は、WebGL技術を使用したインタラクティブな物語体験です。
          <br />
          このページでは第1話の内容をお楽しみいただけます。
        </p>

        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            background: "#fff3cd",
            borderLeft: "4px solid #ffc107",
            borderRadius: "4px",
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: "16px", color: "#856404" }}>
            ⚠️ ご注意
          </h3>
          <ul
            style={{
              margin: "8px 0 0 0",
              paddingLeft: "20px",
              color: "#856404",
              fontSize: "14px",
              lineHeight: "1.6",
            }}
          >
            <li>初回読み込みには数十秒〜数分かかる場合があります</li>
            <li>安定した通信環境でのご利用を推奨します</li>
            <li>音声が再生されますので、音量にご注意ください</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
