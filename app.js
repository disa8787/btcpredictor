const tg = window.Telegram.WebApp;
tg.expand();

let balance = 1000.00;
let currentPrice = 0;
let lastPrice = 0;

// Инициализация графика
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

// ФУНКЦИЯ ПОЛУЧЕНИЯ ДАННЫХ ЧЕРЕЗ HTTP (Работает стабильнее в Telegram)
async function updateMarketData() {
    try {
        // Получаем свечу (график)
        const chartRes = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1');
        const [t, o, h, l, c] = await chartRes.json().then(data => data[0]);
        
        currentPrice = parseFloat(c);
        
        candleSeries.update({
            time: t / 1000,
            open: parseFloat(o),
            high: parseFloat(h),
            low: parseFloat(l),
            close: currentPrice
        });

        // Обновляем текст цены
        const priceEl = document.getElementById('live-price');
        priceEl.innerText = `$${currentPrice.toFixed(2)}`;
        priceEl.style.color = currentPrice >= lastPrice ? '#02c076' : '#cf304a';
        lastPrice = currentPrice;
        
    } catch (e) {
        console.error("Data error:", e);
        document.getElementById('live-price').innerText = "Reconnecting...";
    }
}

// Запускаем обновление каждые 2 секунды
setInterval(updateMarketData, 2000);
updateMarketData();

// ЛОГИКА СДЕЛОК
function makeTrade(type) {
    if (currentPrice === 0) return;

    const betAmount = 50;
    if (balance < betAmount) {
        tg.showAlert("Недостаточно средств!");
        return;
    }

    const entryPrice = currentPrice;
    balance -= betAmount;
    updateBalanceDisplay();
    tg.HapticFeedback.impactOccurred('medium');

    const list = document.getElementById('history-list');
    if (list.querySelector('.empty')) list.innerHTML = '';

    const item = document.createElement('div');
    item.style.cssText = "display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #2b3139; font-size:12px;";
    item.innerHTML = `
        <span style="color:${type==='up'?'#02c076':'#cf304a'}">BTC ${type.toUpperCase()} @ ${entryPrice.toFixed(2)}</span>
        <span class="timer-status">15s...</span>
    `;
    list.prepend(item);

    let wait = 15;
    const timer = setInterval(() => {
        wait--;
        item.querySelector('.timer-status').innerText = `${wait}s...`;
        
        if (wait <= 0) {
            clearInterval(timer);
            const finalPrice = currentPrice;
            const isWin = (type === 'up' && finalPrice > entryPrice) || (type === 'down' && finalPrice < entryPrice);
            
            if (isWin) {
                const profit = betAmount * 1.95;
                balance += profit;
                item.innerHTML = `<span style="color:#02c076">WIN +$${profit.toFixed(2)}</span> <span>${finalPrice.toFixed(2)}</span>`;
                tg.HapticFeedback.notificationOccurred('success');
            } else {
                item.innerHTML = `<span style="color:#cf304a">LOSS -$${betAmount}</span> <span>${finalPrice.toFixed(2)}</span>`;
                tg.HapticFeedback.notificationOccurred('error');
            }
            updateBalanceDisplay();
        }
    }, 1000);
}

function updateBalanceDisplay() {
    document.getElementById('balance-amount').innerText = `$${balance.toFixed(2)}`;
}

document.getElementById('btn-up').onclick = () => makeTrade('up');
document.getElementById('btn-down').onclick = () => makeTrade('down');
