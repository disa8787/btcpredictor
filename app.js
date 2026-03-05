const tg = window.Telegram.WebApp;
tg.expand();

let balance = 1000.00;
let currentPrice = 0;
let lastPrice = 0;

// 1. Настройка графика
const chart = LightweightCharts.createChart(document.getElementById('tv-chart'), {
    layout: { background: { color: '#161a1e' }, textColor: '#d1d4dc' },
    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42, 46, 57, 0.5)' } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: true, timeVisible: true },
});

const candleSeries = chart.addCandlestickSeries({
    upColor: '#02c076', downColor: '#cf304a', 
    borderVisible: false, wickUpColor: '#02c076', wickDownColor: '#cf304a'
});

// 2. REAL-TIME ДАННЫЕ С BINANCE
const binanceSocket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

binanceSocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const k = msg.k;
    currentPrice = parseFloat(k.c);
    
    candleSeries.update({
        time: k.t / 1000,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: currentPrice
    });

    const priceEl = document.getElementById('live-price');
    priceEl.innerText = `$${currentPrice.toFixed(2)}`;
    priceEl.style.color = currentPrice >= lastPrice ? '#02c076' : '#cf304a';
    lastPrice = currentPrice;
};

// 3. ЛОГИКА ВЫИГРЫША
function makeTrade(type) {
    const betAmount = 50;
    if (balance < betAmount) return tg.showAlert("Insufficient funds!");

    const entryPrice = currentPrice; // Запоминаем цену входа
    balance -= betAmount;
    updateBalance();
    tg.HapticFeedback.impactOccurred('medium');

    const list = document.getElementById('history-list');
    if (list.querySelector('.empty')) list.innerHTML = '';

    // Создаем элемент сделки
    const item = document.createElement('div');
    item.className = 'trade-item';
    item.style.cssText = "display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #2b3139; font-size:12px; transition: 0.3s;";
    item.innerHTML = `
        <span style="color:${type==='up'?'#02c076':'#cf304a'}">BTC ${type.toUpperCase()} @ ${entryPrice.toFixed(2)}</span>
        <span id="timer-item">Closing in 15s...</span>
    `;
    list.prepend(item);

    // Логика завершения сделки через 15 секунд
    let waitTime = 15;
    const interval = setInterval(() => {
        waitTime--;
        item.querySelector('#timer-item').innerText = `Closing in ${waitTime}s...`;
        
        if (waitTime <= 0) {
            clearInterval(interval);
            const finalPrice = currentPrice;
            let win = false;

            if (type === 'up' && finalPrice > entryPrice) win = true;
            if (type === 'down' && finalPrice < entryPrice) win = true;

            if (win) {
                const profit = betAmount * 1.95;
                balance += profit;
                item.style.backgroundColor = "rgba(2, 192, 118, 0.1)";
                item.innerHTML = `<span style="color:#02c076">WIN +$${profit.toFixed(2)}</span> <span>${finalPrice.toFixed(2)}</span>`;
                tg.HapticFeedback.notificationOccurred('success');
            } else {
                item.style.backgroundColor = "rgba(207, 48, 74, 0.1)";
                item.innerHTML = `<span style="color:#cf304a">LOSS -$${betAmount}</span> <span>${finalPrice.toFixed(2)}</span>`;
                tg.HapticFeedback.notificationOccurred('error');
            }
            updateBalance();
        }
    }, 1000);
}

function updateBalance() {
    document.getElementById('balance-amount').innerText = `$${balance.toFixed(2)}`;
}

document.getElementById('btn-up').onclick = () => makeTrade('up');
document.getElementById('btn-down').onclick = () => makeTrade('down');

// Основной таймер раунда
let seconds = 300;
setInterval(() => {
    seconds--;
    if (seconds < 0) seconds = 300;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const timeLeftEl = document.getElementById('time-left');
    if(timeLeftEl) timeLeftEl.innerText = `${m}:${s.toString().padStart(2,'0')}`;
    const fill = document.getElementById('timer-fill');
    if(fill) fill.style.width = `${(seconds/300)*100}%`;
}, 1000);
