/**
 * Hybrid Governance v1.0 — presentation model (pure, no React, no network).
 * Policy numbers here mirror apps/backend/governance-rules.js; the web-react
 * test suite asserts the two never diverge. The BACKEND is authoritative:
 * nothing in this module grants any permission.
 */
import { text, type Locale, type Localized } from '../information/content'

export const COUNCIL_SIZE = 10
export const QUORUM = 7
export const ORDINARY_THRESHOLD = 6
export const CONSTITUTIONAL_THRESHOLD = 7

export const CONSTITUENCIES = ['ambassador', 'coach', 'community_trader', 'funded_trader', 'moderator'] as const
export type Constituency = typeof CONSTITUENCIES[number]
export const CONSTITUENCY_LABEL: Record<Constituency, Localized> = {
  ambassador: text('Verified Brand Ambassadors', 'سفیران برند تأییدشده'),
  coach: text('Verified Trading Coaches', 'مربیان معاملاتی تأییدشده'),
  community_trader: text('Community Traders', 'معامله‌گران جامعه'),
  funded_trader: text('Funded Traders', 'معامله‌گران فاندد'),
  moderator: text('Community & Social Media Moderators', 'مدیران جامعه و شبکه‌های اجتماعی'),
}

export const DELEGATED_CATEGORIES = ['product_priority', 'community_policy', 'open_source', 'roadmap', 'documentation', 'accessibility', 'governance_amendment'] as const
export const RESERVED_CATEGORIES = ['treasury', 'pricing', 'commissions', 'coach_compensation', 'marketing_budget', 'operating_budget', 'capital_allocation', 'trading_risk', 'payouts', 'liquidity', 'commercial_partnership', 'contract_deployment', 'other_financial'] as const
export type Category = typeof DELEGATED_CATEGORIES[number] | typeof RESERVED_CATEGORIES[number]

export const CATEGORY_LABEL: Record<Category, Localized> = {
  product_priority: text('Product priority', 'اولویت محصول'),
  community_policy: text('Community policy', 'سیاست جامعه'),
  open_source: text('Open-source development', 'توسعهٔ متن‌باز'),
  roadmap: text('Roadmap', 'نقشهٔ راه'),
  documentation: text('Documentation', 'مستندات'),
  accessibility: text('Accessibility', 'دسترس‌پذیری'),
  governance_amendment: text('Governance amendment', 'اصلاحیهٔ حاکمیتی'),
  treasury: text('Treasury', 'خزانه'),
  pricing: text('Challenge pricing', 'قیمت‌گذاری چلنج'),
  commissions: text('Commissions', 'کمیسیون‌ها'),
  coach_compensation: text('Coach compensation', 'پاداش مربیان'),
  marketing_budget: text('Marketing budget', 'بودجهٔ بازاریابی'),
  operating_budget: text('Operating budget', 'بودجهٔ عملیاتی'),
  capital_allocation: text('Capital allocation', 'تخصیص سرمایه'),
  trading_risk: text('Trading risk limits', 'محدودیت‌های ریسک معاملاتی'),
  payouts: text('Trader payouts', 'پرداخت‌های معامله‌گران'),
  liquidity: text('Liquidity', 'نقدینگی'),
  commercial_partnership: text('Commercial partnerships', 'شراکت‌های تجاری'),
  contract_deployment: text('Production contract deployment', 'استقرار قرارداد در تولید'),
  other_financial: text('Other financial matter', 'سایر موضوعات مالی'),
}
export const isReservedCategory = (c: string): boolean => (RESERVED_CATEGORIES as readonly string[]).includes(c)
export const categoryLabel = (c: string, locale: Locale): string => CATEGORY_LABEL[c as Category]?.[locale] ?? c

export const STATUS_LABEL: Record<string, Localized> = {
  draft: text('Draft', 'پیش‌نویس'),
  discussion: text('Discussion', 'گفت‌وگو'),
  submitted: text('Submitted', 'ثبت‌شده'),
  under_review: text('Under review', 'در حال بررسی'),
  voting: text('Voting', 'در حال رأی‌گیری'),
  approved: text('Approved', 'تصویب‌شده'),
  rejected: text('Rejected', 'ردشده'),
  implementation_scheduled: text('Implementation scheduled', 'اجرا زمان‌بندی شد'),
  in_progress: text('In progress', 'در حال اجرا'),
  implemented: text('Implemented', 'اجراشده'),
  blocked: text('Blocked', 'مسدود'),
  archived: text('Archived', 'بایگانی‌شده'),
}
export const statusLabel = (s: string, locale: Locale): string => STATUS_LABEL[s]?.[locale] ?? s

/** The ONLY wording for a proposal's authority class. Advisory is never shown as plain "Advisory". */
export const classificationLabel = (binding: boolean, locale: Locale): string =>
  binding ? text('Binding', 'الزام‌آور')[locale] : text('Advisory — Non-Binding', 'مشورتی — غیرالزام‌آور')[locale]

export const VOTE_LABEL: Record<string, Localized> = {
  approve: text('Approve', 'موافق'),
  reject: text('Reject', 'مخالف'),
  abstain: text('Abstain', 'ممتنع'),
}

export interface VotingSession {
  id: string; kind: 'ordinary' | 'constitutional'; councilSize: number; quorum: number; threshold: number
  opensAt: string; closesAt: string; status: string; phase: 'scheduled' | 'open' | 'closed' | 'finalized' | 'void'
}
export const approvalRequirement = (s: Pick<VotingSession, 'threshold' | 'quorum' | 'councilSize'>, locale: Locale): string =>
  locale === 'fa'
    ? `حداقل ${s.threshold} رأی موافق از کل ${s.councilSize} عضو شورا و حدنصاب ${s.quorum} عضو شرکت‌کننده. ممتنع شرکت محسوب می‌شود، رأی موافق نیست.`
    : `At least ${s.threshold} affirmative votes from the full ${s.councilSize}-seat council, with ${s.quorum} members participating. An abstention counts as participation, not approval.`

/** time left until the deadline, in whole units; null once closed */
export function timeLeft(closesAt: string, now = Date.now()): { days: number; hours: number; minutes: number } | null {
  const ms = new Date(closesAt).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor(ms / 3_600_000) % 24, minutes: Math.floor(ms / 60_000) % 60 }
}
export const formatDate = (iso: string | null | undefined, locale: Locale): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(d) + ' UTC'
}
export const formatDay = (iso: string | null | undefined, locale: Locale): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(d)
}

const ERRORS: Record<string, Localized> = {
  unauthenticated: text('Sign in with your wallet first.', 'ابتدا با کیف پول وارد شو.'),
  forbidden: text('Your account is not authorised for this action.', 'حساب تو برای این اقدام مجاز نیست.'),
  already_voted: text('You have already voted. A submitted vote is final.', 'پیش‌تر رأی داده‌ای. رأی ثبت‌شده نهایی است.'),
  voting_closed: text('Voting has closed.', 'رأی‌گیری بسته شده است.'),
  voting_not_open: text('Voting has not opened yet.', 'رأی‌گیری هنوز باز نشده است.'),
  not_in_voting_snapshot: text('You do not hold a council seat in this vote.', 'در این رأی‌گیری کرسی شورا نداری.'),
  membership_not_active: text('Your council membership is not active.', 'عضویت شورای تو فعال نیست.'),
  recused: text('You are recused from this proposal.', 'در این پیشنهاد کناره‌گیری کرده‌ای.'),
  conflict_pending_review: text('Your conflict declaration is awaiting review.', 'اعلام تعارض منافع تو در انتظار بررسی است.'),
  account_not_active: text('Your account is not active.', 'حساب تو فعال نیست.'),
  reserved_power_is_advisory_only: text('Financial and treasury matters can only be advisory recommendations.', 'موضوعات مالی و خزانه فقط توصیهٔ مشورتی هستند.'),
  financial_fields_not_accepted: text('Governance requests cannot carry financial instructions.', 'درخواست‌های حاکمیتی نمی‌توانند دستور مالی داشته باشند.'),
  rate_limited: text('Too many requests. Try again shortly.', 'درخواست‌ها زیاد است. کمی بعد دوباره تلاش کن.'),
  signature_challenge_invalid_or_replayed: text('The signature request expired or was already used. Try again.', 'درخواست امضا منقضی یا استفاده شده است. دوباره تلاش کن.'),
  signature_wallet_mismatch: text('The signature does not match your wallet.', 'امضا با کیف پول تو مطابقت ندارد.'),
}
export const errorMessage = (code: string | undefined, locale: Locale): string =>
  (code && ERRORS[code]?.[locale]) || text('The request could not be completed.', 'درخواست انجام نشد.')[locale]

export type LoadState<T> = { status: 'loading' } | { status: 'error'; code?: string } | { status: 'ready'; data: T }

/** why a viewer sees a read-only vote panel */
export function voteGate(viewer: { canVote: boolean; reason: string | null; councilMember: boolean } | undefined, session: VotingSession | undefined, signedIn: boolean): 'vote' | 'readonly' {
  if (!signedIn || !viewer || !session) return 'readonly'
  return viewer.councilMember && viewer.canVote && session.phase === 'open' ? 'vote' : 'readonly'
}

export const DOC_BASE = 'https://github.com/algomanlife/openfund/blob/main/'
export const GOVERNANCE_DOCS = [
  { path: 'GOVERNANCE.md', label: text('GOVERNANCE.md — Governance v1.0 policy', 'GOVERNANCE.md — سیاست حاکمیت نسخهٔ ۱٫۰') },
  { path: 'ECONOMY.md', label: text('ECONOMY.md — economic boundary and approved policy', 'ECONOMY.md — مرز اقتصادی و سیاست‌های تصویب‌شده') },
  { path: 'docs/governance/PROPOSALS.md', label: text('Proposal procedure (OFP)', 'روند پیشنهاد (OFP)') },
  { path: 'docs/governance/VOTING.md', label: text('Voting policy', 'سیاست رأی‌گیری') },
  { path: 'docs/governance/COUNCIL.md', label: text('Council composition and terms', 'ترکیب و دورهٔ شورا') },
  { path: 'docs/governance/ELECTIONS.md', label: text('Elections', 'انتخابات') },
  { path: 'docs/governance/WHITEPAPER_GOVERNANCE.md', label: text('Whitepaper governance chapter (prepared)', 'فصل حاکمیت وایت‌پیپر (آماده‌شده)') },
  { path: 'CONTRIBUTING.md', label: text('CONTRIBUTING.md', 'CONTRIBUTING.md') },
] as const
