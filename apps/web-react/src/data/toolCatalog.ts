import { text } from '../features/information/content'
import { toolsCopy } from '../cms/seed/toolsCopy'
import type { ToolCopy, ToolFieldSpec, ToolSpec, ToolResultSpec } from '../cms/contentTypes'

/**
 * The Tools Center catalog.
 *
 * Structure (inputs, result keys, the published formula string and the
 * cross-links to lessons and glossary terms) is code-owned and test-covered.
 * Prose is merged from `toolsCopy`, or from the Directus `tools` collection
 * when the content service has published a newer version — a reworded tagline
 * never changes what a calculator computes.
 */
type Definition = {
  slug: string
  category: ToolSpec['category']
  sort: number
  formula: string
  inputs: ToolFieldSpec[]
  results: ToolResultSpec[]
  glossary: string[]
  lessons: string[]
}

const DEFINITIONS: Definition[] = [
  {
    slug: 'position-size',
    category: 'sizing',
    sort: 1,
    formula: 'units = (equity x risk%) / ((|entry - stop| + entry x fee%) x contractSize)',
    glossary: ['position-size', 'margin', 'stop-loss', 'notional-value'],
    lessons: ['sizing-for-survival', 'stop-loss-placement'],
    inputs: [
      { key: 'equity', kind: 'currency', label: text('Account equity', 'ارزش خالص حساب'), unit: text('USD', 'دلار'), default: 10000 },
      { key: 'riskPct', kind: 'percent', label: text('Risk per trade', 'ریسک هر معامله'), help: text('Share of equity you accept losing on this trade.', 'سهمی از سرمایه که در این معامله می‌پذیری از دست بدهی.'), default: 1, min: 0.01, max: 100 },
      { key: 'direction', kind: 'select', label: text('Direction', 'جهت معامله'), options: [{ value: 'long', label: text('Long', 'خرید (Long)') }, { value: 'short', label: text('Short', 'فروش (Short)') }] },
      { key: 'entry', kind: 'number', label: text('Entry price', 'قیمت ورود'), min: 0, default: 60000 },
      { key: 'stop', kind: 'number', label: text('Stop price', 'قیمت حد ضرر'), min: 0, default: 58800 },
      { key: 'feePct', kind: 'percent', label: text('Fee per leg', 'کارمزد هر پا'), help: text('Applied to entry price for both legs as a simple allowance.', 'به‌عنوان سهمیهٔ ساده، روی قیمت ورود برای هر دو پا اعمال می‌شود.'), default: 0.035, min: 0, max: 100 },
      { key: 'contractSize', kind: 'number', label: text('Contract size', 'اندازهٔ هر قرارداد'), help: text('Units of the base asset per contract, as the venue defines it.', 'تعداد واحد دارایی پایه در هر قرارداد، همان‌طور که صرافی تعریف کرده.'), default: 1, min: 0 },
      { key: 'leverage', kind: 'number', label: text('Leverage', 'اهرم'), unit: text('×', '×'), default: 10, min: 1, max: 500 },
    ],
    results: [
      { key: 'units', label: text('Position size', 'حجم موقعیت'), format: 'number', precision: 6, emphasis: true, note: text('base units / contracts', 'واحد پایه / قرارداد') },
      { key: 'riskAmount', label: text('Money at risk', 'مبلغ در ریسک'), format: 'currency', emphasis: true },
      { key: 'notional', label: text('Notional value', 'ارزش اسمی'), format: 'currency' },
      { key: 'marginRequired', label: text('Margin required', 'وجه تضمین لازم'), format: 'currency' },
      { key: 'stopDistance', label: text('Distance to stop', 'فاصله تا حد ضرر'), format: 'number', precision: 4 },
      { key: 'stopDistancePct', label: text('Stop distance', 'فاصلهٔ حد ضرر'), format: 'percent' },
    ],
  },
  {
    slug: 'leverage-margin',
    category: 'sizing',
    sort: 2,
    formula: 'requiredMargin = notional / leverage',
    glossary: ['leverage', 'margin', 'maintenance-margin', 'notional-value', 'isolated-margin', 'cross-margin'],
    lessons: ['margin-and-leverage-basics', 'isolated-vs-cross-margin'],
    inputs: [
      { key: 'notional', kind: 'currency', label: text('Position value', 'ارزش موقعیت'), unit: text('USD', 'دلار'), default: 20000, min: 0 },
      { key: 'leverage', kind: 'number', label: text('Leverage', 'اهرم'), unit: text('×', '×'), default: 10, min: 1, max: 500 },
      { key: 'equity', kind: 'currency', label: text('Account equity', 'ارزش خالص حساب'), unit: text('USD', 'دلار'), default: 5000, min: 0 },
      { key: 'maintenancePct', kind: 'percent', label: text('Maintenance rate', 'نرخ نگهداری'), help: text('A single percentage of position value; venues publish tiers.', 'یک درصد ساده از ارزش موقعیت؛ صرافی‌ها پله‌ای اعلام می‌کنند.'), default: 0.5, min: 0, max: 100 },
      { key: 'marginMode', kind: 'select', label: text('Margin mode', 'حالت مارجین'), options: [{ value: 'isolated', label: text('Isolated', 'جدا (Isolated)') }, { value: 'cross', label: text('Cross', 'مشترک (Cross)') }] },
    ],
    results: [
      { key: 'requiredMargin', label: text('Margin required', 'وجه تضمین لازم'), format: 'currency', emphasis: true },
      { key: 'freeMargin', label: text('Free margin left', 'مارجین آزاد باقی‌مانده'), format: 'currency', emphasis: true },
      { key: 'marginUsagePct', label: text('Margin usage', 'سهم استفاده‌شده از مارجین'), format: 'percent' },
      { key: 'effectiveLeverage', label: text('Effective leverage', 'اهرم مؤثر'), format: 'ratio' },
      { key: 'maintenanceRequirement', label: text('Maintenance requirement', 'الزام نگهداری'), format: 'currency' },
      { key: 'bufferPct', label: text('Buffer to maintenance', 'حاشیه تا حد نگهداری'), format: 'percent' },
    ],
  },
  {
    slug: 'liquidation-price',
    category: 'risk',
    sort: 3,
    formula: 'long: liq = (notional - margin) / (qty x contractSize x (1 - m))  |  short: liq = (notional + margin) / (qty x contractSize x (1 + m))',
    glossary: ['liquidation', 'liquidation-price', 'maintenance-margin', 'isolated-margin', 'mark-price'],
    lessons: ['isolated-vs-cross-margin', 'drawdown-and-high-water-mark'],
    inputs: [
      { key: 'entry', kind: 'number', label: text('Entry price', 'قیمت ورود'), min: 0, default: 60000 },
      { key: 'qty', kind: 'number', label: text('Quantity', 'تعداد'), min: 0, default: 0.05 },
      { key: 'contractSize', kind: 'number', label: text('Contract size', 'اندازهٔ هر قرارداد'), default: 1, min: 0 },
      { key: 'direction', kind: 'select', label: text('Direction', 'جهت معامله'), options: [{ value: 'long', label: text('Long', 'خرید (Long)') }, { value: 'short', label: text('Short', 'فروش (Short)') }] },
      { key: 'leverage', kind: 'number', label: text('Leverage', 'اهرم'), unit: text('×', '×'), help: text('Used when you do not enter your own margin.', 'وقتی خودت مارجین وارد نکنی، از این استفاده می‌شود.'), default: 20, min: 1, max: 500 },
      { key: 'margin', kind: 'currency', label: text('Margin posted (optional)', 'وجه تضمین گذاشته‌شده (اختیاری)'), unit: text('USD', 'دلار'), help: text('Leave at zero to derive it from leverage.', 'روی صفر بگذار تا از اهرم محاسبه شود.'), default: 0, min: 0 },
      { key: 'maintenancePct', kind: 'percent', label: text('Maintenance rate', 'نرخ نگهداری'), default: 0.5, min: 0, max: 100 },
    ],
    results: [
      { key: 'liquidationPrice', label: text('Estimated liquidation price', 'قیمت برآوردی لیکوئید'), format: 'number', precision: 6, emphasis: true },
      { key: 'distancePct', label: text('Room to liquidation', 'فاصله تا لیکوئید'), format: 'percent', emphasis: true },
      { key: 'notional', label: text('Notional value', 'ارزش اسمی'), format: 'currency' },
      { key: 'marginPosted', label: text('Margin posted', 'وجه تضمین گذاشته‌شده'), format: 'currency' },
      { key: 'maintenanceRequirement', label: text('Maintenance requirement', 'الزام نگهداری'), format: 'currency' },
    ],
  },
  {
    slug: 'perp-pnl',
    category: 'risk',
    sort: 4,
    formula: 'net = dir x (exit - entry) x qty x contractSize - openFee - closeFee - funding',
    glossary: ['perpetual-future', 'funding-rate', 'taker-fee', 'maker-fee', 'margin', 'leverage'],
    lessons: ['perps-how-they-work', 'funding-rate-explained', 'fees-slippage-open-interest'],
    inputs: [
      { key: 'direction', kind: 'select', label: text('Direction', 'جهت معامله'), options: [{ value: 'long', label: text('Long', 'خرید (Long)') }, { value: 'short', label: text('Short', 'فروش (Short)') }] },
      { key: 'entry', kind: 'number', label: text('Entry price', 'قیمت ورود'), min: 0, default: 60000 },
      { key: 'exit', kind: 'number', label: text('Exit price', 'قیمت خروج'), min: 0, default: 63000 },
      { key: 'qty', kind: 'number', label: text('Quantity', 'تعداد'), min: 0, default: 0.05 },
      { key: 'contractSize', kind: 'number', label: text('Contract size', 'اندازهٔ هر قرارداد'), default: 1, min: 0 },
      { key: 'leverage', kind: 'number', label: text('Leverage', 'اهرم'), unit: text('×', '×'), default: 10, min: 1, max: 500 },
      { key: 'openFeePct', kind: 'percent', label: text('Open fee', 'کارمزد باز کردن'), default: 0.035, min: 0, max: 100 },
      { key: 'closeFeePct', kind: 'percent', label: text('Close fee', 'کارمزد بستن'), default: 0.035, min: 0, max: 100 },
      { key: 'fundingPct', kind: 'percent', label: text('Funding over the hold', 'فاندینگ دورهٔ نگه‌داری'), help: text('Total percentage of position value paid (positive) or received (negative).', 'جمع درصدی از ارزش موقعیت که پرداخته‌ای (مثبت) یا گرفته‌ای (منفی).'), default: 0.03, min: -100, max: 100 },
    ],
    results: [
      { key: 'netPnl', label: text('Net PnL', 'سود و زیان خالص'), format: 'signed', emphasis: true },
      { key: 'roiPct', label: text('Return on margin', 'بازده روی وجه تضمین'), format: 'percent', emphasis: true },
      { key: 'grossPnl', label: text('Gross PnL', 'سود و زیان ناخالص'), format: 'signed' },
      { key: 'fees', label: text('Fees paid', 'کارمزد پرداختی'), format: 'signed' },
      { key: 'funding', label: text('Funding', 'فاندینگ'), format: 'signed' },
      { key: 'breakEvenExit', label: text('Break-even exit', 'قیمت خروج سربه‌سر'), format: 'number', precision: 6 },
    ],
  },
  {
    slug: 'funding-rate',
    category: 'risk',
    sort: 5,
    formula: 'payment = qty x markPrice x rate x intervals  |  annualised = rate x intervalsPerDay x 365',
    glossary: ['funding-rate', 'perpetual-future', 'mark-price', 'notional-value', 'index-price', 'basis'],
    lessons: ['funding-rate-explained'],
    inputs: [
      { key: 'qty', kind: 'number', label: text('Quantity', 'تعداد'), min: 0, default: 0.5 },
      { key: 'markPrice', kind: 'number', label: text('Mark price', 'مارک پرایس'), min: 0, default: 60000 },
      { key: 'rate', kind: 'percent', label: text('Funding rate per interval', 'نرخ فاندینگ هر بازه'), help: text('Positive means longs pay shorts.', 'مثبت یعنی خریدار به فروشنده می‌پردازد.'), default: 0.01, min: -100, max: 100 },
      { key: 'intervalsPerDay', kind: 'number', label: text('Intervals per day', 'بازه در روز'), help: text('Many venues settle every 8 hours, which is 3.', 'خیلی از صرافی‌ها هر ۸ ساعت تسویه می‌کنند؛ یعنی ۳.'), default: 3, min: 1, max: 24 },
      { key: 'holdingHours', kind: 'number', label: text('Holding time', 'مدت نگه‌داری'), unit: text('hours', 'ساعت'), min: 0, default: 72 },
      { key: 'direction', kind: 'select', label: text('Direction', 'جهت معامله'), options: [{ value: 'long', label: text('Long', 'خرید (Long)') }, { value: 'short', label: text('Short', 'فروش (Short)') }] },
      { key: 'leverage', kind: 'number', label: text('Leverage', 'اهرم'), unit: text('×', '×'), default: 10, min: 1, max: 500 },
    ],
    results: [
      { key: 'totalPayment', label: text('Funding over the hold', 'فاندینگ کل دوره'), format: 'signed', emphasis: true, note: text('positive = you pay', 'مثبت = تو پرداخت می‌کنی') },
      { key: 'annualisedPct', label: text('Annualised rate', 'نرخ سالانه'), format: 'percent', emphasis: true },
      { key: 'notional', label: text('Position value', 'ارزش موقعیت'), format: 'currency' },
      { key: 'perInterval', label: text('Per interval', 'هر بازه'), format: 'signed' },
      { key: 'intervals', label: text('Intervals held', 'بازه‌های نگه‌داری'), format: 'number', precision: 2 },
      { key: 'pctOfMargin', label: text('Cost vs margin', 'هزینه نسبت به مارجین'), format: 'percent' },
    ],
  },
  {
    slug: 'risk-reward',
    category: 'risk',
    sort: 6,
    formula: 'RR = rewardPerUnit / riskPerUnit  |  breakEvenWinRate = risk / (risk + reward)',
    glossary: ['risk-reward-ratio', 'expectancy', 'win-rate', 'stop-loss', 'take-profit', 'profit-factor'],
    lessons: ['decision-discipline-and-checklists', 'sizing-for-survival'],
    inputs: [
      { key: 'direction', kind: 'select', label: text('Direction', 'جهت معامله'), options: [{ value: 'long', label: text('Long', 'خرید (Long)') }, { value: 'short', label: text('Short', 'فروش (Short)') }] },
      { key: 'entry', kind: 'number', label: text('Entry price', 'قیمت ورود'), min: 0, default: 60000 },
      { key: 'stop', kind: 'number', label: text('Stop price', 'قیمت حد ضرر'), min: 0, default: 58800 },
      { key: 'target', kind: 'number', label: text('Target price', 'قیمت هدف'), min: 0, default: 64800 },
      { key: 'equity', kind: 'currency', label: text('Account equity', 'ارزش خالص حساب'), unit: text('USD', 'دلار'), default: 10000 },
      { key: 'riskPct', kind: 'percent', label: text('Risk per trade', 'ریسک هر معامله'), default: 1, min: 0.01, max: 100 },
      { key: 'feePct', kind: 'percent', label: text('Round-trip fee', 'کارمزد رفت و برگشت'), default: 0.07, min: 0, max: 100 },
      { key: 'winRatePct', kind: 'percent', label: text('Assumed win rate (optional)', 'درصد برد فرضی (اختیاری)'), help: text('From your own journal, if you have one.', 'از ژورنال خودت، اگر نمونهٔ کافی داری.'), default: 45, min: 0, max: 100 },
    ],
    results: [
      { key: 'rrRatio', label: text('Reward to risk', 'ریوارد به ریسک'), format: 'ratio', emphasis: true },
      { key: 'feeAdjustedRR', label: text('Fee-adjusted RR', 'ریوارد به ریسک با کارمزد'), format: 'ratio' },
      { key: 'plannedRisk', label: text('Planned risk', 'ریسک برنامه‌ریزی‌شده'), format: 'currency' },
      { key: 'plannedReward', label: text('Planned reward', 'ریوارد برنامه‌ریزی‌شده'), format: 'currency' },
      { key: 'breakEvenWinPct', label: text('Break-even win rate', 'درصد برد سربه‌سر'), format: 'percent' },
      { key: 'expectancy', label: text('Expectancy per trade', 'امید ریاضی هر معامله'), format: 'signed' },
      { key: 'expectancyR', label: text('Expectancy in R', 'امید ریاضی بر حسب R'), format: 'ratio' },
    ],
  },
  {
    slug: 'risk-of-ruin',
    category: 'risk',
    sort: 7,
    formula: 'P(ruin) ≈ exp(-2 x mu x ln(capital / stopOut) / sigma^2)   [mu, sigma^2 = mean and variance of per-trade returns]',
    glossary: ['risk-of-ruin', 'kelly-criterion', 'expectancy', 'win-rate', 'max-drawdown'],
    lessons: ['sizing-for-survival', 'automated-systems-and-limits'],
    inputs: [
      { key: 'winRatePct', kind: 'percent', label: text('Win rate', 'درصد برد'), default: 45, min: 0, max: 100 },
      { key: 'avgWin', kind: 'currency', label: text('Average win', 'میانگین برد'), unit: text('USD', 'دلار'), default: 300, min: 0 },
      { key: 'avgLoss', kind: 'currency', label: text('Average loss', 'میانگین باخت'), unit: text('USD', 'دلار'), default: 100, min: 0 },
      { key: 'riskPct', kind: 'percent', label: text('Risk per trade', 'ریسک هر معامله'), help: text('Fraction of current capital staked on each trade.', 'سهمی از سرمایهٔ جاری که روی هر معامله شرط می‌شود.'), default: 1, min: 0.01, max: 100 },
      { key: 'capital', kind: 'currency', label: text('Starting capital', 'سرمایهٔ آغازین'), unit: text('USD', 'دلار'), default: 10000, min: 0 },
      { key: 'stopOut', kind: 'currency', label: text('Stop-out level', 'سطح توقف'), unit: text('USD', 'دلار'), help: text('The equity level you have decided you cannot continue from.', 'سطح سرمایه‌ای که تصمیم گرفته‌ای از آن ادامه ندهی.'), default: 8000, min: 0 },
    ],
    results: [
      { key: 'ruinPct', label: text('Estimated risk of ruin', 'احتمال برآوردی ویرانی'), format: 'percent', emphasis: true },
      { key: 'maxRiskPct', label: text('Max risk for 5% ruin', 'حداکثر ریسک برای ویرانی ۵٪'), format: 'percent', emphasis: true, note: text('model output, not a rule', 'خروجی مدل، نه قاعده') },
      { key: 'edgePerTrade', label: text('Edge per trade (R)', 'لبه در هر معامله (R)'), format: 'ratio' },
      { key: 'kellyPct', label: text('Kelly fraction', 'نسبت Kelly'), format: 'percent' },
      { key: 'payoff', label: text('Average win / average loss', 'میانگین برد بر باخت'), format: 'ratio' },
      { key: 'logDistance', label: text('Distance to stop-out', 'فاصلهٔ لگاریتمی تا توقف'), format: 'number', precision: 4 },
    ],
  },
  {
    slug: 'prop-drawdown',
    category: 'risk',
    sort: 8,
    formula: 'dailyLimit = dailyPct x max(dayStartBalance, dayStartEquity)  |  remaining = limit - max(0, baseline - equity)',
    glossary: ['daily-drawdown', 'max-drawdown', 'trailing-drawdown', 'high-water-mark', 'balance', 'equity'],
    lessons: ['drawdown-and-high-water-mark', 'risk-management-on-a-funded-account', 'reading-a-rulebook'],
    inputs: [
      { key: 'plan', kind: 'select', label: text('Challenge model', 'مدل چلنج'), help: text('Published terms of record — activation is not enabled in this release.', 'شرایط منتشرشده و مرجع — فعال‌سازی خرید در این نسخه فراهم نیست.'), options: [{ value: 'standard', label: text('Standard', 'استاندارد') }, { value: 'one-phase', label: text('One-phase', 'تک‌مرحله‌ای') }, { value: 'instant', label: text('Instant', 'آنی') }] },
      { key: 'accountSize', kind: 'currency', label: text('Account size', 'اندازهٔ حساب'), unit: text('USD', 'دلار'), default: 100000, min: 0 },
      { key: 'dayStartBalance', kind: 'currency', label: text('Day-start balance', 'موجودی ابتدای روز'), default: 100000, min: 0 },
      { key: 'dayStartEquity', kind: 'currency', label: text('Day-start equity', 'ارزش خالص ابتدای روز'), default: 100200, min: 0 },
      { key: 'currentBalance', kind: 'currency', label: text('Current balance', 'موجودی فعلی'), default: 100400, min: 0 },
      { key: 'currentEquity', kind: 'currency', label: text('Current equity', 'ارزش خالص فعلی'), default: 99600, min: 0 },
      { key: 'highWater', kind: 'currency', label: text('Highest balance or equity', 'بالاترین موجودی یا اکوییتی'), help: text('Used by the trailing model; leave at zero to use your inputs’ maximum.', 'برای مدل شناور لازم است؛ روی صفر بگذار تا از بیشینهٔ ورودی‌هایت گرفته شود.'), default: 0, min: 0 },
      { key: 'openRiskPct', kind: 'percent', label: text('Open risk on stop (optional)', 'ریسک باز روی حد ضرر (اختیاری)'), help: text('Percentage of account size that your open stops would lose.', 'درصدی از اندازهٔ حساب که حد ضررهای باز فعلاً ضرر می‌زنند.'), default: 1, min: 0, max: 100 },
    ],
    results: [
      { key: 'dailyLimit', label: text('Daily loss allowance', 'سقف ضرر روزانه'), format: 'currency', emphasis: true },
      { key: 'dailyRemaining', label: text('Daily room left', 'جای ماندهٔ امروز'), format: 'currency', emphasis: true },
      { key: 'totalLimit', label: text('Total loss allowance', 'سقف ضرر کل'), format: 'currency' },
      { key: 'totalRemaining', label: text('Total room left', 'جای ماندهٔ کل'), format: 'currency' },
      { key: 'dailyUsed', label: text('Used today', 'امروز مصرف‌شده'), format: 'currency' },
      { key: 'status', label: text('State', 'وضعیت'), format: 'text' },
    ],
  },
  {
    slug: 'consistency-rule',
    category: 'risk',
    sort: 9,
    formula: 'share = max(dailyProfit) / sum(dailyProfit)  |  compliant = share <= consistencyPct',
    glossary: ['consistency-rule', 'profit-factor', 'expectancy'],
    lessons: ['consistency-and-payout-conditions', 'trading-journal-that-works'],
    inputs: [
      { key: 'consistencyPct', kind: 'percent', label: text('Consistency limit', 'حد تداوم'), help: text('35% on the on-demand cycle, 15% on Instant in the published terms.', 'در شرایط منتشرشده ۳۵٪ برای چرخهٔ درخواستی و ۱۵٪ برای مدل آنی.'), default: 35, min: 1, max: 100 },
      { key: 'dailyProfits', kind: 'list', label: text('Net profit per day', 'سود خالص هر روز'), help: text('Comma, space or line separated. Losing days count as negative numbers.', 'با ویرگول، فاصله یا خط جدید جدا کن. روزهای زیان‌ده منفی وارد شوند.'), default: undefined as unknown as number },
      { key: 'plannedDay', kind: 'currency', label: text('Planned single day (optional)', 'یک روزِ برنامه‌ریزی‌شده (اختیاری)'), unit: text('USD', 'دلار'), help: text('Tests whether one more day of that size keeps you compliant.', 'می‌سنجد که یک روز دیگر به این بزرگی تداوم را نمی‌شکند.'), default: 0, min: 0 },
    ],
    results: [
      { key: 'sharePct', label: text('Best day share', 'سهم بهترین روز'), format: 'percent', emphasis: true },
      { key: 'verdict', label: text('Consistency', 'تداوم'), format: 'text', emphasis: true },
      { key: 'totalProfit', label: text('Total net profit', 'جمع سود خالص'), format: 'currency' },
      { key: 'largestDay', label: text('Largest day', 'بزرگ‌ترین روز'), format: 'currency' },
      { key: 'maxAllowedDay', label: text('Largest day allowed now', 'بزرگ‌ترین روز مجاز فعلی'), format: 'currency' },
      { key: 'futureRoom', label: text('Room for one more day', 'جا برای یک روز دیگر'), format: 'currency' },
    ],
  },
  {
    slug: 'journal-analyzer',
    category: 'analysis',
    sort: 10,
    formula: 'profitFactor = grossProfit / grossLoss  |  expectancy = p x avgWin - (1 - p) x avgLoss',
    glossary: ['profit-factor', 'expectancy', 'win-rate', 'max-drawdown', 'consistency-rule'],
    lessons: ['trading-journal-that-works', 'decision-discipline-and-checklists'],
    inputs: [
      { key: 'csv', kind: 'file', label: text('Closed trades (CSV)', 'معاملات بسته‌شده (CSV)'), help: text('Loaded in your browser only — the file is never uploaded.', 'فقط در مرورگر تو خوانده می‌شود؛ فایل هرگز بارگذاری نمی‌شود.'), default: undefined as unknown as number },
    ],
    results: [
      { key: 'trades', label: text('Trades read', 'معامله‌های خوانده‌شده'), format: 'number', precision: 0 },
      { key: 'netPnl', label: text('Net profit', 'سود خالص'), format: 'signed', emphasis: true },
      { key: 'winRatePct', label: text('Win rate', 'درصد برد'), format: 'percent', emphasis: true },
      { key: 'profitFactor', label: text('Profit factor', 'ضریب سود'), format: 'ratio' },
      { key: 'expectancy', label: text('Expectancy per trade', 'امید ریاضی هر معامله'), format: 'signed' },
      { key: 'maxDrawdown', label: text('Max drawdown', 'بیشترین افت'), format: 'currency' },
    ],
  },
]

/** merge code-owned structure with locale-neutral prose (bundled or CMS) */
export function buildToolSpecs(copy: Record<string, ToolCopy> = toolsCopy): ToolSpec[] {
  return DEFINITIONS
    .filter(definition => copy[definition.slug])
    .map(definition => ({
      slug: definition.slug,
      category: definition.category,
      sort: definition.sort,
      name: copy[definition.slug].name,
      tagline: copy[definition.slug].tagline,
      about: copy[definition.slug].about,
      inputs: definition.inputs,
      results: definition.results,
      formula: definition.formula,
      method: copy[definition.slug].method,
      assumptions: copy[definition.slug].assumptions,
      limitations: copy[definition.slug].limitations,
      glossary: definition.glossary,
      lessons: definition.lessons,
    }))
}

export const toolDefinitions = DEFINITIONS
