/** The progression for a plan (wallet-based, no KYC): One-phase skips skill
 *  verification and Instant starts at wallet verification. */
export type Stage = 'evaluation' | 'verification' | 'wallet' | 'agreement' | 'funded'
export function progression(rules: { phases: number }): Stage[] {
  if (rules.phases >= 2) return ['evaluation', 'verification', 'wallet', 'agreement', 'funded']
  if (rules.phases === 1) return ['evaluation', 'wallet', 'agreement', 'funded']
  return ['wallet', 'agreement', 'funded']
}
