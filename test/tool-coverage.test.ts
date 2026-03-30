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
  'shopify_get_blogs',
  'shopify_get_blog_articles',
  'shopify_get_article_by_id',
  'shopify_search_articles',
  'shopify_create_article',
  'shopify_update_article',
  'shopify_delete_article',
  'shopify_create_blog',
  'shopify_update_blog',
  'shopify_delete_blog',
  'shopify_get_pages',
  'shopify_get_page_by_id',
  'shopify_create_page',
  'shopify_update_page',
  'shopify_delete_page',
] as const

describe('Shopify MCP tool coverage', () => {
  it('registers the expected tool surface', () => {
    expect(SHOPIFY_TOOL_NAMES).toEqual(EXPECTED_TOOL_NAMES)
  })

  it('registers each tool exactly once', () => {
    expect(new Set(SHOPIFY_TOOL_NAMES).size).toBe(EXPECTED_TOOL_NAMES.length)
  })
})
