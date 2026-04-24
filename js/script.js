// DOM элементы
const forexBtn = document.getElementById('forexModeBtn');
const cryptoBtn = document.getElementById('cryptoModeBtn');
const forexPanel = document.getElementById('forexPanel');
const cryptoPanel = document.getElementById('cryptoPanel');

// Элементы крипто-калькулятора
const cryptoSymbolInput = document.getElementById('cryptoSymbol');
const cryptoBalanceInput = document.getElementById('cryptoBalance');
const cryptoStopLossInput = document.getElementById('cryptoStopLoss');
const leverageSlider = document.getElementById('leverageSlider');
const leverageValueSpan = document.getElementById('leverageValue');
const livePriceSpan = document.getElementById('livePriceDisplay');
const refreshPriceBtn = document.getElementById('refreshPriceBtn');
const cryptoCalcBtn = document.getElementById('cryptoCalcBtn');
const cryptoResultBox = document.getElementById('cryptoResultBox');

// Переменная для хранения текущей цены
let currentCryptoPrice = null;
let currentLeverage = 1;

// ---- ОБНОВЛЕНИЕ ОТОБРАЖЕНИЯ ПЛЕЧА ----
function updateLeverageDisplay() {
    currentLeverage = parseInt(leverageSlider.value, 10);
    leverageValueSpan.textContent = currentLeverage + 'x';
    if (currentCryptoPrice !== null) {
        calculateCryptoPosition();
    }
}

leverageSlider.addEventListener('input', updateLeverageDisplay);

// ---- ПЕРЕКЛЮЧЕНИЕ ПАНЕЛЕЙ (FOREX / CRYPTO) ----
function setActiveMode(mode) {
    if (mode === 'forex') {
        forexBtn.classList.add('active');
        cryptoBtn.classList.remove('active');
        forexPanel.classList.remove('hidden');
        cryptoPanel.classList.add('hidden');
    } else {
        cryptoBtn.classList.add('active');
        forexBtn.classList.remove('active');
        cryptoPanel.classList.remove('hidden');
        forexPanel.classList.add('hidden');
    }
}

forexBtn.addEventListener('click', () => setActiveMode('forex'));
cryptoBtn.addEventListener('click', () => setActiveMode('crypto'));

// ---------- Функция получения цены с Binance (USDT пары) ----------
async function fetchCryptoPrice(symbol) {
    if (!symbol) return null;
    let cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol.endsWith('USDT')) {
        cleanSymbol = cleanSymbol + 'USDT';
    }
    try {
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${cleanSymbol}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Pair not found');
        const data = await response.json();
        const price = parseFloat(data.price);
        if (isNaN(price)) throw new Error('Invalid price');
        return { price, symbol: cleanSymbol };
    } catch (error) {
        console.warn('Binance fetch error:', error);
        return null;
    }
}

// Обновление отображаемой цены
async function updateLivePrice() {
    let rawSymbol = cryptoSymbolInput.value.trim();
    if (!rawSymbol) {
        livePriceSpan.textContent = 'Введите пару';
        currentCryptoPrice = null;
        return;
    }
    livePriceSpan.textContent = 'Загрузка...';
    const result = await fetchCryptoPrice(rawSymbol);
    if (result && result.price) {
        currentCryptoPrice = result.price;
        livePriceSpan.textContent = '$ ' + currentCryptoPrice.toFixed(2);
        if (cryptoStopLossInput.value && !isNaN(parseFloat(cryptoStopLossInput.value))) {
            calculateCryptoPosition();
        }
    } else {
        livePriceSpan.textContent = 'Ошибка пары';
        currentCryptoPrice = null;
    }
}

// Ручное обновление цены по кнопке
refreshPriceBtn.addEventListener('click', () => {
    updateLivePrice();
});

// Автоматическая загрузка цены при изменении символа (с debounce)
let debounceTimer;
cryptoSymbolInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        updateLivePrice();
    }, 600);
});

// ---- ГЛАВНЫЙ РАСЧЁТ - ПОДДЕРЖИВАЕТ LONG И SHORT АВТОМАТИЧЕСКИ ----
// Формула: Quantity = (Balance × 0.01 × Leverage) / |Entry - StopLoss|
// Модуль разницы делает формулу универсальной для обоих направлений

function calculateCryptoPosition() {
    // Проверяем, что есть текущая цена
    if (currentCryptoPrice === null || isNaN(currentCryptoPrice)) {
        cryptoResultBox.textContent = 'Обновите цену пары';
        cryptoResultBox.classList.add('result-error');
        cryptoResultBox.classList.remove('result-success');
        return;
    }

    const balance = parseFloat(cryptoBalanceInput.value);
    const stopLoss = parseFloat(cryptoStopLossInput.value);
    const entryPrice = currentCryptoPrice;
    const leverage = currentLeverage;

    if (isNaN(balance) || balance <= 0) {
        cryptoResultBox.textContent = 'Корректный баланс > 0';
        cryptoResultBox.classList.add('result-error');
        cryptoResultBox.classList.remove('result-success');
        return;
    }
    if (isNaN(stopLoss) || stopLoss <= 0) {
        cryptoResultBox.textContent = 'Введите цену стоп-лосса';
        cryptoResultBox.classList.add('result-error');
        cryptoResultBox.classList.remove('result-success');
        return;
    }
    if (stopLoss === entryPrice) {
        cryptoResultBox.textContent = 'StopLoss не равен Entry';
        cryptoResultBox.classList.add('result-error');
        cryptoResultBox.classList.remove('result-success');
        return;
    }

    // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: используем МОДУЛЬ разницы
    // Это позволяет работать и для LONG (stopLoss < entry) и для SHORT (stopLoss > entry)
    const riskPerCoin = Math.abs(entryPrice - stopLoss);

    const riskAmount = balance * 0.01;   // 1% от депозита в USDT

    // Quantity = (RiskAmount × Leverage) / |Entry - StopLoss|
    const quantity = (riskAmount * leverage) / riskPerCoin;

    if (quantity <= 0) {
        cryptoResultBox.textContent = '0';
        cryptoResultBox.classList.add('result-error');
        cryptoResultBox.classList.remove('result-success');
        return;
    }

    // Определяем направление для информативного сообщения
    const direction = stopLoss < entryPrice ? 'LONG' : 'SHORT';

    // Форматируем вывод
    let formattedQty;
    if (quantity < 0.000001) {
        formattedQty = quantity.toFixed(10);
    } else if (quantity < 0.001) {
        formattedQty = quantity.toFixed(8);
    } else if (quantity < 1) {
        formattedQty = quantity.toFixed(6);
    } else {
        formattedQty = quantity.toFixed(4);
    }

    const symbolDisplay = cryptoSymbolInput.value.trim().toUpperCase() || 'COIN';
    const displaySymbol = symbolDisplay.endsWith('USDT') ? symbolDisplay.replace('USDT', '') : symbolDisplay;

    cryptoResultBox.innerHTML = formattedQty + ' <span style="font-size:0.9rem;">' + displaySymbol + '</span>';
    cryptoResultBox.classList.add('result-success');
    cryptoResultBox.classList.remove('result-error');

    // Доп. информация в tooltip
    const positionValue = quantity * entryPrice;
    const marginUsed = positionValue / leverage;
    const riskUsd = riskPerCoin * quantity / leverage;

    cryptoResultBox.title = direction + ' | Размер: $' + positionValue.toFixed(2) + ' | Залог: $' + marginUsed.toFixed(2) + ' | Риск: $' + riskUsd.toFixed(2) + ' (1%) | Плечо: ' + leverage + 'x';
}

// Обработчик кнопки расчёта крипты
cryptoCalcBtn.addEventListener('click', () => {
    if (currentCryptoPrice === null) {
        updateLivePrice().then(() => {
            setTimeout(() => {
                calculateCryptoPosition();
            }, 200);
        });
    } else {
        calculateCryptoPosition();
    }
});

// Автоматический расчёт при изменении баланса, стоп-лосса или плеча
cryptoBalanceInput.addEventListener('input', () => {
    if (currentCryptoPrice) calculateCryptoPosition();
});
cryptoStopLossInput.addEventListener('input', () => {
    if (currentCryptoPrice) calculateCryptoPosition();
});

// При загрузке страницы
window.addEventListener('DOMContentLoaded', async () => {
    updateLeverageDisplay();
    await updateLivePrice();

    if (currentCryptoPrice && !cryptoStopLossInput.value) {
        const suggestedStopLong = (currentCryptoPrice * 0.97).toFixed(2);
        const suggestedStopShort = (currentCryptoPrice * 1.03).toFixed(2);
        cryptoStopLossInput.placeholder = 'LONG: ' + suggestedStopLong + ' | SHORT: ' + suggestedStopShort;
    }

    // Заполняем forex поля для декора
    const forexBalance = document.getElementById('forexBalance');
    const forexEntry = document.getElementById('forexEntry');
    const forexStop = document.getElementById('forexStop');
    const forexStep = document.getElementById('forexStep');
    const forexPriceStep = document.getElementById('forexPriceStep');
    if (forexBalance) forexBalance.value = '10000';
    if (forexEntry) forexEntry.value = '1.1050';
    if (forexStop) forexStop.value = '1.1020';
    if (forexStep) forexStep.value = '0.0001';
    if (forexPriceStep) forexPriceStep.value = '1';
});

// Блокировка кнопки вычисления FOREX
const forexCalcButton = document.getElementById('forexCalcBtn');
if (forexCalcButton) {
    forexCalcButton.addEventListener('click', (e) => {
        e.preventDefault();
        const forexResult = document.getElementById('forexResultBox');
        if (forexResult) forexResult.textContent = 'В разработке';
        setTimeout(() => {
            if (forexResult) forexResult.textContent = '—';
        }, 1200);
    });
}