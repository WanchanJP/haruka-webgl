export default function Home() {
  return (
    <main className="container">
      <h1>Haruka WebGL</h1>

      {/* Unity埋め込み予定のプレースホルダ */}
      <section className="unity-section">
        <h2>Unity Content</h2>
        <div id="unity-root" className="unity-placeholder">
          Unity content will be loaded here
        </div>
      </section>

      {/* Canvas Previewセクション */}
      <section className="canvas-section">
        <h2>Canvas Preview</h2>
        <canvas
          id="rt-canv-0"
          width="256"
          height="256"
          className="preview-canvas"
        >
          Canvas not supported
        </canvas>
      </section>
    </main>
  )
}
