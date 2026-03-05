// Инициализация Telegram SDK
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Настройки приложения
const BET_AMOUNT = 100; // Размер одной ставки
const BET_DURATION = 15; // Длительность ставки в секундах
const PAYOUT_MULTIPLIER = 1.95; // Коэффициент выигрыша

// Состояние
let balance = parseFloat(localStorage.getItem('btc_balance')) || 1000.00;
let currentPrice = 0;
let lastPrice = 0;

// Обновление баланса
function updateBalance(newBalance) {
    balance = newBalance;
    localStorage.setItem('btc_balance', balance.toFixed(2));
    document.getElementById('balance-amount').innerText = `$${balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}
updateBalance(balance);

// Инициализация графика TradingView
const chartContainer = document.getElementById('chart-container');
const chart = LightweightCharts.createChart(chartContainer, {
    layout: { background: { color: 'transparent' }, textColor: '#848e9c' },
    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42, 46, 57, 0.3)' } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
});

const candleSeries = chart.addCandlestickSeries({
    upColor: '#00c853', downColor: '#ff3d00', 
    borderVisible: false, wickUpColor: '#00c853', wickDownColor: '#ff3d00'
});

window.addEventListener('resize', () => chart.resize(chartContainer.clientWidth, chartContainer.clientHeight));

// === НОВЫЙ ИСТОЧНИК ДАННЫХ (БЕЗ БЛОКИРОВОК) ===

// Загрузка исторического графика за час
async function loadChartHistory() {
    try {
        const res = await fetch('https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=60');
        const json = await res.json();
        
        if (json.Response === "Error") throw new Error(json.Message);
        
        const data = json.Data.Data;
        const historicalData = data.map(d => ({
            time: d.time, // CryptoCompare сразу отдает в секундах
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        }));
        
        candleSeries.setData(historicalData);
        currentPrice = historicalData[historicalData.length - 1].close;
        document.getElementById('chart-loader').style.display = 'none';
        
        // Запускаем пульсацию цены каждые 2 секунды
        setInterval(fetchLivePrice, 2000);
    } catch (e) {
        console.error("Ошибка загрузки истории:", e);
        document.getElementById('chart-loader').innerText = "Loading data...";
        setTimeout(loadChartHistory, 3000);
    }
}

// Загрузка последней цены и обновление свечи
async function fetchLivePrice() {
    try {
        const res = await fetch('https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=1');
        const json = await res.json();
        const lastCandle = json.Data.Data[json.Data.Data.length - 1];
        
        currentPrice = lastCandle.close;
        
        candleSeries.update({
            time: lastCandle.time,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: currentPrice
        });

        const priceEl = document.getElementById('live-price');
        priceEl.innerText = currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2});
        priceEl.style.color = currentPrice >= lastPrice ? 'var(--color-up)' : 'var(--color-down)';
        lastPrice = currentPrice;
        
    } catch (e) {
        console.error("Ошибка обновления цены:", e);
    }
}

// Запуск
loadChartHistory();

// === ЛОГИКА ИГРЫ ===
function placeBet(direction) {
    if (currentPrice === 0) return tg.showAlert("Please wait for price data.");
    if (balance < BET_AMOUNT) return tg.showAlert("Insufficient balance!");

    updateBalance(balance - BET_AMOUNT);
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');

    const entryPrice = currentPrice;
    
    const historyList = document.getElementById('history-list');
    const emptyMsg = document.getElementById('empty-history');
    if (emptyMsg) emptyMsg.remove();

    const card = document.createElement('div');
    card.className = 'trade-card pending';
    
    const directionText = direction === 'up' ? '▲ UP' : '▼ DOWN';
    const directionColor = direction === 'up' ? 'var(--color-up)' : 'var(--color-down)';

    card.innerHTML = `
        <div>
            <span style="color: ${directionColor}; font-weight: 800;">${directionText}</span> 
            <span style="color: var(--text-muted);">@ ${entryPrice.toFixed(2)}</span>
        </div>
        <div class="countdown-timer">${BET_DURATION}s</div>
    `;
    historyList.prepend(card);

    let timeLeft = BET_DURATION;
    const timerInterval = setInterval(() => {
        timeLeft--;
        card.querySelector('.countdown-timer').innerText = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            resolveBet(card, direction, entryPrice);
        }
    }, 1000);
}

function resolveBet(cardElement, direction, entryPrice) {
    const finalPrice = currentPrice;
    let isWin = false;

    if (direction === 'up' && finalPrice > entryPrice) isWin = true;
    if (direction === 'down' && finalPrice < entryPrice) isWin = true;

    cardElement.classList.remove('pending');
    
    if (isWin) {
        const profit = BET_AMOUNT * PAYOUT_MULTIPLIER;
        updateBalance(balance + profit);
        
        cardElement.classList.add('win');
        cardElement.innerHTML = `
            <div><span style="color: var(--color-up)">WIN</span> <span style="color: var(--text-muted)">@ ${finalPrice.toFixed(2)}</span></div>
            <div style="color: var(--color-up); font-weight: bold;">+$${profit.toFixed(2)}</div>
        `;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else {
        cardElement.classList.add('loss');
        cardElement.innerHTML = `
            <div><span style="color: var(--color-down)">LOSS</span> <span style="color: var(--text-muted)">@ ${finalPrice.toFixed(2)}</span></div>
            <div style="color: var(--color-down); font-weight: bold;">-$${BET_AMOUNT.toFixed(2)}</div>
        `;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    }
}

// Прогресс-бар
let progressPercent = 100;
setInterval(() => {
    progressPercent -= 2;
    if (progressPercent < 0) progressPercent = 100;
    document.getElementById('progress-bar').style.width = progressPercent + '%';
}, 100);
