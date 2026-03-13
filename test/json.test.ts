import { describe, expect, it } from 'vitest'
import { stringifyResult } from '../src/json.js'

describe('stringifyResult', () => {
  it('formats product lists into compact natural language', () => {
    const result = stringifyResult({
      products: [
        {
          id: 'gid://shopify/Product/5886466567',
          title: 'Kathy Smith Exclusive Yoga Mat',
          description:
            "What are the benefits? Yoga will improve your balance, strength, coordination, flexibility, cardiovascular health, and physical confidence.",
          handle: 'kathy-smith-yoga-mat',
          status: 'ACTIVE',
          updatedAt: '2025-09-22T14:25:05Z',
          totalInventory: 0,
          priceRange: {
            minPrice: { amount: '19.99', currencyCode: 'USD' },
            maxPrice: { amount: '19.99', currencyCode: 'USD' },
          },
          variants: [
            {
              id: 'gid://shopify/ProductVariant/18585742727',
              title: 'Default Title',
              price: '19.99',
              inventoryQuantity: 0,
              sku: 'DS-yoga-config',
            },
          ],
        },
      ],
    })

    expect(result).toContain('Products (1)')
    expect(result).toContain('Kathy Smith Exclusive Yoga Mat [ACTIVE]')
    expect(result).toContain('Handle kathy-smith-yoga-mat')
    expect(result).toContain('19.99 USD')
    expect(result).toContain('SKU DS-yoga-config')
    expect(result).toContain('Summary:')
    expect(result).not.toContain('"products"')
  })

  it('formats order lists into compact natural language', () => {
    const result = stringifyResult({
      orders: [
        {
          id: 'gid://shopify/Order/6534298960096',
          name: '#77404',
          createdAt: '2026-01-12T13:11:55Z',
          financialStatus: 'PAID',
          fulfillmentStatus: 'FULFILLED',
          totalPrice: { amount: '21.6', currencyCode: 'USD' },
          customer: {
            id: 'gid://shopify/Customer/3743891095717',
            firstName: 'Sharon',
            lastName: 'Example',
            email: 'sharon@example.com',
          },
          lineItems: [
            {
              id: 'gid://shopify/LineItem/15874724528352',
              title: '6 Week Leanwalk Program',
              quantity: 1,
              originalTotal: { amount: '27.0', currencyCode: 'USD' },
              variant: {
                id: 'gid://shopify/ProductVariant/35989516103',
                title: 'Default Title',
                sku: 'LISTENANDLOSE',
              },
            },
          ],
          tags: ['nofraud_pass'],
        },
      ],
    })

    expect(result).toContain('Orders (1)')
    expect(result).toContain('#77404 - PAID | FULFILLED | 2026-01-12 | 21.6 USD')
    expect(result).toContain('Customer: Sharon Example <sharon@example.com>')
    expect(result).toContain('Items: 1x 6 Week Leanwalk Program | 27.0 USD | SKU LISTENANDLOSE')
    expect(result).toContain('Tags: nofraud_pass')
    expect(result).not.toContain('"orders"')
  })

  it('falls back to json for unknown result shapes', () => {
    const result = stringifyResult({
      success: true,
      count: 3,
    })

    expect(result).toContain('"success": true')
    expect(result).toContain('"count": 3')
  })
})
