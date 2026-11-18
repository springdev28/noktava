export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><img className="brand-symbol" src="/brand/noktava-mark.svg" width="38" height="38" alt="" aria-hidden="true" />{!compact && <span className="brand-wordmark">noktava.</span>}</span>
}
