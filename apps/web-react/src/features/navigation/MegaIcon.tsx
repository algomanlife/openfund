import { MEGA_ICONS } from './megaMenu'

/** React form of the mega-menu line icons (drawer and terminal menu). */
export default function MegaIcon({ name }: { name: string }) {
  return <svg className="mega-icon-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d={MEGA_ICONS[name] || MEGA_ICONS.about} /></svg>
}
