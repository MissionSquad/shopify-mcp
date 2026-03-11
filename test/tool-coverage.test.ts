import { describe, expect, it } from 'vitest'
import { SHOPIFY_TOOL_NAMES } from '../src/tools.js'

const EXPECTED_TOOL_NAMES = [
  'shopify_get_products',
  'shopify_get_product_by_id',
  'shopify_create_product',
  'shopify_update_product',
  'shopify_delete_product',
  'shopify_manage_product_variants',
  'shopify_manage_product_options',
  'shopify_delete_product_variants',
  'shopify_get_customers',
  'shopify_update_customer',
  'shopify_get_customer_orders',
  'shopify_get_orders',
  'shopify_get_order_by_id',
  'shopify_update_order',
] as const

describe('Shopify MCP tool coverage', () => {
  it('registers the expected tool surface', () => {
    expect(SHOPIFY_TOOL_NAMES).toEqual(EXPECTED_TOOL_NAMES)
  })

  it('registers each tool exactly once', () => {
    expect(new Set(SHOPIFY_TOOL_NAMES).size).toBe(EXPECTED_TOOL_NAMES.length)
  })
})
