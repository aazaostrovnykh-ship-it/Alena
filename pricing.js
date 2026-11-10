// pricing.js — Единый модуль математики для типографии
// Все цены и константы собраны здесь, чтобы их было легко менять.
//
// Тарифы печати и бумаги — двухступенчатые: первые 50 листов по цене base,
// всё что дальше — по over50. Стоимость считается НАРАСТАЮЩЕ (маржинально),
// поэтому цена не может упасть при увеличении тиража.

const PRICES = {
  // Бумага цифра (А3), ₽ за лист: первые 50 листов / от 50 листов
  digitalPaper: {
    '80': { base: 9, over50: 5 },
    '115': { base: 17, over50: 13 },
    '120': { base: 17, over50: 13 },
    '130': { base: 23, over50: 20 },
    '160': { base: 23, over50: 20 },
    '200': { base: 25, over50: 22 },
    '250': { base: 27, over50: 23 },
    '300': { base: 30, over50: 25 },
  },
  // Бумага офсет (А2), ₽ за лист
  offsetPaper: { '80': 4.5, '115': 5.0, '130': 6.5, '200': 12.0, '250': 18.0, '300': 20.0 },

  // Печать цифра, ₽ за лист: первые 50 / от 50
  digitalPrint: {
    '1+0': { base: 10, over50: 10 },
    '1+1': { base: 20, over50: 20 },
    '4+0': { base: 25, over50: 20 },
    '4+4': { base: 50, over50: 40 },
  },

  // Офсет (себестоимость)
  offset: {
    machineSpeed: 6250,        // листов/час
    setupTimePerForm: 0.6,     // часов на 1 форму
    salaryPerHour: 3866 / 12,  // ЗП в час
    amortPerHour: 4189 / 12,   // Амортизация в час
    materialsPerHour: 313 / 12,// Материалы в час
    platePrice: 350,           // Цена формы
    inkCostPerForm: 150,       // Краска на форму
    markup: 2.0,               // Наценка
    wastePerForm: 50,          // листов на приладку одной формы
  },

  // Переплёты: у цифры и офсета разные цены, поэтому две таблицы
  digitalBinding: { saddle: 8, perfect: 50, wire: 55, hard: 200 },
  offsetBinding: { saddle: 8, perfect: 30, soft: 30, hard: 120 },
  digitalCollation: 20,        // подборка, только для твёрдого переплёта
  wireA5: 40,                  // пружина для А5 дешевле

  // Отделка
  lamination: { one: 10, two: 20 },
  digitalFinishing: { cut: 0.72, crease: 10, round: 1.2 },
  offsetFinishing: { cut: 1.0, crease: 2.5 },

  // Минимальная стоимость заказа
  minOrder: 300,

  // Раскладка
  itemsPerA3: { A4: 2, A5: 4, A6: 8, A3: 1, vizitka: 24 },
  itemsPerA2: { A4: 4, A5: 8, A3: 2 },
  pagesPerA3: { A5: 8, A4: 4 },
  pagesPerA2: { A5: 16, A4: 8 },
  coversPerA3: { A5: 2, A4: 1 },
  coversPerA2: { A5: 4, A4: 2 },
};

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n));

// Приводим ключ формата к тому виду, что в таблицах: 'VIZITKA' -> 'vizitka'.
function normFormat(format) {
  const k = String(format || '').toLowerCase();
  return k === 'vizitka' ? 'vizitka' : k.toUpperCase();
}

function normBinding(binding) {
  return String(binding || '').toLowerCase();
}

// Нарастающая двухступенчатая стоимость: первые `threshold` единиц по base,
// остальные — по over50. Если over50 >= base, ступень не даёт выгоды.
function tierCost(units, tier, threshold) {
  const t = threshold == null ? 50 : threshold;
  if (!tier || tier.over50 == null || tier.over50 >= tier.base) return units * tier.base;
  const first = Math.min(units, t);
  const rest = Math.max(0, units - t);
  return first * tier.base + rest * tier.over50;
}

function lookup(map, key, what) {
  const v = map[key];
  if (v == null) {
    console.warn('pricing: нет цены «' + what + '» для «' + key + '»');
    return null;
  }
  return v;
}

function clampQty(qty) {
  const n = Math.round(Number(qty));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// 1. ЦИФРОВАЯ ПЕЧАТЬ
function calcDigital(productType, qty, options) {
  qty = clampQty(qty);
  options = options || {};
  let total = 0;
  const details = [];

  if (productType === 'magazine') {
    const fixedPrice = options.magType === '30' ? 2300 : 2700;
    total = qty * fixedPrice;
    details.push({ label: 'Фикс. цена', val: fmt(total) + ' ₽', unit: qty + ' шт × ' + fixedPrice + ' ₽' });
  } else if (productType === 'book') {
    const format = normFormat(options.format);
    const pages = Math.max(4, Math.round(Number(options.pages) || 4));
    const paperBlock = lookup(PRICES.digitalPaper, options.paperBlock, 'бумага блока');
    const paperCover = lookup(PRICES.digitalPaper, options.paperCover, 'бумага обложки');
    const printBlock = lookup(PRICES.digitalPrint, options.colorBlock, 'красочность блока');
    const printCover = lookup(PRICES.digitalPrint, options.colorCover, 'красочность обложки');
    const pagesPerSheet = lookup(PRICES.pagesPerA3, format, 'страниц на лист А3');
    const coversPerSheet = lookup(PRICES.coversPerA3, format, 'обложек на лист А3');
    if (!paperBlock || !paperCover || !printBlock || !printCover || !pagesPerSheet || !coversPerSheet) {
      return { total: 0, details: [{ label: 'Ошибка', val: 'проверьте параметры', unit: '' }] };
    }

    // Блок
    const blockSheetsPerCopy = Math.ceil(pages / pagesPerSheet);
    const cleanBlockSheets = blockSheetsPerCopy * qty;
    const totalBlockSheets = Math.ceil(cleanBlockSheets * 1.05);
    const printCostBlock = tierCost(cleanBlockSheets, printBlock);
    const paperCostBlock = tierCost(totalBlockSheets, paperBlock);

    // Обложка
    const cleanCoverSheets = Math.ceil(qty / coversPerSheet);
    const totalCoverSheets = Math.ceil(cleanCoverSheets * 1.05);
    const printCostCover = tierCost(cleanCoverSheets, printCover);
    const paperCostCover = tierCost(totalCoverSheets, paperCover);

    // Ламинация обложки: 0 — нет, 1 — одна сторона, 2 — две
    const lamCover = Number(options.lamCover) || 0;
    const lamCost = lamCover > 0
      ? totalCoverSheets * (lamCover === 2 ? PRICES.lamination.two : PRICES.lamination.one)
      : 0;

    // Переплёт
    const binding = normBinding(options.binding);
    let bindPrice = PRICES.digitalBinding[binding];
    if (bindPrice == null) {
      console.warn('pricing: нет цены переплёта «' + binding + '»');
      bindPrice = 0;
    }
    if (binding === 'wire' && format === 'A5') bindPrice = PRICES.wireA5;
    const bindCost = qty * bindPrice;
    const collationCost = binding === 'hard' ? qty * PRICES.digitalCollation : 0;

    // Отделка блока: подрезка и биговка выполняются всегда
    const cutCost = (totalBlockSheets + totalCoverSheets) * PRICES.digitalFinishing.cut;
    const creaseCost = totalBlockSheets * PRICES.digitalFinishing.crease;

    total = printCostBlock + paperCostBlock + printCostCover + paperCostCover
      + lamCost + bindCost + collationCost + cutCost + creaseCost;

    details.push({ label: 'Печать блока', val: fmt(printCostBlock) + ' ₽', unit: cleanBlockSheets + ' отт.' });
    details.push({ label: 'Бумага блока', val: fmt(paperCostBlock) + ' ₽', unit: totalBlockSheets + ' л.' });
    details.push({ label: 'Печать обложки', val: fmt(printCostCover) + ' ₽', unit: cleanCoverSheets + ' отт.' });
    details.push({ label: 'Бумага обложки', val: fmt(paperCostCover) + ' ₽', unit: totalCoverSheets + ' л.' });
    if (lamCost) details.push({ label: 'Ламинация', val: fmt(lamCost) + ' ₽', unit: totalCoverSheets + ' л.' });
    details.push({ label: 'Переплет', val: fmt(bindCost) + ' ₽', unit: qty + ' шт × ' + bindPrice + ' ₽' });
    if (collationCost) details.push({ label: 'Подборка', val: fmt(collationCost) + ' ₽', unit: qty + ' шт × ' + PRICES.digitalCollation + ' ₽' });
    details.push({ label: 'Резка', val: fmt(cutCost) + ' ₽', unit: '' });
    details.push({ label: 'Биговка', val: fmt(creaseCost) + ' ₽', unit: '' });
  } else {
    // Листовки, визитки
    const format = normFormat(options.format);
    const itemsPerSheet = lookup(PRICES.itemsPerA3, format, 'изделий на лист А3');
    const paper = lookup(PRICES.digitalPaper, options.paper, 'бумага');
    const print = lookup(PRICES.digitalPrint, options.color, 'красочность');
    if (!itemsPerSheet || !paper || !print) {
      return { total: 0, details: [{ label: 'Ошибка', val: 'проверьте параметры', unit: '' }] };
    }

    const cleanSheets = Math.ceil(qty / itemsPerSheet);
    const totalSheets = Math.ceil(cleanSheets * 1.05);

    const printCost = tierCost(cleanSheets, print);
    const paperCost = tierCost(totalSheets, paper);

    const cutCost = options.cut ? totalSheets * PRICES.digitalFinishing.cut : 0;
    // Ламинация: взаимоисключающие варианты, 2 стороны приоритетнее
    const lamCost = options.lam2
      ? totalSheets * PRICES.lamination.two
      : options.lam1 ? totalSheets * PRICES.lamination.one : 0;
    const creaseCost = options.crease ? totalSheets * PRICES.digitalFinishing.crease : 0;
    const roundCost = options.round ? qty * PRICES.digitalFinishing.round : 0;

    total = printCost + paperCost + cutCost + lamCost + creaseCost + roundCost;

    details.push({ label: 'Печать', val: fmt(printCost) + ' ₽', unit: cleanSheets + ' отт.' });
    details.push({ label: 'Бумага', val: fmt(paperCost) + ' ₽', unit: totalSheets + ' л.' });
    if (cutCost) details.push({ label: 'Резка', val: fmt(cutCost) + ' ₽', unit: '' });
    if (lamCost) details.push({ label: 'Ламинация', val: fmt(lamCost) + ' ₽', unit: '' });
    if (creaseCost) details.push({ label: 'Биговка', val: fmt(creaseCost) + ' ₽', unit: '' });
    if (roundCost) details.push({ label: 'Скругление', val: fmt(roundCost) + ' ₽', unit: '' });
  }

  total = Math.max(total, PRICES.minOrder);
  total = Math.round(total / 10) * 10;
  return { total, details };
}

// 2. ОФСЕТНАЯ ПЕЧАТЬ
function calcOffset(productType, qty, options) {
  qty = clampQty(qty);
  options = options || {};
  const isSelfTurn = !!options.selfTurn;
  let total = 0;
  const details = [];

  function calcMachineCost(sheets, forms) {
    const hours = PRICES.offset.setupTimePerForm * forms + sheets / PRICES.offset.machineSpeed;
    const roundedHours = Math.ceil(hours * 4) / 4;

    const cost = roundedHours * PRICES.offset.salaryPerHour
      + roundedHours * PRICES.offset.amortPerHour
      + roundedHours * PRICES.offset.materialsPerHour
      + forms * PRICES.offset.platePrice
      + forms * PRICES.offset.inkCostPerForm;
    return cost * PRICES.offset.markup;
  }

  function getForms(color) {
    const front = color === '1+0' || color === '1+1' ? 1 : 4;
    const back = color === '1+1' || color === '4+4' ? front : 0;
    return front + (isSelfTurn ? 0 : back);
  }

  if (productType === 'book' || productType === 'brochure') {
    const format = normFormat(options.format);
    const pages = Math.max(4, Math.round(Number(options.pages) || 4));
    const paperBlock = lookup(PRICES.offsetPaper, options.paperBlock, 'бумага блока');
    const paperCover = lookup(PRICES.offsetPaper, options.paperCover, 'бумага обложки');
    const pagesPerSheet = lookup(PRICES.pagesPerA2, format, 'страниц на лист А2');
    const coversPerSheet = lookup(PRICES.coversPerA2, format, 'обложек на лист А2');
    if (!paperBlock || !paperCover || !pagesPerSheet || !coversPerSheet) {
      return { total: 0, details: [{ label: 'Ошибка', val: 'проверьте параметры', unit: '' }] };
    }

    const sheetsPerCopy = Math.ceil(pages / pagesPerSheet);
    const cleanBlockSheets = sheetsPerCopy * qty;
    const formsPerSheet = getForms(options.colorBlock);
    const totalFormsBlock = sheetsPerCopy * formsPerSheet;

    const printCostBlock = calcMachineCost(cleanBlockSheets, totalFormsBlock);
    const totalBlockSheets = cleanBlockSheets + totalFormsBlock * PRICES.offset.wastePerForm;
    const paperCostBlock = totalBlockSheets * paperBlock;

    const cleanCoverSheets = Math.ceil(qty / coversPerSheet);
    const formsCover = getForms(options.colorCover);

    const printCostCover = calcMachineCost(cleanCoverSheets, formsCover);
    const totalCoverSheets = cleanCoverSheets + formsCover * PRICES.offset.wastePerForm;
    const paperCostCover = totalCoverSheets * paperCover;

    const lamCover = Number(options.lamCover) || 0;
    const lamCost = lamCover > 0
      ? totalCoverSheets * (lamCover === 2 ? PRICES.lamination.two : PRICES.lamination.one)
      : 0;

    const binding = normBinding(options.binding);
    let bindPrice = PRICES.offsetBinding[binding];
    if (bindPrice == null) {
      console.warn('pricing: нет цены переплёта «' + binding + '»');
      bindPrice = 0;
    }
    const bindCost = qty * bindPrice;

    // Отделка — только если отмечена в форме
    const cutCost = options.cut ? (totalBlockSheets + totalCoverSheets) * PRICES.offsetFinishing.cut : 0;
    const creaseCost = options.crease ? totalBlockSheets * PRICES.offsetFinishing.crease : 0;

    total = printCostBlock + paperCostBlock + printCostCover + paperCostCover
      + lamCost + bindCost + cutCost + creaseCost;

    details.push({ label: 'Печать блока', val: fmt(printCostBlock) + ' ₽', unit: 'работа' });
    details.push({ label: 'Бумага блока', val: fmt(paperCostBlock) + ' ₽', unit: totalBlockSheets + ' л.' });
    details.push({ label: 'Печать обложки', val: fmt(printCostCover) + ' ₽', unit: 'работа' });
    details.push({ label: 'Бумага обложки', val: fmt(paperCostCover) + ' ₽', unit: totalCoverSheets + ' л.' });
    if (lamCost) details.push({ label: 'Ламинация', val: fmt(lamCost) + ' ₽', unit: '' });
    details.push({ label: 'Переплет', val: fmt(bindCost) + ' ₽', unit: qty + ' шт × ' + bindPrice + ' ₽' });
    if (cutCost) details.push({ label: 'Резка', val: fmt(cutCost) + ' ₽', unit: '' });
    if (creaseCost) details.push({ label: 'Биговка', val: fmt(creaseCost) + ' ₽', unit: '' });
  } else {
    const format = normFormat(options.format);
    const itemsPerA2 = lookup(PRICES.itemsPerA2, format, 'изделий на лист А2');
    const paper = lookup(PRICES.offsetPaper, options.paper, 'бумага');
    if (!itemsPerA2 || !paper) {
      return { total: 0, details: [{ label: 'Ошибка', val: 'проверьте параметры', unit: '' }] };
    }

    const cleanSheets = Math.ceil(qty / itemsPerA2);
    const forms = getForms(options.color);

    const printCost = calcMachineCost(cleanSheets, forms);
    const totalSheets = cleanSheets + forms * PRICES.offset.wastePerForm;
    const paperCost = totalSheets * paper;
    const cutCost = options.cut ? totalSheets * PRICES.offsetFinishing.cut : 0;
    const creaseCost = options.crease ? totalSheets * PRICES.offsetFinishing.crease : 0;

    total = printCost + paperCost + cutCost + creaseCost;

    details.push({ label: 'Печать', val: fmt(printCost) + ' ₽', unit: 'работа' });
    details.push({ label: 'Бумага', val: fmt(paperCost) + ' ₽', unit: totalSheets + ' л.' });
    if (cutCost) details.push({ label: 'Резка', val: fmt(cutCost) + ' ₽', unit: '' });
    if (creaseCost) details.push({ label: 'Биговка', val: fmt(creaseCost) + ' ₽', unit: '' });
  }

  total = Math.max(total, PRICES.minOrder);
  total = Math.round(total / 10) * 10;
  return { total, details };
}
