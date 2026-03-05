const tg = window.Telegram.WebApp;
tg.expand();

let balance = 1000.00;
let currentPrice = 0;
let lastPrice = 0;
let socket;

// 1. Инициализация графика (улучшенные настройки для мобильных)
const chart = LightweightCharts.createChart(document.getElementById('tv-chart'), {
    layout: { background: { color: '#161a1e' }, textColor: '#d1d4dc' },
    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42, 46, 57, 0.1)' } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.2, bottom: 0.2 } },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
});

const candleSeries = chart.addCandlestickSeries({
    upColor: '#02c076', downColor: '#cf304a', 
    borderVisible: false, wickUpColor: '#02c076', wickDownColor: '#cf304a'
});

// 2. ФУНКЦИЯ ПОДКЛЮЧЕНИЯ К BINANCE
function connectBinance() {
    socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

    socket.onmessage = (event) => {
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

    socket.onclose = () => {
        console.log("Socket closed. Reconnecting...");
        setTimeout(connectBinance, 2000); // Переподключение при обрыве
    };
    
    socket.onerror = (err) => {
        console.error("Socket error:", err);
        socket.close();
    };
}

// Запасной метод: если WebSocket не грузит, берем цену через обычный запрос
async function fetchBackupPrice() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
        const data = await response.json();
        if (!currentPrice) { // Только если основной сокет еще не дал цену
            currentPrice = parseFloat(data.price);
            document.getElementById('live-price').innerText = `$${currentPrice.toFixed(2)}`;
        }
    } catch (e) { console.error("Backup price failed", e); }
}

// Запускаем всё
connectBinance();
setInterval(fetchBackupPrice, 5000); // Проверка цены каждые 5 сек на всякий случай

// 3. ЛОГИКА КНОПОК
function makeTrade(type) {
    if (currentPrice === 0) {
        tg.showScanQrPopup({ text: "Waiting for price data..." }); // Или просто showAlert
        return;
    }

    const betAmount = 50;
    if (balance < betAmount) return tg.showAlert("Insufficient funds!");

    const entryPrice = currentPrice;
    balance -= betAmount;
    updateBalance();
    tg.HapticFeedback.impactOccurred('medium');

    const list = document.getElementById('history-list');
    if (list.querySelector('.empty')) list.innerHTML = '';

    const item = document.createElement('div');
    item.style.cssText = "display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid #2b3139; font-size:13px; background: rgba(255,255,255,0.02);";
    item.innerHTML = `
        <span style="color:${type==='up'?'#02c076':'#cf304a'}">BTC ${type.toUpperCase()} @ ${entryPrice.toFixed(2)}</span>
        <span class="status-timer">15s...</span>
    `;
    list.prepend(item);

    let waitTime = 15;
    const interval = setInterval(() => {
        waitTime--;
        item.querySelector('.status-timer').innerText = `${waitTime}s...`;
        
        if (waitTime <= 0) {
            clearInterval(interval);
            const finalPrice = currentPrice;
            const win = (type === 'up' && finalPrice > entryPrice) || (type === 'down' && finalPrice < entryPrice);

            if (win) {
                const profit = betAmount * 1.95;
                balance += profit;
                item.style.backgroundColor = "rgba(2, 192, 118, 0.1)";
                item.innerHTML = `<span style="color:#02c076">WIN +$${profit.toFixed(2)}</span> <span style="opacity:0.6">${finalPrice.toFixed(2)}</span>`;
                tg.HapticFeedback.notificationOccurred('success');
            } else {
                item.style.backgroundColor = "rgba(207, 48, 74, 0.1)";
                item.innerHTML = `<span style="color:#cf304a">LOSS -$${betAmount}</span> <span style="opacity:0.6">${finalPrice.toFixed(2)}</span>`;
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

// Таймер раунда
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
