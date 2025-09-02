// DOM要素の取得
const progressBar = document.getElementById('progress-bar');

/**
 * スクロール進捗を計算して進捗バーの幅を更新する関数
 * スクロール位置に応じて0%から100%の値を計算し、進捗バーに反映
 */
function updateProgressBar() {
    // 現在のスクロール位置を取得
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // ページの総高さからビューポート高さを引いて、スクロール可能な距離を計算
    const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    // スクロール進捗を0-100%の範囲で計算
    const scrollProgress = documentHeight > 0 ? (scrollTop / documentHeight) * 100 : 0;
    
    // 進捗バーの幅を更新（最小0%、最大100%に制限）
    progressBar.style.width = Math.min(Math.max(scrollProgress, 0), 100) + '%';
}

/**
 * スムーススクロール機能を提供する関数
 * 指定された要素まで滑らかにスクロール
 */
function smoothScrollTo(element) {
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

/**
 * 画像の遅延読み込み完了時の処理
 * 画像が正常に読み込まれた際のフィードバック
 */
function handleImageLoad(event) {
    const img = event.target;
    img.classList.add('loaded');
    console.log(`画像が読み込まれました: ${img.alt}`);
}

/**
 * 画像読み込みエラー時の処理
 * プレースホルダー画像への切り替えが完了した際のログ出力
 */
function handleImageError(event) {
    const img = event.target;
    console.log(`画像の読み込みに失敗、プレースホルダーを表示: ${img.alt}`);
}

/**
 * ページの初期化処理
 * イベントリスナーの設定とDOMの準備
 */
function initializePage() {
    // スクロールイベントリスナーを追加（パフォーマンス向上のためpassiveオプション使用）
    window.addEventListener('scroll', updateProgressBar, { passive: true });
    
    // リサイズイベントリスナーを追加（画面サイズ変更時に進捗を再計算）
    window.addEventListener('resize', updateProgressBar, { passive: true });
    
    // 初期読み込み時の進捗バー状態を設定
    updateProgressBar();
    
    // 全ての画像要素にイベントリスナーを追加
    const images = document.querySelectorAll('.panel img');
    images.forEach(img => {
        img.addEventListener('load', handleImageLoad);
        img.addEventListener('error', handleImageError);
        
        // 既に読み込まれている画像があれば処理
        if (img.complete) {
            handleImageLoad({ target: img });
        }
    });
    
    console.log('ハルカノカナタ Web体験版が初期化されました');
}

/**
 * パフォーマンス監視用の関数
 * ページの読み込み完了時間を測定
 */
function logPerformanceMetrics() {
    if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        console.log(`ページ読み込み時間: ${loadTime}ms`);
    }
}

// ページ読み込み完了時に初期化を実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

// ページの読み込み完了時にパフォーマンス情報をログ出力
window.addEventListener('load', logPerformanceMetrics);