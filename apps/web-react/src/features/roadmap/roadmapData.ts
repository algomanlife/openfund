/* The engineering phases mirror the register in ROADMAP.md. */
import { text } from '../information/content'

export type RoadmapStatus = 'completed' | 'in-progress' | 'planned' | 'vision'
export interface RoadmapPhase { phase: number; name: ReturnType<typeof text>; direction: ReturnType<typeof text>; assessment: ReturnType<typeof text>; milestones: string; status: RoadmapStatus; en: { name: string; direction: string; assessment: string } }

const phase = (n: number, status: RoadmapStatus, milestones: string, name: [string, string], direction: [string, string], assessment: [string, string]): RoadmapPhase =>
  ({ phase: n, status, milestones, name: text(...name), direction: text(...direction), assessment: text(...assessment), en: { name: name[0], direction: direction[0], assessment: assessment[0] } })

export const ROADMAP_PHASES: RoadmapPhase[] = [
  phase(1, 'completed', 'F1, F2', ['Platform Foundation', 'زیرساخت پلتفرم'], ['Repository, React/Node, charting, market data', 'مخزن کد، React/Node، چارت و دادهٔ بازار'], ['Delivered within current app scope', 'در محدودهٔ فعلی اپلیکیشن تحویل شده است']),
  phase(2, 'in-progress', 'T1–T3', ['Trading Core', 'هستهٔ معاملات'], ['Prop engine, calculations, risk, positions and state', 'موتور پراپ، محاسبات، ریسک، پوزیشن‌ها و وضعیت'], ['Simulation delivered; commercial evaluation planned', 'شبیه‌سازی تحویل شده؛ ارزیابی تجاری برنامه‌ریزی شده است']),
  phase(3, 'in-progress', 'X1–X4', ['Product Experience', 'تجربهٔ محصول'], ['Wallet, Portfolio, Journal, challenges, markets, multilingual UI', 'کیف پول، پورتفولیو، ژورنال، چالش‌ها، بازارها و رابط چندزبانه'], ['Core views delivered; external wallet and commercial acceptance open', 'نماهای اصلی تحویل شده؛ پذیرش کیف پول خارجی و پذیرش تجاری باز است']),
  phase(4, 'in-progress', 'I1–I3', ['Production Infrastructure', 'زیرساخت تولید'], ['Render, PostgreSQL, Directus, CI/CD, security and observability', 'Render، PostgreSQL، Directus، CI/CD، امنیت و پایش'], ['Configuration/CI delivered; deployment and operational assurance open', 'پیکربندی و CI تحویل شده؛ استقرار و اطمینان عملیاتی باز است']),
  phase(5, 'planned', 'A1–A3', ['Advanced Trading', 'معاملات پیشرفته'], ['Extended orders, analytics and execution improvements', 'سفارش‌های گسترده، تحلیل‌ها و بهبود اجرا'], ['Planned, with live execution/data gates blocked', 'برنامه‌ریزی شده؛ دروازه‌های اجرای زنده و داده مسدود است']),
  phase(6, 'planned', 'P1, P2', ['Openfund Protocol', 'پروتکل اوپن‌فاند'], ['Venue adapters, aggregation and intelligent routing', 'آداپتورهای بازار، تجمیع و مسیریابی هوشمند'], ['Dormant source foundation integrated; operational routing planned', 'پایهٔ کد غیرفعال یکپارچه شده؛ مسیریابی عملیاتی برنامه‌ریزی شده است']),
  phase(7, 'planned', 'E1, E2', ['Ecosystem Expansion', 'گسترش اکوسیستم'], ['Integrations, developer services, scalability', 'یکپارچه‌سازی‌ها، خدمات توسعه‌دهندگان و مقیاس‌پذیری'], ['Planned', 'برنامه‌ریزی شده']),
]

export const REGISTER_URL = 'https://github.com/algomanlife/openfund/blob/main/ROADMAP.md'
export const MILESTONES_URL = 'https://github.com/algomanlife/openfund/blob/main/docs/roadmap/MILESTONES.md'
