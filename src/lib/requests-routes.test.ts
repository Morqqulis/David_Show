import { describe, expect, test } from 'bun:test'
import { isInvoiceDetailPath, isRequestsListPath, requestsListHref } from './requests-routes'

describe('isRequestsListPath', () => {
  test('true on the All Requests list route', () => {
    expect(isRequestsListPath('/requests')).toBe(true)
  })

  // The regression this guards: a prefix match here made every left-nav queue
  // button inert while an invoice was open (Dmitriy item 4).
  test('false on an open invoice', () => {
    expect(isRequestsListPath('/requests/6f2a')).toBe(false)
  })

  test('false on the coding child route', () => {
    expect(isRequestsListPath('/requests/6f2a/coding')).toBe(false)
  })

  test('false on unrelated routes and on an absent pathname', () => {
    expect(isRequestsListPath('/dashboard')).toBe(false)
    expect(isRequestsListPath('/requests-archive')).toBe(false)
    expect(isRequestsListPath(null)).toBe(false)
    expect(isRequestsListPath(undefined)).toBe(false)
  })
})

describe('requestsListHref', () => {
  // The regression this guards: once All Requests started answering from the
  // server, a bare /requests meant "all", so leaving an invoice by clicking a
  // queue landed on All Requests and threw the click away.
  test('carries the queue in the address', () => {
    expect(requestsListHref('ap_review')).toBe('/requests?tab=ap_review')
  })

  test('the All queue needs no parameter', () => {
    expect(requestsListHref('all')).toBe('/requests')
  })

  test('encodes anything unexpected rather than injecting it raw', () => {
    expect(requestsListHref('a b&c=d')).toBe('/requests?tab=a%20b%26c%3Dd')
  })
})

describe('isInvoiceDetailPath', () => {
  test('true on an invoice and on its coding child', () => {
    expect(isInvoiceDetailPath('/requests/6f2a')).toBe(true)
    expect(isInvoiceDetailPath('/requests/6f2a/coding')).toBe(true)
  })

  test('false on the list route and on an absent pathname', () => {
    expect(isInvoiceDetailPath('/requests')).toBe(false)
    expect(isInvoiceDetailPath(null)).toBe(false)
    expect(isInvoiceDetailPath(undefined)).toBe(false)
  })
})
