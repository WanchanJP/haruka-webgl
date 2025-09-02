// DOM要素の取得
const progressBar = document.getElementById('progress-bar');

// 設定値
const STORAGE_KEY = 'haruka-webgl-position';
const INTERSECTION_THRESHOLD = 0.3; // パネルの30%が見えたときに表示開始

/**
 * スクロール進捗を計算して進捗バーの幅を更新する関数
 * スクロール位置に応じて0%から100%の値を計算し、進捗バーに反映
 */
function updateProgressBar() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollProgress = documentHeight > 0 ? (scrollTop / documentHeight) * 100 : 0;
    progressBar.style.width = Math.min(Math.max(scrollProgress, 0), 100) + '%';
}

/**
 * 保存された読書位置をlocalStorageから復元する関数
 * 安全性のため、要素が存在しない場合は何もしない
 */
function restoreReadingPosition() {
    try {
        const savedPosition = localStorage.getItem(STORAGE_KEY);
        if (!savedPosition) {
            console.log('保存された読書位置はありません');
            return;
        }

        const targetElement = document.getElementById(savedPosition);
        if (!targetElement) {
            console.log(`保存された位置 ${savedPosition} が見つかりません`);
            return;
        }

        // 少し遅延を入れて、ページレンダリング完了後にスクロール
        setTimeout(() => {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            console.log(`保存された位置 ${savedPosition} に復元しました`);
        }, 100);
    } catch (error) {
        console.error('読書位置の復元中にエラーが発生しました:', error);
    }
}

/**
 * 読書位置をlocalStorageに保存する関数
 * 最後に可視化されたパネルのIDを保存
 */
function saveReadingPosition(panelId) {
    try {
        localStorage.setItem(STORAGE_KEY, panelId);
        console.log(`読書位置を保存しました: ${panelId}`);
    } catch (error) {
        console.error('読書位置の保存中にエラーが発生しました:', error);
    }
}

/**
 * IntersectionObserverのコールバック関数
 * パネルが画面に表示されたときの処理を担当
 * - フェードイン効果の適用
 * - 読書位置の自動保存
 */
function handleIntersection(entries, observer) {
    entries.forEach(entry => {
        const panel = entry.target;
        
        if (entry.isIntersecting) {
            // フェードイン効果を適用
            panel.classList.add('is-visible');
            
            // 読書位置を保存（パネルIDを取得）
            const panelId = panel.id;
            if (panelId) {
                saveReadingPosition(panelId);
            }
            
            console.log(`パネル ${panelId} が表示されました`);
        }
    });
}

/**
 * IntersectionObserverを初期化する関数
 * パネルの可視性を監視し、適切なコールバックを設定
 */
function initializeIntersectionObserver() {
    // IntersectionObserver のオプション設定
    const options = {
        root: null, // ビューポートを基準にする
        rootMargin: '0px',
        threshold: INTERSECTION_THRESHOLD
    };

    // Observerを作成
    const observer = new IntersectionObserver(handleIntersection, options);
    
    // 全てのパネルを監視対象に追加
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
        observer.observe(panel);
    });
    
    console.log(`${panels.length}個のパネルの監視を開始しました`);
    return observer;
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
 * 全ての機能を統合して初期化する関数
 */
function initializePage() {
    // スクロール関連のイベントリスナー設定
    window.addEventListener('scroll', updateProgressBar, { passive: true });
    window.addEventListener('resize', updateProgressBar, { passive: true });
    updateProgressBar();
    
    // 画像読み込み関連のイベントリスナー設定
    const images = document.querySelectorAll('.panel img');
    images.forEach(img => {
        img.addEventListener('load', handleImageLoad);
        img.addEventListener('error', handleImageError);
        
        if (img.complete) {
            handleImageLoad({ target: img });
        }
    });
    
    // IntersectionObserver初期化
    initializeIntersectionObserver();
    
    // 保存された読書位置を復元
    restoreReadingPosition();
    
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