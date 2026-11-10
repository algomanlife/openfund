/**
 * Whitepaper governance chapter (editorial content, bilingual).
 *
 * The Whitepaper application is not part of this base branch: it lives on
 * `feat/openfund-whitepaper-v1`. This module therefore carries the chapter as
 * plain data whose shape matches that branch's `WpChapter` / `WpBlock` types
 * (slug, sort, kicker, title, summary, blocks), without importing them. It
 * replaces that branch's existing `governance` chapter (sort 16), whose
 * "contributions do not confer voting rights" wording predates Hybrid
 * Governance. See docs/governance/WHITEPAPER_GOVERNANCE.md for the steps.
 *
 * Every statement separates APPROVED POLICY, BUILT CAPABILITY and PLANNED work.
 */
import { text as t, type Localized } from '../information/content'

type Bi = Localized
type Block =
  | { type: 'lead'; text: Bi }
  | { type: 'p'; text: Bi }
  | { type: 'h3'; text: Bi }
  | { type: 'list'; ordered?: boolean; items: Bi[] }
  | { type: 'callout'; tone: 'info' | 'principle' | 'warning' | 'risk'; title: Bi; text: Bi }
  | { type: 'definitions'; items: Array<{ term: Bi; text: Bi }> }
  | { type: 'table'; caption: Bi; head: Bi[]; rows: Bi[][] }
  | { type: 'refs'; keys: string[] }

export interface GovernanceChapter { slug: 'governance'; sort: 16; kicker: Bi; title: Bi; summary: Bi; blocks: Block[] }

export const governanceChapter: GovernanceChapter = {
  slug: 'governance', sort: 16,
  kicker: t('Hybrid Governance', 'حاکمیت ترکیبی'),
  title: t('Community-governed development. Company-managed treasury.', 'توسعهٔ مبتنی بر جامعه. خزانهٔ تحت مدیریت شرکت.'),
  summary: t('Who decides what, how a proposal becomes a decision, and where company authority begins.', 'چه کسی دربارهٔ چه چیزی تصمیم می‌گیرد، پیشنهاد چگونه به تصمیم تبدیل می‌شود و اختیار شرکت از کجا آغاز می‌شود.'),
  blocks: [
    { type: 'lead', text: t(
      'Openfund separates two kinds of authority. A ten-seat Community Council makes binding decisions in explicitly delegated, non-financial domains. Company management keeps exclusive control of the treasury and every financial and commercial decision.',
      'اوپن‌فاند دو نوع اختیار را از هم جدا می‌کند. شورای ده‌نفرهٔ جامعه در حوزه‌های غیرمالیِ صریحاً تفویض‌شده تصمیم الزام‌آور می‌گیرد. مدیریت شرکت کنترل انحصاری خزانه و هر تصمیم مالی و تجاری را حفظ می‌کند.') },
    { type: 'callout', tone: 'warning', title: t('Current status', 'وضعیت فعلی'), text: t(
      'The governance framework — proposals, voting records, council membership rules and an audit trail — is built and covered by automated tests. It is not yet in production use: no council has been seated and no election has been scheduled. This is not a DAO, there is no governance token, and votes are recorded by the Openfund backend, not on a blockchain.',
      'چارچوب حاکمیت — پیشنهادها، سوابق رأی، قواعد عضویت شورا و ردپای حسابرسی — ساخته شده و با آزمون‌های خودکار پوشش داده شده است. هنوز در استفادهٔ تولیدی نیست: شورایی تشکیل نشده و انتخاباتی زمان‌بندی نشده است. این یک DAO نیست، توکن حاکمیتی وجود ندارد و آرا در بک‌اند اوپن‌فاند ثبت می‌شوند، نه روی بلاک‌چین.') },
    { type: 'h3', text: t('The Community Council', 'شورای جامعه') },
    { type: 'table', caption: t('Council composition (Governance v1.0)', 'ترکیب شورا (حاکمیت نسخهٔ ۱٫۰)'),
      head: [t('Constituency', 'گروه'), t('Seats', 'کرسی')],
      rows: [
        [t('Verified Brand Ambassadors', 'سفیران برند تأییدشده'), t('2', '۲')],
        [t('Verified Trading Coaches', 'مربیان معاملاتی تأییدشده'), t('2', '۲')],
        [t('Community Traders', 'معامله‌گران جامعه'), t('2', '۲')],
        [t('Funded Traders', 'معامله‌گران فاندد'), t('2', '۲')],
        [t('Community & Social Media Moderators', 'مدیران جامعه و شبکه‌های اجتماعی'), t('2', '۲')],
        [t('Total', 'جمع'), t('10', '۱۰')],
      ] },
    { type: 'p', text: t(
      'Terms last six months. The first council may be appointed by company management through a documented process and is always labelled as appointed, never as community-elected. Later councils are elected by each constituency once management approves the election rules and voter criteria. Each person holds one seat, whatever roles they qualify for.',
      'دورهٔ شورا شش ماه است. شورای نخست ممکن است با روندی مستند توسط مدیریت شرکت منصوب شود و همیشه «منصوب» معرفی می‌شود، نه «انتخاب‌شده توسط جامعه». شوراهای بعدی پس از تأیید قواعد انتخابات و معیار رأی‌دهندگان توسط مدیریت، با رأی هر گروه انتخاب می‌شوند. هر فرد یک کرسی دارد، حتی اگر شرایط چند نقش را داشته باشد.') },
    { type: 'h3', text: t('What the council decides — and what it cannot', 'شورا دربارهٔ چه چیزی تصمیم می‌گیرد — و چه چیزی را نمی‌تواند') },
    { type: 'table', caption: t('Authority boundary', 'مرز اختیارات'),
      head: [t('Council decisions are binding', 'تصمیم‌های شورا الزام‌آور است'), t('Reserved to company management (advisory only)', 'متعلق به مدیریت شرکت (فقط مشورتی)')],
      rows: [
        [t('Product development priorities', 'اولویت‌های توسعهٔ محصول'), t('Treasury, reserves and capital allocation', 'خزانه، ذخایر و تخصیص سرمایه')],
        [t('Community policies and moderation standards', 'سیاست‌های جامعه و استانداردهای مدیریت'), t('Challenge prices, revenue model and trader payouts', 'قیمت چلنج، مدل درآمد و پرداخت‌های معامله‌گران')],
        [t('Open-source contribution priorities', 'اولویت‌های مشارکت متن‌باز'), t('Ambassador commissions and coach compensation', 'کمیسیون سفیران و پاداش مربیان')],
        [t('Roadmap priorities within management-approved capacity', 'اولویت‌های نقشهٔ راه در ظرفیت تأییدشدهٔ مدیریت'), t('Trading risk limits and real trading capital', 'محدودیت‌های ریسک و سرمایهٔ واقعی معاملاتی')],
        [t('Documentation and accessibility priorities', 'اولویت‌های مستندات و دسترس‌پذیری'), t('Commercial contracts and production contract deployments', 'قراردادهای تجاری و استقرار قراردادهای تولیدی')],
      ] },
    { type: 'p', text: t(
      'A binding decision cannot override financial limits, security requirements, legal obligations, risk controls, software licences or approved resource capacity. If a decision cannot be implemented, management must record the specific reason, the evidence and the next review date; it may not ignore the decision. Community recommendations on financial topics are always labelled “Advisory — Non-Binding” and the backend refuses to classify them otherwise.',
      'تصمیم الزام‌آور نمی‌تواند بر محدودیت‌های مالی، الزامات امنیتی، تعهدات حقوقی، کنترل‌های ریسک، مجوزهای نرم‌افزار یا ظرفیت منابع تأییدشده غلبه کند. اگر تصمیمی قابل اجرا نباشد، مدیریت باید دلیل مشخص، شواهد و تاریخ بازبینی بعدی را ثبت کند و نمی‌تواند تصمیم را نادیده بگیرد. توصیه‌های جامعه دربارهٔ موضوعات مالی همیشه «مشورتی — غیرالزام‌آور» برچسب می‌خورد و بک‌اند اجازهٔ طبقه‌بندی دیگری نمی‌دهد.') },
    { type: 'h3', text: t('From proposal to decision', 'از پیشنهاد تا تصمیم') },
    { type: 'list', ordered: true, items: [
      t('A proposal receives a permanent OFP number and moves through draft, discussion, submitted and under review.', 'پیشنهاد شمارهٔ دائمی OFP می‌گیرد و از پیش‌نویس، گفت‌وگو، ثبت و بررسی می‌گذرد.'),
      t('Voting rules and the eligibility snapshot are fixed when voting opens; material changes require a new revision and a new vote.', 'قواعد رأی‌گیری و فهرست واجدان شرایط هنگام آغاز رأی‌گیری ثابت می‌شود؛ تغییر ماهوی بازنگری و رأی‌گیری تازه می‌خواهد.'),
      t('Each council member casts one vote: approve, reject or abstain. Seven participating members form a quorum.', 'هر عضو شورا یک رأی می‌دهد: موافق، مخالف یا ممتنع. حضور هفت عضو حدنصاب است.'),
      t('Approval needs six affirmative votes out of the full ten seats; a governance amendment needs seven. Abstentions, vacancies and recusals never lower these numbers.', 'تصویب شش رأی موافق از کل ده کرسی می‌خواهد؛ اصلاحیهٔ حاکمیتی هفت رأی. ممتنع، کرسی خالی و کناره‌گیری هرگز این اعداد را کاهش نمی‌دهد.'),
      t('The result is recorded immutably. An approved proposal is not “implemented” until verifiable execution evidence is published.', 'نتیجه به‌صورت تغییرناپذیر ثبت می‌شود. پیشنهاد تصویب‌شده تا انتشار شواهد قابل‌راستی‌آزمایی «اجراشده» نیست.'),
    ] },
    { type: 'h3', text: t('Public accountability', 'پاسخ‌گویی عمومی') },
    { type: 'definitions', items: [
      { term: t('Conflicts of interest', 'تعارض منافع'), text: t('Members declare conflicts; a reviewer decides on recusal; a recused member cannot vote.', 'اعضا تعارض را اعلام می‌کنند؛ بازبین دربارهٔ کناره‌گیری تصمیم می‌گیرد؛ عضو کناره‌گیرنده رأی نمی‌دهد.') },
      { term: t('Audit trail', 'ردپای حسابرسی'), text: t('Governance actions are written to an append-only, hash-chained log, so later tampering is detectable.', 'اقدام‌های حاکمیتی در گزارشی فقط‌افزودنی و زنجیره‌ای با هش ثبت می‌شوند و دست‌کاری بعدی قابل‌تشخیص است.') },
      { term: t('Wallet signatures', 'امضای کیف پول'), text: t('A council member may add a free, single-use wallet signature to a vote as extra evidence. It is not a transaction.', 'عضو شورا می‌تواند به رأی خود امضای رایگان و یک‌بارمصرف کیف پول را به‌عنوان مدرک بیشتر بیفزاید. تراکنش نیست.') },
      { term: t('Financial isolation', 'جداسازی مالی'), text: t('Governance code has no access to treasury, trading, pricing, commission or payout systems. A decision is a record, not an instruction.', 'کد حاکمیت به سامانه‌های خزانه، معاملات، قیمت‌گذاری، کمیسیون یا پرداخت دسترسی ندارد. تصمیم یک سابقه است، نه دستور.') },
    ] },
    { type: 'callout', tone: 'principle', title: t('Evolution', 'تکامل'), text: t(
      'On-chain governance is an optional research direction, not an existing capability and not a commitment. Any future version needs its own approved and audited design, and could never reach company funds without a separate authorisation.',
      'حاکمیت آن‌چین یک مسیر پژوهشی اختیاری است، نه قابلیت موجود و نه تعهد. هر نسخهٔ آینده به طراحی تأییدشده و ممیزی‌شدهٔ جداگانه نیاز دارد و بدون مجوز مستقل هرگز به وجوه شرکت دسترسی نخواهد داشت.') },
    { type: 'refs', keys: ['contributing', 'feature-status'] },
  ],
}
