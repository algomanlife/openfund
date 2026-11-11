/** Versioned URL for an unhashed legacy stylesheet (public/legacy/*.css).
 *  These files keep a stable name, so an edge or browser cache can hold an
 *  older copy after a deploy, independently per domain (openfund.cloud and
 *  openfi.cloud are separate cache origins). The build commit in the query
 *  string gives every release its own URL. */
export function legacyStylesheet(file: string): string {
  const version = __OPENFUND_BUILD__.commit.slice(0, 12)
  return `${import.meta.env.BASE_URL}${file}?v=${encodeURIComponent(version)}`
}
