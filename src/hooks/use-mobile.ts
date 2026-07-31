import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Subscribes to the viewport width the way React expects an external source to
 * be read: `useSyncExternalStore` rather than an effect that calls setState.
 *
 * The effect version measured the window one render too late, which showed the
 * desktop layout for a frame on a phone and tripped
 * `react-hooks/set-state-in-effect`. The server snapshot is `false` — there is
 * no viewport to measure during rendering, and desktop was already what the
 * previous implementation produced before its first measurement landed.
 */
function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}
