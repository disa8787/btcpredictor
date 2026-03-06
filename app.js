const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// ТВОЙ API КЛЮЧ
const API_KEY = "af06e1a27fc084e5f89be0d0a5f0c47407dabb991d8ef11eab7b3534dc76da8b"; 

// Настройки Полимаркета
const ROUND_DURATION = 300; // 5 минут в секундах
const BET_AMOUNT = 50; 
const PAYOUT = 1.95;

let balance = parseFloat(localStorage.getItem('user_balance')) || 1000.00;
let currentPrice = 0;
let entryPriceForRound = null;
let roundTimeLeft = ROUND_DURATION;
let activeBets = [];

// UI Elements
const balanceEl = document.getElementById('balance-display');
const priceEl = document.getElementById('live-price');
const timerText = document.getElementById('timer-text');
const progressBar = document.getElementById('progress-bar');
const positionsList = document.getElementById('positions-list');
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const chartLoader = document.getElementById('chart-loader');

function updateBalance(newBal) {
    balance = newBal;
    localStorage.setItem('user_balance', balance);
    balanceEl.innerText = `$${balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}
updateBalance(balance);

// Инициализация графика TradingView
const chart = LightweightCharts.createChart(document.getElementById('chart-container'), {
    layout: { background: { color: 'transparent' }, textColor: '#848e9c' },
    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42, 46, 57, 0.3)' } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.2, bottom: 0.2 } },
    timeScale: { borderVisible: false, timeVisible: true },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
});

const candleSeries = chart.addCandlestickSeries({
    upColor: '#00c853', downColor: '#ff3d00', borderVisible: false, wickUpColor: '#00c853', wickDownColor: '#ff3d00'
});

// 1. ЗАГРУЗКА ИСТОРИИ И ГРАФИКА
async function loadChartHistory() {
    try {
        const res = await fetch(`https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=60&api_key=${API_KEY}`);
        const json = await res.json();
        
        if (json.Response === "Error") throw new Error(json.Message);
        
        const data = json.Data.Data;
        const historicalData = data.map(d => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        }));
        
        candleSeries.setData(historicalData);
        currentPrice = historicalData[historicalData.length - 1].close;
        entryPriceForRound = currentPrice;
        
        // Убираем лоадер и включаем кнопки!
        chartLoader.style.display = 'none';
        btnUp.removeAttribute('disabled');
        btnDown.removeAttribute('disabled');
        
        // Запускаем обновление лайв цены
        setInterval(fetchLivePrice, 2000);
    } catch (e) {
        console.error("History Error:", e);
        chartLoader.innerText = "Error connecting to market. Retrying...";
        setTimeout(loadChartHistory, 3000);
    }
}

// 2. ПОЛУЧЕНИЕ ЦЕНЫ КАЖДЫЕ 2 СЕКУНДЫ
async function fetchLivePrice() {
    try {
        const res = await fetch(`https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=1&api_key=${API_KEY}`);
        const json = await res.json();
        const lastCandle = json.Data.Data[json.Data.Data.length - 1];
        
        const oldPrice = currentPrice;
        currentPrice = lastCandle.close;
        
        candleSeries.update({
            time: lastCandle.time,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: currentPrice
        });

        priceEl.innerText = `$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        priceEl.style.color = currentPrice >= oldPrice ? '#00c853' : '#ff3d00';
        
    } catch (e) {
        console.error("Live Price Error:", e);
    }
}

// Запускаем всё
loadChartHistory();

// 3. ТАЙМЕР РАУНДА И ПОДВЕДЕНИЕ ИТОГОВ
setInterval(() => {
    roundTimeLeft--;
    
    const m = Math.floor(roundTimeLeft / 60);
    const s = roundTimeLeft % 60;
    timerText.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    progressBar.style.width = `${(roundTimeLeft / ROUND_DURATION) * 100}%`;

    if (roundTimeLeft <= 0) {
        resolveRound();
        roundTimeLeft = ROUND_DURATION; 
        entryPriceForRound = currentPrice; 
    }
}, 1000);

// 4. ЛОГИКА СТАВОК
function placeBet(direction) {
    if (balance < BET_AMOUNT) return tg.showAlert("Insufficient funds!");
    if (currentPrice === 0) return; 

    updateBalance(balance - BET_AMOUNT);
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

    const bet = {
        id: Date.now(),
        direction: direction,
        amount: BET_AMOUNT,
        targetPrice: entryPriceForRound || currentPrice 
    };
    
    activeBets.push(bet);
    renderPositions();
}

function renderPositions() {
    if (activeBets.length === 0) {
        positionsList.innerHTML = '<div class="empty-state">No active positions for this round.</div>';
        return;
    }

    positionsList.innerHTML = '';
    activeBets.forEach(bet => {
        const card = document.createElement('div');
        card.className = 'position-card';
        const color = bet.direction === 'up' ? 'var(--color-up)' : 'var(--color-down)';
        const dirText = bet.direction === 'up' ? '▲ UP' : '▼ DOWN';
        
        card.innerHTML = `
            <div style="color: ${color};">${dirText} <span style="color:var(--color-hint); font-size:11px;">@ ${bet.targetPrice.toFixed(2)}</span></div>
            <div>$${bet.amount.toFixed(2)}</div>
        `;
        positionsList.appendChild(card);
    });
}

function resolveRound() {
    if (activeBets.length === 0 || currentPrice === 0) return;
    
    let totalWin = 0;
    
    activeBets.forEach(bet => {
        let isWin = false;
        if (bet.direction === 'up' && currentPrice > bet.targetPrice) isWin = true;
        if (bet.direction === 'down' && currentPrice < bet.targetPrice) isWin = true;
        
        if (isWin) {
            totalWin += bet.amount * PAYOUT;
        }
    });

    if (totalWin > 0) {
        updateBalance(balance + totalWin);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert(`Round finished! You won $${totalWin.toFixed(2)}!`);
    } else {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    }

    activeBets = [];
    renderPositions();
}

btnUp.onclick = () => placeBet('up');
btnDown.onclick = () => placeBet('down');
