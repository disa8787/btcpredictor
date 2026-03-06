const tg = window.Telegram.WebApp;
try { tg.expand(); tg.ready(); } catch(e) {}

// Твой рабочий API ключ (уже вставлен!)
const API_KEY = "af06e1a27fc084e5f89be0d0a5f0c47407dabb991d8ef11eab7b3534dc76da8b";

const ROUND_DURATION = 300; // 5 минут
const BET_AMOUNT = 50; 
const PAYOUT_MULTIPLIER = 1.95;

let balance = 1000.00;
try { if (localStorage.getItem('btc_balance')) balance = parseFloat(localStorage.getItem('btc_balance')); } catch(e) {}

let currentPrice = 0;
let entryPriceForRound = null;
let roundTimeLeft = ROUND_DURATION;
let activeBets = [];

const elements = {
    balance: document.getElementById('balance-amount'),
    price: document.getElementById('live-price'),
    loader: document.getElementById('chart-loader'),
    timerText: document.getElementById('timer-text'),
    progressBar: document.getElementById('progress-bar'),
    btnUp: document.getElementById('btn-up'),
    btnDown: document.getElementById('btn-down'),
    positions: document.getElementById('positions-list')
};

function updateBalance(newBal) {
    balance = newBal;
    try { localStorage.setItem('btc_balance', balance.toFixed(2)); } catch(e) {}
    elements.balance.innerText = `$${balance.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
}
updateBalance(balance);

// Инициализация графика (Версия 3.8.0)
const chartContainer = document.getElementById('chart-container');
const chart = LightweightCharts.createChart(chartContainer, {
    layout: { backgroundColor: 'transparent', textColor: '#848e9c' },
    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { borderVisible: false, timeVisible: true }
});

const candleSeries = chart.addCandlestickSeries({
    upColor: '#00c853', downColor: '#ff3d00', borderVisible: false, wickUpColor: '#00c853', wickDownColor: '#ff3d00'
});

window.addEventListener('resize', () => chart.resize(chartContainer.clientWidth, chartContainer.clientHeight));

// Загрузка графика
async function loadChartHistory() {
    try {
        const res = await fetch(`https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=60&api_key=${API_KEY}`);
        const json = await res.json();
        
        if (json.Response === "Error") throw new Error(json.Message);
        
        const data = json.Data.Data.map(d => ({
            time: d.time, open: d.open, high: d.high, low: d.low, close: d.close
        }));
        
        candleSeries.setData(data);
        currentPrice = data[data.length - 1].close;
        entryPriceForRound = currentPrice;
        
        elements.loader.style.display = 'none';
        elements.btnUp.removeAttribute('disabled');
        elements.btnDown.removeAttribute('disabled');
        
        setInterval(fetchLivePrice, 2000); // Обновляем цену каждые 2 сек
    } catch (e) {
        console.error(e);
        elements.loader.innerText = "Connection error. Retrying...";
        setTimeout(loadChartHistory, 3000);
    }
}

// Загрузка лайв цены
async function fetchLivePrice() {
    try {
        const res = await fetch(`https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=1&api_key=${API_KEY}`);
        const json = await res.json();
        const lastCandle = json.Data.Data[json.Data.Data.length - 1];
        
        const oldPrice = currentPrice;
        currentPrice = lastCandle.close;
        
        candleSeries.update({
            time: lastCandle.time, open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: currentPrice
        });

        elements.price.innerText = `$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        elements.price.style.color = currentPrice >= oldPrice ? '#00c853' : '#ff3d00';
    } catch (e) {}
}

loadChartHistory();

// Таймер (5 минут) и расчет профита
setInterval(() => {
    roundTimeLeft--;
    
    const m = Math.floor(roundTimeLeft / 60);
    const s = roundTimeLeft % 60;
    elements.timerText.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    elements.progressBar.style.width = `${(roundTimeLeft / ROUND_DURATION) * 100}%`;

    if (roundTimeLeft <= 0) {
        resolveRound();
        roundTimeLeft = ROUND_DURATION;
        entryPriceForRound = currentPrice; 
    }
}, 1000);

// Ставки
function placeBet(direction) {
    if (balance < BET_AMOUNT) return tg.showAlert ? tg.showAlert("Insufficient funds!") : alert("Insufficient funds!");
    if (currentPrice === 0) return;

    updateBalance(balance - BET_AMOUNT);
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');

    activeBets.push({
        id: Date.now(),
        direction: direction,
        amount: BET_AMOUNT,
        targetPrice: entryPriceForRound || currentPrice
    });
    
    renderPositions();
}

function renderPositions() {
    if (activeBets.length === 0) {
        elements.positions.innerHTML = '<div class="empty-state">No active trades</div>';
        return;
    }

    elements.positions.innerHTML = '';
    activeBets.forEach(bet => {
        const isUp = bet.direction === 'up';
        const color = isUp ? 'var(--color-up)' : 'var(--color-down)';
        const dirText = isUp ? '▲ UP' : '▼ DOWN';
        
        elements.positions.innerHTML += `
            <div class="trade-card" style="border-left-color: ${color}">
                <div>
                    <span style="color: ${color};">${dirText}</span> 
                    <span style="color: var(--text-muted); font-size: 11px; margin-left: 5px;">@ ${bet.targetPrice.toFixed(2)}</span>
                </div>
                <div>$${bet.amount.toFixed(2)}</div>
            </div>
        `;
    });
}

// Завершение раунда
function resolveRound() {
    if (activeBets.length === 0 || currentPrice === 0) return;
    
    let totalWin = 0;
    activeBets.forEach(bet => {
        if (bet.direction === 'up' && currentPrice > bet.targetPrice) totalWin += bet.amount * PAYOUT_MULTIPLIER;
        if (bet.direction === 'down' && currentPrice < bet.targetPrice) totalWin += bet.amount * PAYOUT_MULTIPLIER;
    });

    if (totalWin > 0) {
        updateBalance(balance + totalWin);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        try { tg.showAlert(`Round won! +$${totalWin.toFixed(2)}`); } catch(e) { alert(`Round won! +$${totalWin.toFixed(2)}`); }
    } else {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    }

    activeBets = [];
    renderPositions();
}

elements.btnUp.onclick = () => placeBet('up');
elements.btnDown.onclick = () => placeBet('down');