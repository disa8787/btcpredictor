// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // Expand to full height

// --- Chart Logic ---
const chartOptions = {
    layout: {
        background: { color: 'transparent' },
        textColor: getComputedStyle(document.body).getPropertyValue('--tg-theme-text-color'),
    },
    grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(197, 203, 206, 0.2)' },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: true },
    handleScroll: false,
    handleScale: false,
};

const container = document.getElementById('chart-container');
const chart = LightweightCharts.createChart(container, chartOptions);
const candleSeries = chart.addCandlestickSeries({
    upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
    wickUpColor: '#26a69a', wickDownColor: '#ef5350',
});

// Mock Data Generator
function generateInitialData() {
    const data = [];
    let time = Math.floor(Date.now() / 1000) - 100 * 60;
    let price = 65000;
    for (let i = 0; i < 100; i++) {
        const open = price + (Math.random() - 0.5) * 50;
        const high = open + Math.random() * 50;
        const low = open - Math.random() * 50;
        const close = (high + low) / 2;
        data.push({ time, open, high, low, close });
        time += 60;
        price = close;
    }
    return data;
}

candleSeries.setData(generateInitialData());

// Fake Live Price Update
setInterval(() => {
    const lastData = generateInitialData().pop();
    lastData.time = Math.floor(Date.now() / 1000);
    candleSeries.update(lastData);
    document.getElementById('market-price').innerText = `$${lastData.close.toFixed(2)}`;
}, 2000);

// --- Timer Logic ---
let timeLeft = 300; // 5 minutes in seconds
const countdownEl = document.getElementById('countdown');
const progressFill = document.getElementById('progress-fill');

function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownEl.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const percentage = (timeLeft / 300) * 100;
    progressFill.style.width = `${percentage}%`;

    if (timeLeft > 0) {
        timeLeft--;
    } else {
        timeLeft = 300; // Reset for demo purposes
    }
}
setInterval(updateTimer, 1000);

// --- Live Activity Logic ---
const orderBook = document.getElementById('order-book');
const names = ['User123', 'CryptoKing', 'TMA_Master', 'Dev_Anon', 'WhaleWatcher'];

function addFakeOrder() {
    const side = Math.random() > 0.45 ? 'Up' : 'Down';
    const amount = (Math.random() * 500).toFixed(2);
    const name = names[Math.floor(Math.random() * names.length)];
    
    const item = document.createElement('div');
    item.className = 'order-item';
    item.innerHTML = `
        <span>${name}</span>
        <span>bet <span class="side-${side.toLowerCase()}">${side}</span></span>
        <span>$${amount}</span>
    `;
    
    orderBook.prepend(item);
    if (orderBook.children.length > 5) orderBook.lastChild.remove();
}
setInterval(addFakeOrder, 3000);

// --- Interaction ---
document.getElementById('bet-up').onclick = () => {
    tg.HapticFeedback.impactOccurred('medium');
    tg.MainButton.setText('CONFIRM YES / UP').show();
};

document.getElementById('bet-down').onclick = () => {
    tg.HapticFeedback.impactOccurred('medium');
    tg.MainButton.setText('CONFIRM NO / DOWN').show();
};

tg.onEvent('mainButtonClicked', () => {
    tg.showConfirm("Place this bet using your balance?");
});