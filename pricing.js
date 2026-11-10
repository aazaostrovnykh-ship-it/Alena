// pricing.js — Единый модуль математики для типографии
// Все цены и константы собраны здесь, чтобы их было легко менять.

const PRICES = {
  // Бумага цифра (А3) — добавлены все виды
  digitalPaper: { '80': 9, '115': 17, '120': 17, '130': 23, '160': 23, '200': 25, '250': 27, '300': 30 },
  // Бумага офсет (А2)
  offsetPaper: { '80': 4.5, '115': 5.0, '130': 6.5, '200': 12.0, '250': 18.0, '300': 20.0 },
  
  // Печать цифра (базовая / от 50 листов)
  digitalPrint: { 
    '1+0': { base: 10, over50: 10 }, 
    '1+1': { base: 20, over50: 20 }, 
    '4+0': { base: 25, over50: 20 }, 
    '4+4': { base: 50, over50: 40 } 
  },
  
  // Офсет (себестоимость)
  offset: {
    machineSpeed: 6250,        // листов/час
    setupTimePerForm: 0.6,     // часов на 1 форму
    salaryPerHour: 3866 / 12,  // ЗП в час
    amortPerHour: 4189 / 12,   // Амортизация в час
    materialsPerHour: 313 / 12,// Материалы в час
    platePrice: 350,           // Цена формы
    inkCostPerForm: 150,       // Краска зависит от форм
    markup: 2.0,               // Наценка
  },
  
  // Переплеты и отделка (ДОБАВЛЕН soft: 30!)
  binding: { saddle: 8, perfect: 30, wire: 55, hard: 120, digitalKBS: 50, soft: 30 },
  finishing: { cut: 0.72, lam1: 10, lam2: 20, crease: 2.5, round: 1.2 },
  
  // Минимальная стоимость
  minOrder: 300,
  
  // Вспомогательные данные (ИСПРАВЛЕН VIZITKA на верхний регистр!)
  itemsPerA3: { 'A4': 2, 'A5': 4, 'A6': 8, 'A3': 1, 'VIZITKA': 24 },
  itemsPerA2: { 'A4': 4, 'A5': 8, 'A3': 2 },
  pagesPerA3: { 'A5': 8, 'A4': 4 },
  pagesPerA2: { 'A5': 16, 'A4': 8 },
  coversPerA3: { 'A5': 2, 'A4': 1 },
  coversPerA2: { 'A5': 4, 'A4': 2 }
};

const fmt = n => new Intl.NumberFormat('ru-RU').format(Math.round(n));

// 1. Функция расчета ЦИФРЫ
function calcDigital(productType, qty, options) {
  let total = 0;
  let details = [];

  if (productType === 'magazine') {
    const fixedPrice = options.magType === '30' ? 2300 : 2700;
    total = qty * fixedPrice;
    details.push({ label: 'Фикс. цена', val: `${fmt(total)} ₽`, unit: `${qty} шт × ${fixedPrice} ₽` });
  } 
  else if (productType === 'book') {
    const { format, pages, paperBlock, colorBlock, paperCover, colorCover, lamCover, binding } = options;
    
    // Блок
    const pagesPerSheet = PRICES.pagesPerA3[format];
    const blockSheetsPerCopy = Math.ceil(pages / pagesPerSheet);
    const cleanBlockSheets = blockSheetsPerCopy * qty;
    const totalBlockSheets = Math.ceil(cleanBlockSheets * 1.05);
    
    const printBlockBase = cleanBlockSheets * PRICES.digitalPrint[colorBlock].base;
    const printBlockDisc = cleanBlockSheets * PRICES.digitalPrint[colorBlock].over50;
    const printCostBlock = totalBlockSheets >= 50 ? Math.min(printBlockBase, printBlockDisc) : printBlockBase;
    
    const paperBlockBase = totalBlockSheets * PRICES.digitalPaper[paperBlock];
    const paperBlockDisc = totalBlockSheets * (PRICES.digitalPaper[paperBlock] * 0.8); 
    const paperCostBlock = totalBlockSheets >= 50 ? Math.min(paperBlockBase, paperBlockDisc) : paperBlockBase;

    // Обложка
    const coversPerSheet = PRICES.coversPerA3[format];
    const cleanCoverSheets = Math.ceil(qty / coversPerSheet);
    const totalCoverSheets = Math.ceil(cleanCoverSheets * 1.05);
    
    const printCoverBase = cleanCoverSheets * PRICES.digitalPrint[colorCover].base;
    const printCoverDisc = cleanCoverSheets * PRICES.digitalPrint[colorCover].over50;
    const printCostCover = totalCoverSheets >= 50 ? Math.min(printCoverBase, printCoverDisc) : printCoverBase;
    
    const paperCostCover = totalCoverSheets * PRICES.digitalPaper[paperCover];
    const lamCost = lamCover > 0 ? totalCoverSheets * (lamCover === 1 ? PRICES.finishing.lam1 : PRICES.finishing.lam2) : 0;
    
    // Переплет
    let bindPrice = PRICES.binding[binding];
    if (binding === 'perfect') bindPrice = PRICES.binding.digitalKBS;
    if (binding === 'wire' && format === 'A5') bindPrice = 40;
    const bindCost = qty * bindPrice;
    
    // Отделка
    const cutCost = (totalBlockSheets + totalCoverSheets) * PRICES.finishing.cut;
    const creaseCost = totalBlockSheets * PRICES.finishing.crease;

    total = printCostBlock + paperCostBlock + printCostCover + paperCostCover + lamCost + bindCost + cutCost + creaseCost;
    
    details.push({ label: 'Печать блока', val: `${fmt(printCostBlock)} ₽`, unit: `${cleanBlockSheets} отт.` });
    details.push({ label: 'Бумага блока', val: `${fmt(paperCostBlock)} ₽`, unit: `${totalBlockSheets} л.` });
    details.push({ label: 'Печать обложки', val: `${fmt(printCostCover)} ₽`, unit: `${cleanCoverSheets} отт.` });
    details.push({ label: 'Бумага обложки', val: `${fmt(paperCostCover)} ₽`, unit: `${totalCoverSheets} л.` });
    if (lamCost) details.push({ label: 'Ламинация', val: `${fmt(lamCost)} ₽`, unit: `${totalCoverSheets} л.` });
    details.push({ label: 'Переплет', val: `${fmt(bindCost)} ₽`, unit: `${qty} шт × ${bindPrice} ₽` });
    if (cutCost) details.push({ label: 'Резка', val: `${fmt(cutCost)} ₽`, unit: `` });
    if (creaseCost) details.push({ label: 'Биговка', val: `${fmt(creaseCost)} ₽`, unit: `` });
  } 
  else {
    // Листовки
    const { format, paper, color, cut, lam1, lam2, crease, round } = options;
    const itemsPerSheet = PRICES.itemsPerA3[format];
    const cleanSheets = Math.ceil(qty / itemsPerSheet);
    const totalSheets = Math.ceil(cleanSheets * 1.05);

    const printBase = cleanSheets * PRICES.digitalPrint[color].base;
    const printDisc = cleanSheets * PRICES.digitalPrint[color].over50;
    const printCost = totalSheets >= 50 ? Math.min(printBase, printDisc) : printBase;

    const paperBase = totalSheets * PRICES.digitalPaper[paper];
    const paperDisc = totalSheets * (PRICES.digitalPaper[paper] * 0.8);
    const paperCost = totalSheets >= 50 ? Math.min(paperBase, paperDisc) : paperBase;

    const cutCost = cut ? totalSheets * PRICES.finishing.cut : 0;
    const lamCost = lam1 ? totalSheets * PRICES.finishing.lam1 : (lam2 ? totalSheets * PRICES.finishing.lam2 : 0);
    const creaseCost = crease ? totalSheets * PRICES.finishing.crease : 0;
    const roundCost = round ? qty * PRICES.finishing.round : 0;

    total = printCost + paperCost + cutCost + lamCost + creaseCost + roundCost;
    total = Math.max(total, PRICES.minOrder);

    details.push({ label: 'Печать', val: `${fmt(printCost)} ₽`, unit: `${cleanSheets} отт.` });
    details.push({ label: 'Бумага', val: `${fmt(paperCost)} ₽`, unit: `${totalSheets} л.` });
    if (cutCost) details.push({ label: 'Резка', val: `${fmt(cutCost)} ₽`, unit: `` });
    if (lamCost) details.push({ label: 'Ламинация', val: `${fmt(lamCost)} ₽`, unit: `` });
    if (creaseCost) details.push({ label: 'Биговка', val: `${fmt(creaseCost)} ₽`, unit: `` });
    if (roundCost) details.push({ label: 'Скругление', val: `${fmt(roundCost)} ₽`, unit: `` });
  }

  // Округление до 10
  total = Math.round(total / 10) * 10;
  return { total, details };
}

// 2. Функция расчета ОФСЕТА
function calcOffset(productType, qty, options) {
  const isSelfTurn = options.selfTurn;
  let total = 0;
  let details = [];

  function calcMachineCost(sheets, forms, colorsPerForm) {
    const hours = (PRICES.offset.setupTimePerForm * forms) + (sheets / PRICES.offset.machineSpeed);
    const roundedHours = Math.ceil(hours * 4) / 4;
    
    const cost = (roundedHours * PRICES.offset.salaryPerHour) + 
                 (roundedHours * PRICES.offset.amortPerHour) + 
                 (roundedHours * PRICES.offset.materialsPerHour) + 
                 (forms * PRICES.offset.platePrice) + 
                 (forms * PRICES.offset.inkCostPerForm);
    return cost * PRICES.offset.markup;
  }

  function getForms(color) {
    let front = (color === '1+0' || color === '1+1') ? 1 : 4;
    let back = (color === '1+1' || color === '4+4') ? front : 0;
    return front + (isSelfTurn ? 0 : back);
  }

  if (productType === 'book' || productType === 'brochure') {
    const { format, pages, paperBlock, colorBlock, paperCover, colorCover, lamCover, binding } = options;
    
    const pagesPerSheet = PRICES.pagesPerA2[format];
    const sheetsPerCopy = Math.ceil(pages / pagesPerSheet);
    const cleanBlockSheets = sheetsPerCopy * qty;
    const formsPerSheet = getForms(colorBlock);
    const totalFormsBlock = sheetsPerCopy * formsPerSheet;
    
    const printCostBlock = calcMachineCost(cleanBlockSheets, totalFormsBlock, formsPerSheet);
    const totalBlockSheets = cleanBlockSheets + (totalFormsBlock * 50);
    const paperCostBlock = totalBlockSheets * PRICES.offsetPaper[paperBlock];

    const coversPerSheet = PRICES.coversPerA2[format];
    const cleanCoverSheets = Math.ceil(qty / coversPerSheet);
    const formsCover = getForms(colorCover);
    
    const printCostCover = calcMachineCost(cleanCoverSheets, formsCover, formsCover);
    const totalCoverSheets = cleanCoverSheets + (formsCover * 50);
    const paperCostCover = totalCoverSheets * PRICES.offsetPaper[paperCover];
    const lamCost = lamCover > 0 ? totalCoverSheets * (lamCover === 1 ? 10 : 20) : 0;

    let bindPrice = PRICES.binding[binding]; // Теперь 'soft' здесь есть!
    const bindCost = qty * bindPrice;
    const cutCost = (totalBlockSheets + totalCoverSheets) * 1.0;
    const creaseCost = totalBlockSheets * 2.5;

    total = printCostBlock + paperCostBlock + printCostCover + paperCostCover + lamCost + bindCost + cutCost + creaseCost;
    
    details.push({ label: 'Печать блока', val: `${fmt(printCostBlock)} ₽`, unit: `работа` });
    details.push({ label: 'Бумага блока', val: `${fmt(paperCostBlock)} ₽`, unit: `${totalBlockSheets} л.` });
    details.push({ label: 'Печать обложки', val: `${fmt(printCostCover)} ₽`, unit: `работа` });
    details.push({ label: 'Бумага обложки', val: `${fmt(paperCostCover)} ₽`, unit: `${totalCoverSheets} л.` });
    if (lamCost) details.push({ label: 'Ламинация', val: `${fmt(lamCost)} ₽`, unit: `` });
    details.push({ label: 'Переплет', val: `${fmt(bindCost)} ₽`, unit: `${qty} шт × ${bindPrice} ₽` });
    if (cutCost) details.push({ label: 'Резка', val: `${fmt(cutCost)} ₽`, unit: `` });
    if (creaseCost) details.push({ label: 'Биговка', val: `${fmt(creaseCost)} ₽`, unit: `` });

  } else {
    const { format, paper, color, cut, crease } = options;
    const itemsPerA2 = PRICES.itemsPerA2[format];
    const cleanSheets = Math.ceil(qty / itemsPerA2);
    const forms = getForms(color);
    
    const printCost = calcMachineCost(cleanSheets, forms, forms);
    const totalSheets = cleanSheets + (forms * 50);
    const paperCost = totalSheets * PRICES.offsetPaper[paper];
    const cutCost = cut ? totalSheets * 1.0 : 0;
    const creaseCost = crease ? totalSheets * 2.5 : 0;

    total = printCost + paperCost + cutCost + creaseCost;

    details.push({ label: 'Печать', val: `${fmt(printCost)} ₽`, unit: `работа` });
    details.push({ label: 'Бумага', val: `${fmt(paperCost)} ₽`, unit: `${totalSheets} л.` });
    if (cutCost) details.push({ label: 'Резка', val: `${fmt(cutCost)} ₽`, unit: `` });
    if (creaseCost) details.push({ label: 'Биговка', val: `${fmt(creaseCost)} ₽`, unit: `` });
  }

  total = Math.round(total / 10) * 10;
  return { total, details };
}
