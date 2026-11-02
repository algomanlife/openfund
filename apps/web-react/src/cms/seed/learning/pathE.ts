import { text } from '../../../features/information/content'
import type { LearningPathContent } from '../../contentTypes'

/** Learning Center - Path E: On-chain transparency.
 *  Repo authoring source for the advanced path on reading public chain data,
 *  proof-of-reserves, transaction verification, smart contracts and the real
 *  limits of on-chain disclosure. It is educational only: nothing here is
 *  investment advice and no lesson claims a price, return, TVL, volume or user
 *  count. Every Openfund statement is deliberately narrow and honest: the
 *  Perpetual Trading surface reads public data of the Gains Network deployment
 *  on Arbitrum One and is read-only - on-chain order execution is not enabled in
 *  this release and Gains transaction execution is disabled by project policy
 *  until testnet contracts, simulation and validation exist; Prop Trading runs a
 *  server-side simulated demo (one free_demo account, 100,000 virtual DAI priced
 *  from live mark prices) whose trades are not on-chain events; the
 *  openfund-protocol module is a dormant, imported third-party contract
 *  foundation (upstream MUX, GPL-2.0), not compiled at its imported HEAD, not
 *  deployed, not the live settlement layer, and the Certik PDF inside it is an
 *  upstream report about that third-party code - not an audit of Openfund, which
 *  has no independent security audit yet (independent review is planned);
 *  Openfund has no proof of reserves, no published vault, no on-chain settlement
 *  and no customer-fund custody today; the Transparency page renders clearly
 *  labelled sample data. Openfund offers code-level transparency (a public
 *  source repository and docs), which is distinguished from financial
 *  transparency throughout. NOT imported by the app at runtime. */
export const pathE: LearningPathContent = {
  key: 'onchain',
  slug: 'on-chain-transparency',
  sort: 5,
  level: 'advanced',
  eyebrow: text('Path E · On-chain', 'مسیر E · شفافیت درون‌زنجیره‌ای'),
  title: text('On-chain transparency', 'شفافیت درون‌زنجیره‌ای'),
  summary: text(
    'Public chain data is the one part of a market you can check without trusting anyone, but only if you read it correctly. This path teaches the fields a block explorer shows, what a proof of reserves does and does not demonstrate, how to verify a transaction on your own, what a smart contract hides behind a clean terminal, and where on-chain transparency stops being transparency.',
    'دادهٔ عمومیِ زنجیره تنها بخشی از بازار است که بدون اتکا به هیچ‌کس می‌توانی راستی‌آزمایی‌اش کنی — البته اگر درست خوانده شود. این مسیر فیلدهایی که یک block explorer نشان می‌دهد، آنچه اثبات ذخایر واقعاً می‌کند و آنچه نمی‌کند، روشِ مستقلِ راستی‌آزمایی یک تراکنش، آنچه یک قراردادِ هوشمند پشتِ ترمینالِ تمیز پنهان می‌کند، و جایی که شفافیتِ درون‌زنجیره‌ای دیگر شفافیت نیست را می‌آموزد.'
  ),
  outcomes: [
    text('you can read the fields on an explorer page - address, transaction hash, block number, gas, nonce, status, value and input data - and say what each actually means', 'می‌توانی فیلدهای یک صفحهٔ explorer را — نشانی، هشِ تراکنش، شمارهٔ بلاک، gas، nonce، وضعیت، مقدار و دادهٔ ورودی — بخوانی و بگویی هرکدام دقیقاً چه معنا دارد'),
    text('you can state precisely what a proof-of-reserves snapshot proves and the liabilities, custody terms and off-chain obligations it silently leaves out', 'می‌توانی دقیقاً بگویی یک snapshot اثباتِ ذخایر چه چیزی را ثابت می‌کند و چه بدهی‌ها، توافرهای امانت و تعهداتِ برون‌زنجیره‌ای را بی‌صدا کنار می‌گذارد'),
    text('you can verify one transaction from its hash across more than one independent source and distinguish confirmation count from finality', 'می‌توانی یک تراکنش را از هشِ آن روی بیش از یک مبدأِ مستقل راستی‌آزمایی کنی و شمارشِ تأیید را از قطعیت تفکیک کنی'),
    text('you can tell code-level transparency (an open repository and docs) apart from financial transparency (reserves, audits, settlement), and know which one Openfund actually offers today', 'می‌توانی شفافیتِ سطحِ کد (مخزنِ باز و مستندات) را از شفافیتِ مالی (ذخایر، حسابرسی، تسویه) جدا کنی و بدویی امروز اوپن‌فاند کدام را واقعاً ارائه می‌دهد'),
  ],
  lessons: [
    {
      slug: 'reading-a-block-explorer',
      path: 'on-chain-transparency',
      sort: 1,
      minutes: 9,
      status: 'published',
      title: text('Reading a block explorer', 'خواندن اکسپلورر بلاک'),
      summary: text(
        'A block explorer is a searchable index over a public chain, and every field on the page means something specific - this lesson walks through the fields one by one so you stop reading numbers you cannot explain.',
        'block explorer یک نمایهٔ قابل‌جستجو روی زنجیره‌ای عمومی است و هر فیلدِ صفحه معنای مشخصی دارد — این درس فیلدها را یکی‌یکی پیش می‌برد تا دیگر عددی را نخوانی که نمی‌توانی توضیحش دهی.'
      ),
      takeaways: [
        text('An address identifies an account or contract; a transaction hash identifies one specific transaction - they are not interchangeable and mixing them up is the most common reading error', 'نشانی، یک حساب یا قرارداد را مشخص می‌کند و هشِ تراکنش یک تراکنشِ مشخص را — این دو جای هم‌دیگر نیستند و جابه‌جا خواندنشان رایج‌ترین خطایِ خواندن است'),
        text('Block number, gas and nonce are each separate facts: where a transaction landed, what it cost to run, and how many transactions the sender had sent before it', 'شمارهٔ بلاک، gas و nonce سه واقعیتِ جداوند: تراکنش کجا نشست، اجرای آن چقدر خرج برداشت، و فرستنده پیش از آن چند تراکنش فرستاده بود'),
        text('Status says whether a transaction succeeded, and confirmation count says how deep it sits - but neither says it can no longer be reversed, because that is finality, a property of the chain rather than the page', 'وضعیت می‌گوید تراکنش موفق شده و شمارشِ تأیید می‌گوید چقدر عمیق نشسته — اما هیچ‌کدام نمی‌گوید دیگر قابلِ برگشت نیست، چون آن قطعیت است و ویژگیِ زنجیره نه این صفحه'),
        text('One explorer is an index of the chain, not the chain itself - before you treat any number as settled, look up the same hash on a second independent source', 'هر explorer نمایهٔ زنجیره است نه خودِ زنجیره — پیش از آنکه عددی را قطعی بخوانی، همان هش را روی مبدأِ مستقلِ دومی ببین'),
      ],
      glossary: ['block-explorer'],
      tools: ['perp-pnl', 'liquidation-price'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A block explorer is not a wallet, an exchange or an authority. It is a searchable index that reads the public ledger and lays one account or one transaction out on a page so a human can read it. That distinction matters, because everything trustworthy on that page is just a faithful copy of data that already exists on the chain - and everything you should be cautious about is any place the explorer adds its own interpretation. The right posture is to treat the page as a window, verify the view, and never confuse the window with the room.',
            'block explorer نه کیف پول است، نه صرافی و نه یک مرجعِ اقتدار. یک نمایهٔ قابل‌جستجو است که دفترِ کلِ عمومی را می‌خواند و یک حساب یا یک تراکنش را روی صفحه می‌چیند تا آدم بتواندش بخواند. این تفکیک مهم است، چون هر چیزِ قابل‌اعتماد روی آن صفحه فقط نسخه‌ای امین از داده‌ای است که از پیش روی زنجیره هست — و هر جایی که باید محتاط باشی آن‌جاست که explorer برداشتِ خودش را اضافه می‌کند. حالتِ درست این است که صفحه را پنجره بدان، منظره را راستی‌آزمایی کنی، و هرگز پنجره را با اتاق اشتباه نگیری.'
          )
        },
        { type: 'h2', text: text('The identity fields', 'فیلدهای شناسایی') },
        {
          type: 'terms',
          items: [
            { term: text('Address', 'نشانی'), text: text('A public identifier for one account or one contract; it identifies who or what, not a single event.', 'شناسهٔ عمومیِ یک حساب یا یک قرارداد؛ چه‌کس یا چه‌چیزی را مشخص می‌کند، نه یک رویدادِ تنها.') },
            { term: text('Transaction hash', 'هشِ تراکنش'), text: text('A unique fingerprint of one submitted transaction; pasting it finds that exact event.', 'اثرِ انگشتِ یکتای یک تراکنشِ ارسال؛ با چسباندنش همان رویدادِ مشخص را پیدا می‌کنی.') },
            { term: text('Block number', 'شمارهٔ بلاک'), text: text('The position in the chain where the transaction was included; larger means later.', 'جایگاهِ روی زنجیره که تراکنش در آن گنجانده شده؛ بزرگ‌تر یعنی دیرتر.') },
          ]
        },
        {
          type: 'p',
          text: text(
            'The first mistake readers make is treating an address and a hash as the same kind of thing. An address is a place - it holds a balance and a history and never changes ownership by itself. A transaction hash is an event - one signed instruction that the network accepted and ordered into a block. When someone says "check the transaction," they mean the hash; when they say "check the account," they mean the address. Reading the wrong one of the two will give you a page full of real numbers about the wrong subject.',
            'نخستین اشتباهِ خواننده‌ها این است که نشانی و هش را یک‌نوعِ چیز می‌گیرند. نشانی یک مکان است — موجودی و تاریخچه نگه می‌دارد و خودش به‌خودی‌خود مالکش عوض نمی‌شود. هشِ تراکنش یک رویداد است — یک دستورِ امضاشده که شبکه پذیرفتش و در یک بلاک مرتبش کرد. وقتی کسی می‌گوید «تراکنش را چک کن»، منظورش هش است؛ وقتی می‌گوید «حساب را چک کن»، منظورش نشانی. خواندنِ غلطِ این دو، صفحه‌ای پر از اعدادِ واقعی دربارهٔ موضوعِ غلط بهت می‌دهد.'
          )
        },
        { type: 'h2', text: text('Cost, order and result', 'هزینه، ترتیب و نتیجه') },
        {
          type: 'terms',
          items: [
            { term: text('Gas', 'gas'), text: text('The computational fee paid to run the transaction; the price and the amount consumed are two different numbers.', 'کارمزدِ محاسباتی که برای اجرای تراکنش پرداخت می‌شود؛ قیمت و مقدارِ مصرفی دو عددِ جدا هستند.') },
            { term: text('Nonce', 'nonce'), text: text('A counter of how many transactions the sending account has already submitted; it fixes their order and prevents replays.', 'شمارندهٔ تعدادِ تراکنش‌هایی که حسابِ فرستنده تاکنون ارسال کرده؛ ترتیبشان را تثبیت می‌کند و از پخشِ مجدد جلوگیری می‌کند.') },
            { term: text('Status', 'وضعیت'), text: text('Whether the network executed the transaction successfully or reverted it; a failed transaction is still real and still cost gas.', 'اینکه شبکه تراکنش را موفق اجرا کرده یا برگردانده؛ تراکنشِ ناموفق همچنان واقعی است و همچنان gas مصرف کرده.') },
          ]
        },
        {
          type: 'ul',
          items: [
            text('Value: the amount of the chain native currency moved by the transaction - reading it needs the unit, or a number looks larger or smaller by orders of magnitude.', 'مقدار: میزانِ ارزِ بومیِ زنجیره که تراکنش منتقل کرده — خواندنش واحد می‌خواهد، وگرنه عددی چند مرتبه بزرگ‌تر یا کوچک‌تر به نظر می‌رسد.'),
            text('Input data: the encoded instruction sent to a contract; for a simple transfer it is empty, and its presence means the call ran program logic, not just moved coins.', 'دادهٔ ورودی: دستورِ رمزبندی‌شده‌ای که به یک قرارداد رفته؛ در انتقالِ ساده خالی است و دیدنش یعنی فراخوان منطقِ برنامه را اجرا کرده نه فقط سکه جابه‌جا کرده.'),
            text('Timestamp: when the block was produced, which lets you line the on-chain event up against a UI or a report - but chain time and the clock you read the news on are not the same thing.', 'برچسبِ زمان: لحظهٔ تولیدِ بلاک که رویدادِ آن‌چین را با یک رابط یا گزارش هم‌تراز می‌کند — اما زمانِ زنجیره با ساعتی که خبر را در آن می‌خوانی یکی نیست.'),
          ]
        },
        { type: 'h2', text: text('Confirmations are not the same as finality', 'تأییدها همان قطعیت نیستند') },
        { type: 'formula', expr: 'confirmations = current_block_number - transaction_block_number + 1', text: text('Every new block mined on top of the transaction raises this count, so a transaction is never simply "done" - it becomes progressively harder to undo.', 'هر بلاکِ تازه‌ای که روی تراکنش اضافه می‌شود این شمار را بالا می‌برد، پس تراکنش هیچ‌وقت صرفاً «انجام‌شده» نیست — به‌تدریج برگرداندنش سخت‌تر می‌شود.') },
        {
          type: 'p',
          text: text(
            'Confirmation count and finality are different ideas that get conflated constantly. The count just tells you how many blocks now sit above yours, which is a measure of how much work would be needed to rewrite that part of the chain. Finality is a threshold on that work: past it, the community treats the block as irreversible. That threshold is a property of the specific chain and can change, so a page that shows "12 confirmations" is reporting a fact, while the decision to call the transaction settled is yours to make against that chain\'s rules.',
            'شمارشِ تأیید و قطعیت دو ایدهٔ متفاوت‌اند که مدام با هم خلط می‌شوند. شمارش فقط می‌گوید حالا چند بلاک بالای سرِ تو نشسته، که سنجهٔ این است که برای بازنویسی آن بخشِ زنجیره چه اندازه کار لازم است. قطعیت یک آستانه روی همان کار است: پس از آن، جامعه بلاک را برگشت‌ناپذیر می‌شمارد. آن آستانه ویژگیِ همان زنجیره است و می‌تواند عوض شود، پس صفحه‌ای که «۱۲ تأیید» نشان می‌دهد یک واقعیت را گزارش می‌کند، اما تصمیمِ اینکه تراکنش را قطعی بخوانی بر پایهٔ قواعدِ همان زنجیره کارِ توست.'
          )
        },
        {
          type: 'note',
          text: text(
            'Verify independently, and read what Openfund does not claim. Any explorer is one operator\'s index of the chain, so cross-check a hash on a second source - or a node you run yourself - before relying on it. In this path, the only chain you can actually inspect is the public data of the venue whose feed Openfund displays, the Gains Network deployment on Arbitrum One; the Openfund Perpetual Trading surface is read-only and does not execute orders on-chain in this release. That is verification of someone else\'s settlement layer, not evidence that Openfund settles on-chain, holds funds or runs proof of reserves - it claims none of those.',
            'مستقل راستی‌آزمایی کن و آنچه اوپن‌فاند ادعا نمی‌کند را بخوان. هر explorer نمایهٔ زنجیره از نگاهِ یک اپراتور است، پس پیش از اتکا، هش را روی مبدأِ دوم — یا گره‌ای که خودت اجرا می‌کنی — چک کن. در این مسیر تنها زنجیره‌ای که واقعاً می‌توانی ببینی دادهٔ عمومیِ همان بازاری است که اوپن‌فاند خوراکش را نشان می‌دهد، یعنی استقرارِ Gains Network روی Arbitrum One؛ نمایِ معاملاتِ دائمِ اوپن‌فاند فقط‌خواندنی است و در این نسخه سفارش را آن‌چین اجرا نمی‌کند. این راستی‌آزماییِ لایهٔ تسویهٔ کسی دیگر است، نه نشانهٔ اینکه اوپن‌فاند آن‌چین تسویه می‌کند، سرمایه نگه می‌دارد یا اثباتِ ذخایر دارد — و چنین ادعایی ندارد.'
          )
        },
      ]
    },
    {
      slug: 'proof-of-reserves-explained',
      path: 'on-chain-transparency',
      sort: 2,
      minutes: 10,
      status: 'published',
      title: text('Proof of reserves: what it actually proves', 'اثبات ذخایر: واقعاً چه چیزی را اثبات می‌کند'),
      summary: text(
        'A proof of reserves is a snapshot that can genuinely show addresses held assets at one instant, and it is far weaker than the promise in its name - this lesson pins down exactly what is and is not on the other side of that line.',
        'اثباتِ ذخایر snapshotی است که می‌تواند صادقانه نشان دهد یک دسته نشانی در یک لحظه دارایی داشته‌اند، و بسیار ضعیف‌تر از وعده‌ای است که در نامش هست — این درس دقیقاً مشخص می‌کند آن سوی این خط چه هست و چه نیست.'
      ),
      takeaways: [
        text('A proof of reserves demonstrates that a set of addresses controlled a balance at a moment in time - it is a snapshot of one side of the balance sheet, not an ongoing guarantee', 'اثباتِ ذخایر نشان می‌دهد دسته‌ای نشانی در یک لحظه مقدارِ موجودی را در کنترل داشتند — snapshotی از یک طرفِ ترازنامه است، نه تضمینِ پیوسته'),
        text('It does not prove liabilities, so covering assets on the left of the sheet says nothing about what the same firm owes on the right; a fully-backed asset line can still sit above insolvency', 'بدهی‌ها را ثابت نمی‌کند، پس پوششِ دارایی در سمتِ چپِ ترازنامه هیچ نمی‌گوید دربارهٔ اینکه همان شرکت در سمتِ راست بدهکارِ چیست؛ یک خطِ داراییِ کامل‌پشتیبان می‌تواند همچنان بالای یک ورشکستگی نشسته باشد'),
        text('Signed attestations and Merkle-tree proofs make the published data checkable, but the party that chooses what to include still controls the scope - verifiable is not the same as honest', 'گواهی‌های امضاشده و اثبات‌های درختِ Merkle دادهٔ منتشرشده را قابل‌بررسی می‌کنند، اما همان طرفی که فهرستِ مشمولات را می‌چیند دامنه را در کنترل دارد — قابل‌راستی‌آزمایی بودن با صادق بودن یکی نیست'),
        text('Custody arrangements live off-chain: who legally holds the assets and under what obligation is a matter of contracts and law that no on-chain snapshot can show', 'ترتیب‌های امانت برون‌زنجیره‌ای‌اند: که کی به‌طورِ قانونی دارایی را نگه می‌دارد و تحتِ چه تعهدی، مسئلهٔ قراردادها و قانون است که هیچ snapshotِ آن‌چین نشان نمی‌دهد'),
      ],
      glossary: ['proof-of-reserves'],
      tools: ['perp-pnl'],
      blocks: [
        {
          type: 'p',
          text: text(
            'The phrase "proof of reserves" carries more weight than the technique can hold. In its honest form it is a demonstration that a set of addresses a firm claims to control actually held some balance at a specific moment. That is a real and useful fact - it is also a very narrow one. Most of the confusion around the idea comes from reading the word "proof" as proof of solvency, or proof that customers could be paid, when all that was ever demonstrated is possession of assets at a point in time.',
            'عبارت «اثباتِ ذخایر» وزنی بیشتر از آن‌چهار‌چیزی که این روش تحمل می‌کند به دوش می‌کشد. در شکلِ صادقِ خودش، نشان می‌دهد که دسته‌ای نشانی که یک شرکت مدعیِ کنترلشان است، در یک لحظهٔ مشخص واقعاً مقدارِ موجودیِ معینی را در اختیار داشته‌اند. این واقعیتی واقعی و سودمند است — و همچنین بسیار باریک. بیشترِ سردرگمیِ پیرامونِ این ایده از آن می‌آید که کلمهٔ «اثبات» را اثباتِ توانِ مالی می‌خوانند، یا اثباتِ اینکه طلبِ مشتریان داده می‌شود، در حالی که چیزی که هرگز ثابت شده همان تصاحبِ دارایی در یک نقطهٔ زمانی است.'
          )
        },
        { type: 'h2', text: text('The one thing a snapshot can show', 'تنها چیزی که یک snapshot می‌تواند نشان دهد') },
        {
          type: 'p',
          text: text(
            'A credible reserves report is built so that an outsider can re-check it rather than take it on faith. The usual mechanism signs a message from the addresses themselves, or publishes a Merkle tree whose leaves are individual balances and whose published root lets each holder confirm their own line without seeing anyone else\'s. Both designs answer the same question - can you independently confirm that these assets exist at these addresses - and both stop there. Nothing in the mechanism compels the publisher to reveal every address it controls, or anything it does not control on-chain.',
            'گزارشِ ذخایرِ باورپذور چنان ساخته می‌شود که یک بیرون‌مرزی بتواند به‌جای ایم‌آوردن دوباره بازش بکند. سازوکارِ معمول یا از خودِ نشانی‌ها پیامی را امضا می‌کند، یا درختِ Merkleای را منتشر می‌کند که برگ‌هایش موجودیِ تک‌تکِ دارندگان است و ریشهٔ منتشرشده‌اش اجازه می‌دهد هر دارنده خطِ خودش را بدونِ دیدنِ بقیه تأیید کند. هر دو طرح به یک سؤال پاسخ می‌دهند — می‌توانی مستقل تأیید کنی که این دارایی‌ها در این نشانی‌ها وجود دارند — و همان‌جا می‌ایستاند. هیچ‌چیزِ این سازوکار ناشر را وادار نمی‌کند همهٔ نشانی‌هایی که کنترل می‌کند را افشا کند، یا هر آنچه را آن‌چین کنترل نمی‌کند.'
          )
        },
        {
          type: 'table',
          caption: text('Either side of the reserves line', 'دو طرفِ خطِ ذخایر'),
          head: [text('What a proof of reserves can show', 'آنچه اثباتِ ذخایر می‌تواند نشان دهد'), text('What it cannot show', 'آنچه نمی‌تواند نشان دهد')],
          rows: [
            [text('That claimed addresses held a balance at one instant', 'که نشانی‌هایِ ادعاشده در یک لحظه مقدارِ موجودی داشته‌اند'), text('That the firm owes no more than it holds (liabilities)', 'که شرکت بیشتر از آنچه دارد بدهکار نیست (بدهی‌ها)')],
            [text('An on-chain asset snapshot, checkable by outsiders', 'snapshot داراییِ آن‌چین، قابلِ بررسیِ بیرونی'), text('Custody contracts, legal claims, freezes or off-chain debt', 'قراردادهای امانت، مطالباتِ قانونی، مسدودی یا بدهیِ برون‌زنجیره‌ای')],
            [text('One balance as of the publish date', 'یک موجودی تا تاریخِ انتشار'), text('Real-time control, or that the balance was not borrowed for the photo', 'کنترلِ بلادرنگ، یا اینکه موجودی برای عکس وام گرفته نشده بود')],
          ]
        },
        { type: 'h2', text: text('Why assets can be shown and solvency still missed', 'چرا دارایی دیده می‌شود و توانِ مالی باز هم رد می‌شود') },
        {
          type: 'ul',
          items: [
            text('The right-hand side of the ledger: reserves reports typically cover assets only, so without a matching proof of liabilities you are reading half a balance sheet and calling it the whole one.', 'سمتِ راستِ دفتر: گزارش‌های ذخایر معمولاً فقط دارایی را در بر می‌گیرند، پس بدونِ اثباتِ بدهیِ هم‌تراز، نیمی از ترازنامه را می‌خوانی و کلِ آن می‌خوانی.'),
            text('Borrowed-in balance: an address can be funded for the instant of the snapshot and returned immediately after; a single frozen picture cannot see that round trip.', 'موجودیِ وام‌گرفته‌شده: یک نشانی می‌تواند لحظه‌ای که snapshot گرفته می‌شود شارژ شود و بی‌درنگ بعد پس داده شود؛ یک تصویرِ ثابتِ تنها این رفت‌وبرگشت را نمی‌بیند.'),
            text('Selective scope: the publisher chooses which addresses are in the list, so excluded accounts, side entities or off-chain obligations simply are not in the tree to check.', 'دامنهٔ گزینشی: ناشر انتخاب می‌کند کدام نشانی‌ها در فهرست‌اند، پس حساب‌های کنارگذاشته‌شده، نهادهای جانبی یا تعهداتِ برون‌زنجیره‌ای اصلاً در درخت نیستند که بررسی شوند.'),
          ]
        },
        {
          type: 'terms',
          items: [
            { term: text('Proof of reserves', 'اثباتِ ذخایر'), text: text('A checkable demonstration that claimed addresses held assets at a point in time.', 'نمایشِ قابل‌بررسیِ اینکه نشانی‌هایِ ادعاشده در یک نقطهٔ زمانی دارایی داشته‌اند.') },
            { term: text('Merkle root', 'ریشهٔ Merkle'), text: text('One hash summarising a whole tree of balances, so each leaf can be proved without publishing them all.', 'یک هش که کلِ درختِ موجودی‌ها را خلاصه می‌کند، تا هر برگ بدونِ انتشارِ همه قابلِ اثبات باشد.') },
            { term: text('Self-custody', 'خودامانتداری'), text: text('The holder controls the keys directly; a custodial arrangement places control with a third party no snapshot can describe.', 'دارنده کلیدها را مستقیم کنترل می‌کند؛ ترتیبِ امانت‌محور کنترل را به ثالثی می‌دهد که هیچ snapshot نمی‌تواندش توصیف کند.') },
          ]
        },
        { type: 'h3', text: text('What to ask of a reserves report', 'از گزارشِ ذخایر چه بپرسیم') },
        {
          type: 'p',
          text: text(
            'None of this makes a proof of reserves worthless - a well-built one is far better than a bare assertion, because it lets outsiders check the asset claim instead of trusting it. It only relocates what the guarantee depends on. Once you notice that the mechanism is honest about one narrow thing and silent about everything else, you stop asking it questions it was never designed to answer, and start asking who signed the report, what scope they chose and how old the snapshot is.',
            'هیچ‌یک از این‌ها اثباتِ ذخایر را بی‌ارزش نمی‌کند — یک نسخهٔ خوب‌ساخته بسیار بهتر از یک ادعایِ خام است، چون به بیرون‌مرزی‌ها اجازه می‌دهد ادعای دارایی را چک کنند نه اینکه بهش اعتماد کنند. فقط جایی که تضمین بهش تکیه دارد را عوض می‌کند. لحظه‌ای که توجه کنی سازوکار دربارهٔ یک چیزِ باریک صادق است و دربارهٔ بقیه ساکت، دیگر از آن سؤالاتی نمی‌پرسی که هیچ‌وقت برایش طراحی نشده، و شروع می‌کنی به پرسیدن اینکه چه کسی گزارش را امضا کرده، چه دامنه‌ای را انتخاب کرده و snapshotش چقدر کهنه است.'
          )
        },
        {
          type: 'note',
          text: text(
            'Openfund makes no reserves claim at all. It has no proof of reserves, no published vault, no on-chain settlement and no customer-fund custody today, and it does not present itself as holding any of these - the honest statement is not that its reserves are verified, it is that there are no customer funds to verify reserves against while the perpetual view is read-only and the demo runs on virtual DAI. Any reserves figure on the Transparency page is clearly labelled sample data, not production reporting, and the repository\'s Transparency rendering demonstrates a future interface, not a current balance.',
            'اوپن‌فاند هیچ ادعایِ ذخیره‌ای ندارد. امروز نه اثباتِ ذخایر دارد، نه خزانهٔ منتشرشده، نه تسویهٔ آن‌چین و نه نگهداریِ سرمایهٔ مشتری — و خودش را دارندهٔ هیچ‌کدام معرفی نمی‌کند؛ بیانِ صادق این نیست که ذخایرش راستی‌آزمایی شده، این است که تا وقتی نمایِ دائمی فقط‌خواندنی است و دمو روی دایِ مجازی می‌گردد، سرمایهٔ مشتری‌ای نیست که ذخایر برایش راستی‌آزمایی شود. هر عددِ ذخیره‌ای در صفحهٔ شفافیت صریحاً دادهٔ نمونه برچسب‌خورده است، نه گزارشِ عملیاتی، و رندرِ شفافیتِ مخزن رابطِ آینده را نمایش می‌دهد نه موجودیِ جاری را.'
          )
        },
      ]
    },
    {
      slug: 'verifying-a-transaction',
      path: 'on-chain-transparency',
      sort: 3,
      minutes: 8,
      status: 'published',
      title: text('Verifying a transaction from start to finish', 'راستی‌آزمایی یک تراکنش، از ابتدا تا انتها'),
      summary: text(
        'Verifying one transaction is a short, repeatable procedure - take the hash, read the fields, then confirm the same hash on a second independent source before believing the story wrapped around it.',
        'راستی‌آزمایی یک تراکنش روشی کوتاه و تکرارپذیر است — هش را بردار، فیلدها را بخوان، سپس همان هش را روی مبدأِ مستقلِ دومی تأیید کن پیش از آنکه داستانی که دورش پیچیده‌اند را باوری.'
      ),
      takeaways: [
        text('Start from the transaction hash, not the narrative - the hash is the one identifier that pins a specific event to the public ledger', 'از هشِ تراکنش شروع کن، نه از روایت — هش تنها شناسه‌ای است که یک رویدادِ مشخص را به دفترِ کلِ عمومی میخکوب می‌کند'),
        text('Read the fields in order - address, value, status, block, gas and nonce - before you accept any description of what the transaction "was for"', 'فیلدها را به ترتیب بخوان — نشانی، مقدار، وضعیت، بلاک، gas و nonce — پیش از پذیرفتنِ هر توصیفی از اینکه تراکنش «به چه منظور» بوده'),
        text('A single explorer is not the arbiter: the same hash should appear on a second independent source with the same block and status before you treat it as settled', 'یک explorer داور نیست: همان هش باید با همان بلاک و وضعیت روی مبدأِ مستقلِ دومی دیده شود تا بتوانی قطعی‌اش بخوانی'),
        text('Some things have no hash to verify - a simulated demo trade is an application record, not a chain event, and presenting it as a verifiable transaction would be false', 'برخی چیزها هشِ قابل‌راستی‌آزمایی ندارند — یک معاملهٔ دموی شبیه‌سازی‌شده سابقهٔ برنامه است نه رویدادِ زنجیره، و معرفی‌اش به‌عنوان تراکنشِ راستی‌آزمایی‌پذیر دروغ است'),
      ],
      glossary: ['block-explorer'],
      tools: ['perp-pnl', 'liquidation-price'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Verification is not a feeling of confidence you get after reading a long receipt. It is a short procedure you can run yourself in a couple of minutes, and the discipline of running it - especially when the narrative is flattering - is the whole point. The procedure assumes nothing about who gave you the hash; it starts from that string and ends at an independent confirmation, with a checklist in between. The moment you can describe it as a sequence of actions rather than a mood, you have left marketing behind.',
            'راستی‌آزمایی آن حسِ اطمینان نیست که پس از خواندن فیشی بلند بهت دست می‌دهد. یک روشِ کوتاه است که خودت در چند دقیقه می‌توانی اجرایش کنی، و نظمِ اجرای آن — مخصوصاً وقتی روایت چاپلوسانه است — تمامِ ماجراست. این روش دربارهٔ اینکه چه کسی هش را بهت داده هیچ فرضی نمی‌کند؛ از همان رشته شروع می‌شود و به تأییدِ مستقلی می‌رسد و میانش یک چک‌لیست هست. لحظه‌ای که بتوانی‌اش زنجیره‌ای از کنش‌ها توصیف کنی نه یک حال، بازاریابی را پشتِ سر گذاشته‌ای.'
          )
        },
        { type: 'h2', text: text('The procedure, in order', 'روش، به ترتیب') },
        {
          type: 'ol',
          items: [
            text('Take the transaction hash from the source and paste it into a block explorer for that network - a generic, public explorer, not the one that also narrates the story.', 'هشِ تراکنش را از مبدأ بردار و در explorer بلاکِ همان شبکه بچسبان — یک explorerِ عمومی و معمولی، نه همان که خودش روایت را هم می‌گوید.'),
            text('Confirm the sending and receiving addresses match what you were told they should be, character for character.', 'تأیید کن نشانی‌های فرستنده و گیرنده با آنچه گفته شد مطابق‌اند، حرف‌به‌حرف.'),
            text('Read the value with its unit, the status (success or revert), the block number and the nonce - the facts, before the explanation.', 'مقدار را با واحدش، وضعیت (موفق یا برگشت)، شمارهٔ بلاک و nonce را بخوان — واقعیت‌ها را پیش از توضیح.'),
            text('Wait until the confirmation count has passed that chain\'s comfort threshold, and remember it is finality that matters, not the raw number.', 'صبر کن تا شمارشِ تأیید از آستانهٔ راحتیِ همان زنجیره بگذرد، و به یاد داشته باش قطعیت اهمیت دارد نه عددِ خام.'),
          ]
        },
        {
          type: 'terms',
          items: [
            { term: text('Confirmation count', 'شمارشِ تأیید'), text: text('How many blocks now sit above the transaction\'s block; more work is needed to undo it as this grows.', 'اینکه حالا چند بلاک بالای بلاکِ تراکنش نشسته؛ با بزرگ‌تر شدنش کارِ بیشتری برای برگرداندنش لازم است.') },
            { term: text('Finality', 'قطعیت'), text: text('The point, defined by the chain, past which the transaction is treated as irreversible.', 'نقطه‌ای که زنجیره تعریف می‌کند و پس از آن تراکنش برگشت‌ناپذیر شمرده می‌شود.') },
            { term: text('Revert', 'برگشت'), text: text('A transaction that ran and failed: it is on-chain and cost gas, yet moved nothing the narrative claims.', 'تراکنشی که اجرا و ناموفق شد: روی زنجیره است و gas برداشت، اما چیزی را که روایت می‌گوید منتقل نکرد.') },
          ]
        },
        { type: 'h2', text: text('One source is never enough', 'یک مبدأ هیچ‌وقت کافی نیست') },
        {
          type: 'p',
          text: text(
            'A block explorer reports from its own index of the chain, and that index can be stale, can mis-render a value, or can be an operator\'s copy rather than the ground truth. The fix is cheap and mechanical: paste the same hash into a second, independent explorer for the same network, or query a node directly, and confirm the block number and status agree. Two unrelated sources landing on the same answer is what turns "the page says" into "the chain says." A single confident screenshot, by contrast, remains exactly what it is - one opinion rendered as an image.',
            'explorer بلاک از نمایهٔ خودشِ زنجیره گزارش می‌دهد، و آن نمایه می‌تواند کهنه باشد، مقداری را غلط رندر کند، یا نسخه‌ای از یک اپراتور باشد نه حقیقتِ زمینه. راه‌حل ارزان و مکانیکی است: همان هش را در explorerِ دومِ مستقلِ همان شبکه بچسبان، یا مستقیم از گره بپرس، و تأیید کن شمارهٔ بلاک و وضعیت یکی‌اند. دو مبدأِ بی‌ربط که به پاسخِ واحدی برسند همان چیزی است که «صفحه می‌گوید» را به «زنجیره می‌گوید» بدل می‌کند. در برابرش، یک اسکرین‌شاتِ بااطمینانِ تنها دقیقاً همان چیزی می‌ماند که هست — یک نظر رندرشده به‌شکلِ تصویر.'
          )
        },
        { type: 'formula', expr: 'confirmations = current_block_number - transaction_block_number + 1', text: text('Recompute the count on your own from the two block numbers rather than trusting the badge drawn next to it.', 'شمار را خودت از همان دو شمارهٔ بلاک دوباره حساب کن، نه اینکه به نشانِ کنارش اعتماد کنی.') },
        { type: 'h2', text: text('Interpretation is not verification', 'تفسیر، راستی‌آزمایی نیست') },
        {
          type: 'p',
          text: text(
            'The last step is the one people skip: separating the confirmed on-chain facts from the story attached to them. The ledger can confirm that value moved from address A to address B at block N - it cannot confirm that the transaction represents a payment, a settlement, a customer balance or a promise. Those meanings are added around the data by whatever report or UI handed you the hash. Verification ends at the chain; interpretation beyond it is a claim to be checked against other evidence, not a fact the explorer owes you.',
            'آخرین گام همان چیزی است که مردم رد می‌کنند: جداساختنِ واقعیاتِ تأییدشدهٔ آن‌چین از داستانی که به آن‌ها چسبانده شده. دفتر می‌تواند تأیید کند که مقداری از نشانی A به نشانی B در بلاک N جابه‌جا شد — نمی‌تواند تأیید کند که تراکنش نمایندهٔ یک پرداخت، یک تسویه، یک موجودیِ مشتری یا یک وعده است. آن معناها را هر گزارش یا رابطی که هش را بهت داد دورِ داده می‌چیند. راستی‌آزمایی در زنجیره تمام می‌شود؛ تفسیرِ فراتر از آن ادعایی است که باید با شواهدِ دیگر سنجیده شود، نه واقعیتی که explorer بهت بدهکار باشد.'
          )
        },
        {
          type: 'note',
          text: text(
            'Not everything you are asked to verify has a transaction. Openfund\'s Prop Trading demo is a server-side simulation: a completed demo trade is an application record priced from live mark prices, not a chain event, and there is no hash to look it up. The perpetual view reads public data of the Gains Network deployment on Arbitrum One, and that - the venue\'s own settlement - is the only thing here you can verify on-chain; the Openfund surface is read-only and executes nothing on-chain in this release. Treating a demo fill or a UI number as a verifiable transaction would be exactly the error this lesson warns against, and Openfund makes no claim that its records are on-chain proofs.',
            'هر آنچه ازت می‌خواهند راستی‌آزمایی کنی تراکنش ندارد. دموی چلنجیِ اوپن‌فاند یک شبیه‌سازیِ سمتِ سرور است: یک معاملهٔ دموی انجام‌شده سابقهٔ برنامه است که از قیمتِ مرجعِ زنده قیمت‌گذاری شده، نه رویدادِ زنجیره، و هشی برای جستجویش نیست. نمایِ دائمی دادهٔ عمومیِ استقرارِ Gains Network روی Arbitrum One را می‌خواند، و همان — تسویهٔ خودِ بازار — تنها چیزی است که اینجا می‌توانی آن‌چین راستی‌آزمایی کنی؛ نمایِ اوپن‌فاند فقط‌خواندنی است و در این نسخه هیچ‌چیز را آن‌چین اجرا نمی‌کند. معاملهٔ دمو یا عددِ رابط را به‌عنوان تراکنشِ راستی‌آزمایی‌پذیر دیدن، دقیقاً همان خطایی است که این درس هشدارش می‌دهد، و اوپن‌فاند ادعا نمی‌کند سوابقش اثباتِ آن‌چین‌اند.'
          )
        },
      ]
    },
    {
      slug: 'smart-contracts-and-the-terminal',
      path: 'on-chain-transparency',
      sort: 4,
      minutes: 10,
      status: 'published',
      title: text('Smart contracts and what a terminal does not show you', 'قراردادهای هوشمند و آنچه ترمینال نشان نمی‌دهد'),
      summary: text(
        'A polished trading screen can be a perfectly honest view of public data while sitting on logic you cannot see - this lesson is about reading the contract behind the interface and knowing what "verified" and "upgradable" mean.',
        'یک صفحهٔ معاملاتیِ شیک می‌تواند دیدی کاملاً صادق به دادهٔ عمومی باشد در حالی که روی منطقِ ندیدنیِ تو نشسته — این درس دربارهٔ خواندنِ قراردادِ پشتِ رابط و معناِ «تأییدشده» و «قابل ارتقا» است.'
      ),
      takeaways: [
        text('A contract address names a program on the chain; the verified source is the only way to read what it does instead of guessing from how it behaved', 'نشانیِ قرارداد یک برنامه روی زنجیره را نام می‌برد؛ سورسِ تأییدشده تنها راهِ خواندنِ کارکردش است به‌جای حدس‌زدن از رفتارِ آن'),
        text('Verified does not mean safe - verification only proves the published source matches the deployed bytecode at that address, nothing more', 'تأییدشده یعنی امن نه — تأیید فقط ثابت می‌کند سورسِ منتشرشده با بایت‌کدِ مستقرشده در آن نشانی می‌خواند، نه بیشتر'),
        text('A proxy or upgradable contract lets the logic behind an address change later, so what you read today is not guaranteed to be what runs tomorrow', 'یک قراردادِ نیابتی یا قابل‌ارتقا اجازه می‌دهد منطقِ پشتِ یک نشانی بعداً عوض شود، پس آنچه امروز می‌خوانی تضمینی نیست که فردا هم همان اجرا شود'),
        text('A UI can be truthful about its data source while the venue that actually settles is elsewhere - Openfund\'s perpetual view reads public Gains Network data on Arbitrum One but performs no on-chain execution', 'یک رابط می‌تواند دربارهٔ مبدأِ داده‌اش صادق باشد در حالی که بازاری که واقعاً تسویه می‌کند جای دیگری است — نمایِ دائمِ اوپن‌فاند دادهٔ عمومیِ Gains Network روی Arbitrum One را می‌خواند اما هیچ اجرایِ آن‌چین انجام نمی‌دهد'),
      ],
      glossary: ['smart-contract', 'mark-price'],
      tools: ['leverage-margin', 'liquidation-price'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A terminal is a picture of a state, not the state itself. The numbers on the screen are produced by code - a smart contract at an address - and a clean interface can describe that code faithfully while still hiding it from you. Transparency at this layer is not about pretty charts; it is whether you can reach the actual program that decides your balance.',
            'ترمینال تصویری از یک وضعیت است نه خودِ وضعیت. عددهای روی صفحه را کد تولید می‌کند — قراردادی هوشمند روی یک نشانی — و یک رابطِ تمیز می‌تواند آن کد را امینانه توصیف کند و با این‌همه تو را از دیدنش محروم بدارد. شفافیت در این لایه دربارهٔ نمودارهای زیبا نیست؛ اینکه آیا می‌توانی به همان برنامهٔ واقعی که موجودی‌ات را تعیین می‌کند برسی.'
          )
        },
        { type: 'h2', text: text('Address, bytecode and verified source', 'نشانی، بایت‌کد و سورسِ تأییدشده') },
        {
          type: 'terms',
          items: [
            { term: text('Smart contract', 'قراردادِ هوشمند'), text: text('Program code deployed at an address on the chain that executes when called.', 'کدِ برنامه‌ای که روی نشانیِ زنجیره مستقر شده و هنگام فراخوان اجرا می‌شود.') },
            { term: text('Verified source', 'سورسِ تأییدشده'), text: text('Published human-readable code whose hash matches the deployed bytecode, so behaviour can be read rather than inferred.', 'کدِ منتشرشدهٔ قابل‌خواندنِ آدم که هزش با بایت‌کدِ مستقر می‌خواند، پس رفتار را می‌توان خواند نه استنتاج.') },
            { term: text('Proxy contract', 'قراردادِ نیابتی'), text: text('A thin address that forwards calls to separate logic, so the code behind it can be replaced without changing the address.', 'نشانیِ باریکی که فراخوان‌ها را به منطقِ جدا می‌فرستد، پس کدِ پشتش بدونِ عوض کردنِ نشانی قابلِ جایگزینی است.') },
          ]
        },
        {
          type: 'p',
          text: text(
            'Verification is worth understanding precisely because it is narrower than it sounds. When an explorer marks a contract "verified," someone has published source code whose compiled bytecode matches what is deployed at that address. That is a real service: it lets you read the logic instead of guessing from transactions. But it says nothing about whether the logic is honest, reviewed, or will stay unchanged. A verified contract can contain a self-destruct, and an unverified one might be perfectly ordinary.',
            'ارزش دارد تأیید را دقیقاً به این دلیل بفهمی که باریک‌تر از آن است که به نظر می‌رسد. وقتی explorer قراردادی را «تأییدشده» علامت می‌زند، کسی سورسی منتشر کرده که بایت‌کدِ کامپایل‌شده‌اش با آنچه در آن نشانی مستقر است می‌خواند. این خدمتی واقعی است: بهت اجازه می‌دهد منطق را بخوانی به‌جای حدس از تراکنش‌ها. اما هیچ نمی‌گوید منطق صادق است، بررسی شده، یا دست‌نخورده می‌ماند. یک قراردادِ تأییدشده می‌تواند خودخوری‌ای در خودش داشته باشد، و یک قراردادِ تأییدنشده شاید کاملاً معمولی باشد.'
          )
        },
        { type: 'h3', text: text('When the code behind an address can move', 'وقتی کدِ پشتِ یک نشانی می‌تواند جابه‌جا شود') },
        {
          type: 'p',
          text: text(
            'The upgradable pattern complicates trust further. A proxy address is stable and well-known, but it only forwards to separate implementation logic that can be swapped underneath it. This is genuinely useful - bugs can be patched and features added - yet it means reading the source at the proxy today does not guarantee the behaviour tomorrow. The question a careful reader shifts to is not "what does this address do" but "who can change what it does, and under what process?" That question often has no answer readable from the chain.',
            'الگوی قابل‌ارتقا اعتماد را پیچیده‌تر هم می‌کند. نشانیِ نیابتی پایدار و آشناست، اما فقط فراخوان‌ها را به منطقِ پیاده‌سازیِ جدا می‌فرستد که می‌توان زیرِ آنش عوضش کرد. این واقعاً سودمند است — باگ رفع و قابلیت افزوده می‌شود — با این حال یعنی خواندنِ سورِ پشتِ نیابتیِ امروز، رفتارِ فردا را تضمین نمی‌کند. سؤالی که خوانندهٔ دقیق بهش می‌رود این نیست که «این نشانی چه می‌کند» بلکه «چه کسی می‌تواند کارکردش را عوض کند، و در چه فرآیندی؟» و این سؤال پاسخی که از زنجیره خوانده شود معمولاً ندارد.'
          )
        },
        { type: 'h2', text: text('What the terminal leaves off', 'آنچه ترمینال کنار می‌گذارد') },
        {
          type: 'ul',
          items: [
            text('Order-book depth, open interest and the trade tape: a market-data feed may supply price marks while providing none of those, and an honest screen shows them as unavailable rather than estimated.', 'عمقِ دفترِ سفارش، بهرهٔ باز و نوارِ معامله: خوراکِ بازار ممکن است مارکِ قیمت بدهد ولی هیچ‌یک از آن‌ها را نه، و صفحهٔ صادق آن‌ها را «دست‌نیافتنی» نشان می‌دهد نه تخمین‌خورده.'),
            text('The oracle or index behind a mark price: liquidations and balances are computed from a price the terminal displays but whose source and update rule the screen does not explain.', 'اوراکل یا شاخصِ پشتِ یک قیمتِ مرجع: لیکوییدشدن‌ها و موجودی‌ها از قیمتی محاسبه می‌شوند که ترمینال نشان می‌دهد ولی مبدأ و قاعدهٔ به‌روزرسانی‌اش را صفحه توضیح نمی‌دهد.'),
            text('Who actually settles: a view of another venue\'s on-chain state is not itself settlement, and the venue that finalises the trade may sit entirely outside what the interface renders.', 'که کی واقعاً تسویه می‌کند: نمایشِ وضعیتِ آن‌چینِ بازاری دیگر خودش تسویه نیست، و بازاری که معامله را نهایی می‌کند شاید کاملاً بیرونِ آنچه رابط رندر می‌کند باشد.'),
          ]
        },
        {
          type: 'p',
          text: text(
            'Reading an audit report is the same discipline as reading the contract. An audit is a dated opinion scoped to a version or commit, so the useful questions are what was in scope, which commit it examined and which findings were left unresolved. A single PDF with a firm\'s logo is not a guarantee - it attests only that, at one moment and for a slice of code, reviewers found no certain exploit. Everything the report never saw is as risky as it was.',
            'خواندنِ گزارشِ حسابرسی همان نظمِ خودِ خواندنِ قرارداد است. حسابرسی نظری تاریخ‌دار است که به یک نسخه یا commit دامنه داده شده، پس سؤالاتِ کاربردی این‌ها‌اند که چه چیزی در دامنه بود، کدام commit بررسی شد و کدام یافته‌ها حل‌نشده ماندند. یک PDF با لوگوی یک شرکت تضمین نیست — تنها گواهی می‌دهد که در یک لحظه و برای بریدنی از کد، بازبینان exploitِ قطعی نیافتند. هر آنچه گزارش هرگز ندیده همان‌قدر پُرخطر باقی می‌ماند که بود.'
          )
        },
        {
          type: 'note',
          text: text(
            'Openfund is an example of exactly this split, said plainly. Its Perpetual Trading surface reads the public data of the Gains Network deployment on Arbitrum One and is read-only: on-chain order execution is not enabled in this release and Gains transaction execution is deliberately disabled by project policy until testnet contracts, simulation and validation exist. Inside the repository, the openfund-protocol module is a dormant, imported third-party contract foundation (upstream MUX, GPL-2.0) kept for study - not compiled at its imported HEAD, not deployed, not used by the app and not Openfund\'s live settlement layer. The Certik report shipped inside it is an upstream document about that third-party code, not an audit of Openfund, which has no independent security audit yet. None of this means the perpetual view is dishonest about its source - it is honest about reading Gains data - but honest data displayed is not the same as Openfund itself being on-chain-settled, and it is not.',
            'اوپن‌فاند نمونهٔ دقیقاً همین تفکیک است، صریح گفته‌شده. نمایِ معاملاتِ دائمِ اوپن‌فاند دادهٔ عمومیِ استقرارِ Gains Network روی Arbitrum One را می‌خواند و فقط‌خواندنی است: اجرایِ سفارشِ آن‌چین در این نسخه فعال نیست و اجرایِ تراکنشِ Gains به‌قصدِ سیاستِ پروژه تا یافتنِ قراردادهای testnet، شبیه‌سازی و راستی‌آزمایی غیرفعال نگه داشته شده. درونِ مخزن، مدولِ openfund-protocol یک زیرساختِ قراردادیِ ثالثِ وارداتی و خاموش (MUXِ بالادستی، GPL-2.0) است که برای مطالعه نگه داشته شده — در HEADِ وارداتی‌اش کامپایل نشده، مستقر نشده، توسط برنامه استفاده نمی‌شود و لایهٔ تسویهٔ زندهٔ اوپن‌فاند نیست. گزارش Certikِ داخلِ آن سندِ بالادستی دربارهٔ همان کدِ ثالث است، نه حسابرسیِ خودِ اوپن‌فاند که هنوز هیچ حسابرسیِ مستقلِ امنیتی ندارد. هیچ‌یک از این‌ها به این معنا نیست که نمایِ دائمی دربارهٔ مبدأِ داده‌اش ناکروست — در خواندنِ دادهٔ Gains کروست — اما نمایشِ دادهٔ صادق همانِ آن‌چین‌تسویه‌بودنِ خودِ اوپن‌فاند نیست، و اوپن‌فاند چنین نیست.'
          )
        },
      ]
    },
    {
      slug: 'limits-of-onchain-transparency',
      path: 'on-chain-transparency',
      sort: 5,
      minutes: 9,
      status: 'published',
      title: text('The limits of on-chain transparency', 'مرزهای شفافیت درون‌زنجیره‌ای'),
      summary: text(
        'On-chain data is public and immutable, and people over-read both words: immutability is not completeness, and a public ledger that omits obligations, custody and the humans behind addresses is a partial truth told perfectly.',
        'دادهٔ درون‌زنجیره‌ای عمومی و تغییرناپذیر است و مردم هر دو کلمه را بیش از اندازه می‌خوانند: تغییرناپذیری کامل‌بودن نیست، و دفتری عمومی که تعهدات، امانت و آدم‌های پشتِ نشانی‌ها را کنار می‌گذارد حقیقتی ناسره است که بی‌نقص روایت شده.'
      ),
      takeaways: [
        text('Immutability guarantees that what was recorded cannot be edited later; it does not guarantee that anything relevant was left out of the recording in the first place', 'تغییرناپذیری تضمین می‌کند آنچه ثبت شده بعداً قابلِ ویرایش نیست؛ تضمین نمی‌کند که از همان اول چیزِ مرتبطی از ثبت کنار نگذاشته شده باشد'),
        text('An on-chain number is only as good as its input: mark prices and computed balances frequently depend on an oracle or index whose error flows straight into positions and liquidations', 'یک عددِ درون‌زنجیره‌ای فقط به اندازهٔ ورودی‌اش خوب است: قیمت‌هایِ مرجع و موجودی‌های محاسبه‌شده اغلب به اوراکل یا شاخصی وابسته‌اند که خطایشان بی‌واسطه به موقعیت‌ها و لیکوییدشدن‌ها سرازیر می‌شود'),
        text('The ledger records addresses, not people: it shows what an account did, never who controlled it, why, or what off-chain duties hang behind the balance', 'دفتر نشانی‌ها را ثبت می‌کند نه آدم‌ها: نشان می‌دهد یک حساب چه کرد، هرگز کی کنترلش می‌کرد یا چرا، و چه وظایفِ برون‌زنجیره‌ای‌ای پشتِ موجودی آویخته است'),
        text('Code-level transparency - an open repository and documentation - is real and checkable; financial transparency - reserves, audits, settlement - is a different claim, and Openfund has the first while making none of the second', 'شفافیتِ سطحِ کد — مخزن و مستنداتِ باز — واقعی و قابل‌بررسی است؛ شفافیتِ مالی — ذخایر، حسابرسی، تسویه — ادعایی جداست، و اوپن‌فاند اولی را دارد و دومی را هرگز ادعا نمی‌کند'),
      ],
      glossary: ['proof-of-reserves'],
      tools: ['funding-rate', 'perp-pnl'],
      blocks: [
        {
          type: 'p',
          text: text(
            'The strongest sentence in this field is also the most over-read: "the data is on-chain, so it cannot be tampered with." It is true, and far weaker than it feels. Immutability is a promise about the future of a record - once written, it will not be quietly rewritten. It says nothing about the completeness of the record, the accuracy of the inputs it was built from, or the honesty of whoever chose what to put on the chain. Transparency that lives entirely on-chain has real limits, and naming them is what keeps the term meaningful.',
            'قوی‌ترین جمله در این حوزه، بیش‌ازحدِخوانده‌شده‌ترین جمله هم هست: «داده روی زنجیره است، پس دستکاری‌ناپذیر است.» راست است، و بسیار ضعیف‌تر از آن است که حس می‌شود. تغییرناپذیری عهدی دربارهٔ آیندهٔ یک سابقه است — یک‌بار که نوشته شد، بی‌صدا بازنویسی نمی‌شود. دربارهٔ کامل‌بودنِ سابقه، درستیِ ورودی‌هایی که بر آن بنا شده، یا صداقتِ کسی که اصلاً تصمیم گرفت چه چیزی روی زنجیره بگذارد هیچ نمی‌گوید. شفافیتی که تمامش درونِ زنجیره زندگی می‌کند مرزهای واقعی دارد، و نامیدنشان همان کاری است که این واژه را معنادار نگه می‌دارد.'
          )
        },
        { type: 'h2', text: text('Immutable is not the same as complete', 'تغییرناپذیر با کامل یکی نیست') },
        {
          type: 'ul',
          items: [
            text('Only what was submitted is recorded - a firm\'s internal liabilities, side agreements and legal obligations never touch the chain, so they cannot be immutable and were never in the picture to begin with.', 'تنها آنچه ارسال شده ثبت می‌شود — بدهی‌های داخلی، توافق‌های جانبی و تعهداتِ قانونیِ یک شرکت هیچ‌وقت به زنجیره نمی‌رسند، پس نه تغییرناپذیرند و نه از همان اول در تصویر بوده‌اند که غایب باشند.'),
            text('The address is not the identity: a public ledger shows balances moving between accounts, but never who held the keys, what they promised each other, or which real-world duty the transfer discharged.', 'نشانی هویت نیست: دفترِ عمومی جابه‌جاییِ موجودی میانِ حساب‌ها را نشان می‌دهد، اما نه اینکه کلیدها دستِ که بود، میانِ هم چه پیمانی بسته بودند، یا آن انتقال کدام تکلیفِ دنیایِ واقعی را ادا می‌کرد.'),
            text('Off-chain truth sits outside the ledger: insolvency, a freeze, a custody dispute or a promise to pay can all be fully real while every on-chain number looks clean.', 'حقیقتِ برون‌زنجیره‌ای بیرونِ دفتر می‌نشیند: ورشکستگی، مسدودی، دعوای امانت یا وعدهٔ پرداخت می‌توانند کاملاً واقعی باشند در حالی که هر عددِ درون‌زنجیره‌ای پاک به نظر برسد.'),
          ]
        },
        { type: 'h2', text: text('The oracle problem', 'مسئلهٔ اوراکل') },
        {
          type: 'p',
          text: text(
            'A chain cannot see the world, so on-chain finance borrows prices from an oracle or index feed and trusts the result. Everything downstream - mark prices, collateral valuations, liquidation triggers - is only as correct as that borrowed input. When the feed is stale or wrong, immutability becomes a liability: the mistaken liquidation is now permanent and perfectly verifiable. That is the most common way on-chain transparency misleads - you admire how tamper-proof the recorded price is while nothing checks whether it was true.',
            'زنجیره نمی‌تواند جهان را ببیند، پس مالیِ درون‌زنجیره‌ای قیمت را از یک اوراکل یا خوراکِ شاخص قرض می‌گیرد و نتیجه را می‌پذیرد. همه‌چیزِ پایین‌دست — مارکِ قیمت، ارزش‌گذاریِ وثیقه، محرک‌های لیکوییدشدن — فقط به درستیِ همان ورودیِ قرضی درست است. وقتی خوراک کهنه یا غلط باشد، تغییرناپذیری به نقطهٔ ضعف بدل می‌شود: لیکوییدشدنِ اشتباه حالا دائمی و کاملاً قابل‌راستی‌آزمایی است. این رایج‌ترین شیوه‌ای است که شفافیتِ درون‌زنجیره‌ای گمراه می‌کند — تو تحسین می‌کنی که قیمتِ ثبت‌شده چقدر دست‌کاری‌ناپذیر است در حالی که هیچ‌چیز بررسی نمی‌کند راست بوده یا نه.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Oracle', 'اوراکل'), text: text('A source that feeds off-chain data into the chain; on-chain accuracy is capped by the oracle\'s accuracy.', 'مبدأی که دادهٔ برون‌زنجیره‌ای را به درونِ زنجیره می‌خورد؛ دقتِ درون‌زنجیره‌ای سقفش دقتِ همان اوراکل است.') },
            { term: text('Mark price', 'قیمتِ مرجع'), text: text('A computed price used to value positions - here derived from the venue feed the platform reads, not an independent index.', 'قیمتی محاسبه‌شده برای ارزش‌گذاریِ موقعیت‌ها — اینجا از خوراکِ همان بازار که پلتفرم می‌خواند می‌آید، نه از شاخصی مستقل.') },
            { term: text('Self-custody', 'خودامانتداری'), text: text('Holding your own keys; the alternative, custodial holding, is a real-world arrangement the ledger cannot describe.', 'کلیدِ خودت را نگه داشتن؛ جایگزینش، نگهداشتنِ امانت‌محور، ترتیبی دنیایِ واقعی است که دفتر نمی‌تواندش توصیف کند.') },
          ]
        },
        { type: 'h3', text: text('A venue can be honest and still settle somewhere else', 'بازار می‌تواند صادق باشد و باز هم جای دیگری تسویه کند') },
        {
          type: 'p',
          text: text(
            'These two ideas are often collapsed into one. A trading interface can be scrupulously truthful about where its numbers come from while the venue that actually finalises the trade is an entirely different on-chain deployment. Honest disclosure of the source is a virtue of the interface; the on-chain state it reflects belongs to the venue. Keeping them apart is what stops a well-labelled screen being mistaken for a settlement guarantee - the label says where the data came from, not who pays you if the numbers are right.',
            'این دو ایده غالباً در یکی فشرده می‌شوند. یک رابطِ معاملاتی می‌تواند دربارهٔ مبدأِ عددهایش وسواس‌گونه صادق باشد در حالی که بازاری که واقعاً معامله را نهایی می‌کند استقرارِ آن‌چینِ کاملاً متفاوتی باشد. افشایِ صادقِ مبدأ فضیلتِ رابط است؛ وضعیتِ درون‌زنجیره‌ای که آن را منعکس می‌کند متعلق به بازار است. جدا نگه داشتنِ این دو همان چیزی است که نمی‌گذارد صفحه‌ای خوش‌برچسب با تضمینِ تسویه اشتباه گرفته شود — برچسب می‌گوید داده از کجا آمد، نه اینکه اگر اعداد درست بودند چه کسی بهت پرداخت می‌کند.'
          )
        },
        { type: 'h2', text: text('Code transparency versus financial transparency', 'شفافیتِ کد در برابر شفافیتِ مالی') },
        {
          type: 'p',
          text: text(
            'The last limit sits between two claims that sound similar. Code-level transparency means anyone can read the repository, the build, the deployed contracts and their verified sources; it is concrete, checkable and increasingly standard. Financial transparency is different - proof of reserves, an independent audit of your own contracts, a settlement layer you can verify. Neither follows from the other: a project can publish flawless open-source code and still have no reserves proof, no audit of itself and no customer funds on-chain.',
            'آخرین مرز میان دو ادعاست که شبیه به نظر می‌رسند. شفافیتِ سطحِ کد یعنی هر کسی می‌تواند مخزن، build، قراردادهای مستقرشده و سورس‌هایِ تأییدشده‌شان را بخواند؛ عینی، قابلِ بررسی و رو به استاندارد شدن. شفافیتِ مالی چیزِ دیگری است — اثباتِ ذخایر، حسابرسیِ مستقلِ قراردادهای خودت، و لایهٔ تسویه‌ای که بتوانی وضعیتش را راستی‌آزمایی کنی. هیچ‌یک از دیگری پی نمی‌آید: یک پروژه می‌تواند کدِ متن‌بازِ بی‌عیب منتشر کند و باز هم اثباتِ ذخیره‌ای نداشته باشد، حسابرسیِ خودش را نداشته باشد و سرمایهٔ مشتری‌اش را آن‌چین نگذارد.'
          )
        },
        {
          type: 'note',
          text: text(
            'Where that leaves Openfund, stated without spin. Openfund offers code-level transparency: its source repository and documentation are public, and the perpetual view shows public Gains Network data you can inspect with a block explorer. It makes no financial-transparency claim: there is no proof of reserves, no published vault, no on-chain settlement and no customer-fund custody today, no independent audit has been completed (independent review is planned), the Certik PDF in the repo is an upstream report on a dormant third-party module and not Openfund\'s audit, and the Transparency page renders clearly labelled sample data, not production reporting. Liquidity aggregation across venues and intelligent order routing are future product directions, never current features. Telling that code apart from unproven finances is the point of this path.',
            'این، بدونِ ورشکنی، جای اوپن‌فاند را روشن می‌کند. اوپن‌فاند شفافیتِ سطحِ کد ارائه می‌دهد: مخزنِ سورس و مستندانش عمومی‌اند، و نمایِ دائم دادهٔ عمومیِ Gains Network را نشان می‌دهد که با یک explorer بلاک می‌توانی ببینی. هیچ ادعایِ شفافیتِ مالی نمی‌کند: امروز نه اثباتِ ذخایر دارد، نه خزانهٔ منتشرشده، نه تسویهٔ آن‌چین و نه نگهداریِ سرمایهٔ مشتری؛ هیچ حسابرسیِ مستقلی کامل نشده (بررسی مستقل در برنامه است)؛ PDF گزارش Certik در مخزن گزارشِ بالادستیِ یک مدولِ ثالثِ خاموش است، نه حسابرسیِ اوپن‌فاند؛ و صفحهٔ شفافیت دادهٔ صریحاً نمونه نشان می‌دهد، نه گزارشِ عملیاتی. تجمیعِ نقدینگی میانِ بازارها و مسیریابیِ هوشمندِ سفارش جهت‌گیری‌هایِ آتیِ محصول‌اند، هرگز ویژگی‌هایِ امروز. تفکیکِ همان کد از اموری که اثبات نشده‌اند، هدفِ این مسیر است.'
          )
        },
      ]
    },
  ]
}
