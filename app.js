const tg = window.Telegram.WebApp;
tg.expand();

let balance = 1000.00;
let lastPrice = 0;

// 1. Настройка графика
const chart = LightweightCharts.createChart(document.getElementById('tv-chart'), {
    layout: { background: { color: '#161a1e' }, textColor: '#d1d4dc' },
    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42, 46, 57, 0.5)' } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
});

const candleSeries = chart.addCandlestickSeries({
    upColor: '#02c076', downColor: '#cf304a', 
    borderVisible: false, wickUpColor: '#02c076', wickDownColor: '#cf304a'
});

// 2. РЕАЛЬНЫЕ ДАННЫЕ С BINANCE
const binanceSocket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

binanceSocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const k = msg.k;
    const price = parseFloat(k.c);
    
    // Обновляем график в реальном времени
    candleSeries.update({
        time: k.t / 1000,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: price
    });

    // Обновляем цену в интерфейсе
    const priceEl = document.getElementById('live-price');
    priceEl.innerText = `$${price.toFixed(2)}`;
    priceEl.style.color = price >= lastPrice ? '#02c076' : '#cf304a';
    lastPrice = price;
};

// 3. ЛОГИКА СТАВОК
function makeTrade(type) {
    if (balance < 50) return tg.showAlert("Insufficient funds!");

    balance -= 50;
    updateBalance();
    tg.HapticFeedback.impactOccurred('medium');

    const list = document.getElementById('history-list');
    if (list.querySelector('.empty')) list.innerHTML = '';

    const item = document.createElement('div');
    item.style.cssText = "display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #2b3139; font-size:12px;";
    item.innerHTML = `
        <span style="color:${type==='up'?'#02c076':'#cf304a'}">BTC ${type.toUpperCase()}</span>
        <span>$50.00</span>
        <span style="color:#848e9c">In progress...</span>
    `;
    list.prepend(item);
}

function updateBalance() {
    document.getElementById('balance-amount').innerText = `$${balance.toFixed(2)}`;
}

document.getElementById('btn-up').onclick = () => makeTrade('up');
document.getElementById('btn-down').onclick = () => makeTrade('down');

// Таймер
let seconds = 300;
setInterval(() => {
    seconds--;
    if (seconds < 0) seconds = 300;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    document.getElementById('time-left').innerText = `${m}:${s.toString().padStart(2,'0')}`;
    document.getElementById('timer-fill').style.width = `${(seconds/300)*100}%`;
}, 1000);
