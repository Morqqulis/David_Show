/**
 * Pathname predicates for the All Requests section.
 *
 * Deliberately dependency-free so it can be unit-tested without dragging the
 * server component graph (`server-only`, Payload, server actions) into the
 * test runtime.
 */

export const REQUESTS_LIST_PATH = '/requests'

/**
 * True only on the All Requests LIST route.
 *
 * Deliberately NOT a prefix match: `/requests/<id>` and `/requests/<id>/coding`
 * are invoice detail routes. Treating them as "already on the list" was the
 * bug that made every left-nav queue button inert while an invoice was open —
 * the tab store updated (moving the highlight) but the router was never told
 * to leave the invoice.
 */
export function isRequestsListPath(pathname: string | null | undefined): boolean {
  return pathname === REQUESTS_LIST_PATH
}

/** True on an invoice detail route (`/requests/<id>` and its children). */
export function isInvoiceDetailPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && pathname.startsWith(REQUESTS_LIST_PATH + '/')
}

/**
 * Address of the All Requests list showing one queue.
 *
 * The queue has to travel in the address, not only in the shared client store.
 * All Requests answers from the server now, and it reads the queue from `?tab=`
 * — a bare `/requests` is answered as "all", and the screen then writes "all"
 * back into the store as it mounts. Arriving from another page with only the
 * store set therefore lands the user on All Requests instead of the queue they
 * clicked. Callers already on the list page should leave the address alone and
 * just set the store, so the columns, filters and sort they have arranged are
 * preserved.
 */
export function requestsListHref(tab: string): string {
  return tab === 'all' ? REQUESTS_LIST_PATH : `${REQUESTS_LIST_PATH}?tab=${encodeURIComponent(tab)}`
}
