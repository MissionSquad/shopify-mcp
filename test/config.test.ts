import { describe, expect, it } from 'vitest'
import { resolveShopifyConfig, type AppConfig } from '../src/config.js'

const TEST_DEFAULTS: AppConfig = {
  defaultAccessToken: 'shpat_test_default',
  defaultClientId: undefined,
  defaultClientSecret: undefined,
  defaultShopDomain: 'test-store.myshopify.com',
  defaultApiVersion: '2026-01',
}

describe('resolveShopifyConfig', () => {
  it('prefers hidden accessToken over environment fallback', () => {
    const resolved = resolveShopifyConfig(
      { accessToken: 'shpat_hidden' },
      TEST_DEFAULTS,
    )
    expect(resolved.accessToken).toBe('shpat_hidden')
  })

  it('uses default shopDomain when hidden shopDomain is not provided', () => {
    const resolved = resolveShopifyConfig(undefined, TEST_DEFAULTS)
    expect(resolved.shopDomain).toBe('test-store.myshopify.com')
  })

  it('throws when no shopDomain is available', () => {
    expect(() =>
      resolveShopifyConfig(undefined, {
        ...TEST_DEFAULTS,
        defaultShopDomain: undefined,
      }),
    ).toThrow('shop domain is required')
  })

  it('throws when no authentication is available', () => {
    expect(() =>
      resolveShopifyConfig(undefined, {
        ...TEST_DEFAULTS,
        defaultAccessToken: undefined,
      }),
    ).toThrow('authentication is required')
  })

  it('accepts client credentials when no access token', () => {
    const resolved = resolveShopifyConfig(
      { clientId: 'id', clientSecret: 'secret' },
      { ...TEST_DEFAULTS, defaultAccessToken: undefined },
    )
    expect(resolved.clientId).toBe('id')
    expect(resolved.clientSecret).toBe('secret')
    expect(resolved.accessToken).toBeUndefined()
  })

  it('prefers accessToken over clientCredentials when both present', () => {
    const resolved = resolveShopifyConfig(
      { accessToken: 'shpat_tok', clientId: 'id', clientSecret: 'secret' },
      { ...TEST_DEFAULTS, defaultAccessToken: undefined },
    )
    expect(resolved.accessToken).toBe('shpat_tok')
  })

  it('trims whitespace from hidden arguments', () => {
    const resolved = resolveShopifyConfig(
      { accessToken: '  shpat_trimmed  ', shopDomain: '  store.myshopify.com  ' },
      { ...TEST_DEFAULTS, defaultAccessToken: undefined, defaultShopDomain: undefined },
    )
    expect(resolved.accessToken).toBe('shpat_trimmed')
    expect(resolved.shopDomain).toBe('store.myshopify.com')
  })

  it('throws when hidden argument is not a string', () => {
    expect(() =>
      resolveShopifyConfig(
        { accessToken: 123 as unknown },
        TEST_DEFAULTS,
      ),
    ).toThrow('must be a string')
  })

  it('throws when hidden argument is empty string', () => {
    expect(() =>
      resolveShopifyConfig(
        { accessToken: '   ' },
        { ...TEST_DEFAULTS, defaultAccessToken: undefined },
      ),
    ).toThrow('must be a non-empty string')
  })

  it('uses default apiVersion when not provided', () => {
    const resolved = resolveShopifyConfig(undefined, TEST_DEFAULTS)
    expect(resolved.apiVersion).toBe('2026-01')
  })

  it('overrides apiVersion from hidden args', () => {
    const resolved = resolveShopifyConfig(
      { apiVersion: '2025-10' },
      TEST_DEFAULTS,
    )
    expect(resolved.apiVersion).toBe('2025-10')
  })
})
