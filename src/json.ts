type JsonRecord = Record<string, unknown>

const FALLBACK_JSON_SPACING = 2
const MAX_DESCRIPTION_LENGTH = 220
const MAX_LINE_ITEMS = 3
const MAX_VARIANTS = 5
const MAX_OPTIONS = 5
const MAX_TAGS = 5
const MAX_METAFIELDS = 5

function jsonReplacer(_key: string, currentValue: unknown): unknown {
  if (typeof currentValue === 'bigint') {
    return currentValue.toString()
  }

  return currentValue
}

function fallbackJson(value: unknown): string {
  const result = JSON.stringify(value, jsonReplacer, FALLBACK_JSON_SPACING)
  return result ?? 'null'
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): JsonRecord | undefined {
  return isRecord(value) ? value : undefined
}

function asRecordArray(value: unknown): JsonRecord[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter(isRecord)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function extractIdTail(id: string | undefined): string | undefined {
  if (!id) {
    return undefined
  }

  const segments = id.split('/')
  return segments[segments.length - 1] || id
}

function formatDate(value: unknown): string | undefined {
  const raw = asString(value)
  if (!raw) {
    return undefined
  }

  return raw.length >= 10 ? raw.slice(0, 10) : raw
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncateText(value: string | undefined, maxLength = MAX_DESCRIPTION_LENGTH): string | undefined {
  if (!value) {
    return undefined
  }

  const normalized = stripHtml(value)
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' | ')
}

function formatMoney(value: unknown): string | undefined {
  const money = asRecord(value)
  const amount = asString(money?.amount)
  const currencyCode = asString(money?.currencyCode)

  if (!amount) {
    return undefined
  }

  return currencyCode ? `${amount} ${currencyCode}` : amount
}

function formatPriceRange(value: unknown): string | undefined {
  const priceRange = asRecord(value)
  const minPrice = formatMoney(priceRange?.minPrice)
  const maxPrice = formatMoney(priceRange?.maxPrice)

  if (!minPrice && !maxPrice) {
    return undefined
  }

  if (minPrice && maxPrice && minPrice !== maxPrice) {
    return `${minPrice} to ${maxPrice}`
  }

  return minPrice ?? maxPrice
}

function formatCustomerInline(value: unknown): string | undefined {
  const customer = asRecord(value)
  if (!customer) {
    return undefined
  }

  const name = [asString(customer.firstName), asString(customer.lastName)]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
  const email = asString(customer.email)

  if (name && email) {
    return `${name} <${email}>`
  }

  return name || email || extractIdTail(asString(customer.id))
}

function formatAddressInline(value: unknown): string | undefined {
  const address = asRecord(value)
  if (!address) {
    return undefined
  }

  return joinParts([
    asString(address.address1),
    asString(address.city),
    asString(address.provinceCode) ?? asString(address.province),
    asString(address.zip),
    asString(address.country),
  ])
}

function formatVariantInline(variant: JsonRecord): string {
  const optionText = asRecordArray(variant.options)
    ?.map((option) => joinParts([asString(option.name), asString(option.value)]))
    .filter((item) => item.length > 0)
    .join(', ')

  return joinParts([
    asString(variant.title),
    optionText,
    formatMoney(asRecord(variant.price) ?? { amount: variant.price, currencyCode: undefined }),
    asString(variant.sku) ? `SKU ${asString(variant.sku)}` : undefined,
    asNumber(variant.inventoryQuantity) !== undefined
      ? `Inventory ${String(asNumber(variant.inventoryQuantity))}`
      : undefined,
  ])
}

function formatLineItemInline(lineItem: JsonRecord): string {
  const quantity = asNumber(lineItem.quantity)
  const variant = asRecord(lineItem.variant)

  return joinParts([
    quantity !== undefined ? `${quantity}x ${asString(lineItem.title) ?? 'item'}` : asString(lineItem.title),
    formatMoney(lineItem.originalTotal),
    asString(variant?.sku) ? `SKU ${asString(variant?.sku)}` : undefined,
    asString(variant?.title) && asString(variant?.title) !== 'Default Title'
      ? `Variant ${asString(variant?.title)}`
      : undefined,
  ])
}

function formatMetafields(value: unknown): string | undefined {
  const metafields = asRecordArray(value)
  if (!metafields || metafields.length === 0) {
    return undefined
  }

  const preview = metafields.slice(0, MAX_METAFIELDS).map((metafield) => {
    const namespace = asString(metafield.namespace)
    const key = asString(metafield.key)
    const metafieldValue = truncateText(asString(metafield.value), 60)
    return joinParts([
      namespace && key ? `${namespace}.${key}` : key,
      metafieldValue,
    ])
  })

  const suffix =
    metafields.length > MAX_METAFIELDS
      ? ` (+${metafields.length - MAX_METAFIELDS} more)`
      : ''

  return `Metafields: ${preview.join('; ')}${suffix}`
}

function formatTags(value: unknown): string | undefined {
  const tags = asStringArray(value)
  if (tags.length === 0) {
    return undefined
  }

  const preview = tags.slice(0, MAX_TAGS).join(', ')
  const suffix = tags.length > MAX_TAGS ? ` (+${tags.length - MAX_TAGS} more)` : ''
  return `Tags: ${preview}${suffix}`
}

function formatProducts(products: JsonRecord[]): string {
  if (products.length === 0) {
    return 'Products (0)\nNo products found.'
  }

  const lines = [`Products (${products.length})`]

  for (const [index, product] of products.entries()) {
    lines.push(`${index + 1}. ${asString(product.title) ?? 'Untitled product'}${asString(product.status) ? ` [${asString(product.status)}]` : ''}`)
    lines.push(
      `   ${joinParts([
        asString(product.handle) ? `Handle ${asString(product.handle)}` : undefined,
        formatPriceRange(product.priceRange),
        asNumber(product.totalInventory) !== undefined
          ? `Inventory ${String(asNumber(product.totalInventory))}`
          : undefined,
        formatDate(product.updatedAt) ? `Updated ${formatDate(product.updatedAt)}` : undefined,
      ])}`,
    )

    const variants = asRecordArray(product.variants) ?? []
    if (variants.length > 0) {
      const preview = variants
        .slice(0, MAX_VARIANTS)
        .map((variant) => formatVariantInline(variant))
        .join('; ')
      const suffix = variants.length > MAX_VARIANTS ? ` (+${variants.length - MAX_VARIANTS} more)` : ''
      lines.push(`   Variants: ${preview}${suffix}`)
    }

    const summary = truncateText(asString(product.description))
    if (summary) {
      lines.push(`   Summary: ${summary}`)
    }
  }

  return lines.join('\n')
}

function formatProduct(product: JsonRecord): string {
  const lines = [
    `Product: ${asString(product.title) ?? 'Untitled product'}${asString(product.status) ? ` [${asString(product.status)}]` : ''}`,
    joinParts([
      extractIdTail(asString(product.id)) ? `ID ${extractIdTail(asString(product.id))}` : undefined,
      asString(product.handle) ? `Handle ${asString(product.handle)}` : undefined,
      formatPriceRange(product.priceRange),
      asNumber(product.totalInventory) !== undefined
        ? `Inventory ${String(asNumber(product.totalInventory))}`
        : undefined,
    ]),
  ].filter((line) => line.length > 0)

  const metadataLine = joinParts([
    asString(product.vendor) ? `Vendor ${asString(product.vendor)}` : undefined,
    asString(product.productType) ? `Type ${asString(product.productType)}` : undefined,
    formatDate(product.createdAt) ? `Created ${formatDate(product.createdAt)}` : undefined,
    formatDate(product.updatedAt) ? `Updated ${formatDate(product.updatedAt)}` : undefined,
  ])
  if (metadataLine) {
    lines.push(metadataLine)
  }

  const summary = truncateText(
    asString(product.description) ?? asString(product.descriptionHtml),
  )
  if (summary) {
    lines.push(`Summary: ${summary}`)
  }

  const options = asRecordArray(product.options) ?? []
  if (options.length > 0) {
    const preview = options.slice(0, MAX_OPTIONS).map((option) => {
      const values = asStringArray(option.values)
      return values.length > 0
        ? `${asString(option.name) ?? 'Option'} (${values.join(', ')})`
        : (asString(option.name) ?? 'Option')
    })
    const suffix = options.length > MAX_OPTIONS ? ` (+${options.length - MAX_OPTIONS} more)` : ''
    lines.push(`Options: ${preview.join('; ')}${suffix}`)
  }

  const variants = asRecordArray(product.variants) ?? asRecordArray(product.remainingVariants) ?? []
  if (variants.length > 0) {
    const preview = variants
      .slice(0, MAX_VARIANTS)
      .map((variant) => formatVariantInline(variant))
      .join('; ')
    const suffix = variants.length > MAX_VARIANTS ? ` (+${variants.length - MAX_VARIANTS} more)` : ''
    lines.push(`Variants: ${preview}${suffix}`)
  }

  const collections = asRecordArray(product.collections) ?? []
  if (collections.length > 0) {
    lines.push(
      `Collections: ${collections.map((collection) => asString(collection.title)).filter((value): value is string => Boolean(value)).join(', ')}`,
    )
  }

  const imageUrl = asString(product.imageUrl)
  const images = asRecordArray(product.images) ?? []
  if (imageUrl) {
    lines.push(`Primary image: ${imageUrl}`)
  } else if (images.length > 0) {
    const firstImage = asString(images[0]?.url)
    if (firstImage) {
      lines.push(`Primary image: ${firstImage}`)
    }
  }

  const tags = formatTags(product.tags)
  if (tags) {
    lines.push(tags)
  }

  const metafields = formatMetafields(product.metafields)
  if (metafields) {
    lines.push(metafields)
  }

  return lines.join('\n')
}

function formatCustomers(customers: JsonRecord[]): string {
  if (customers.length === 0) {
    return 'Customers (0)\nNo customers found.'
  }

  const lines = [`Customers (${customers.length})`]

  for (const [index, customer] of customers.entries()) {
    lines.push(`${index + 1}. ${formatCustomerInline(customer) ?? 'Unnamed customer'}`)
    lines.push(
      `   ${joinParts([
        asNumber(customer.numberOfOrders) !== undefined
          ? `${String(asNumber(customer.numberOfOrders))} orders`
          : undefined,
        formatMoney(customer.amountSpent),
        formatDate(customer.updatedAt) ? `Updated ${formatDate(customer.updatedAt)}` : undefined,
      ])}`,
    )

    const address = formatAddressInline(customer.defaultAddress)
    if (address) {
      lines.push(`   Default address: ${address}`)
    }

    const tags = formatTags(customer.tags)
    if (tags) {
      lines.push(`   ${tags}`)
    }
  }

  return lines.join('\n')
}

function formatCustomer(customer: JsonRecord): string {
  const lines = [
    `Customer: ${formatCustomerInline(customer) ?? 'Unnamed customer'}`,
    joinParts([
      extractIdTail(asString(customer.id)) ? `ID ${extractIdTail(asString(customer.id))}` : undefined,
      asString(customer.phone) ? `Phone ${asString(customer.phone)}` : undefined,
      asBoolean(customer.taxExempt) !== undefined
        ? `Tax exempt ${asBoolean(customer.taxExempt) ? 'yes' : 'no'}`
        : undefined,
    ]),
  ].filter((line) => line.length > 0)

  const note = truncateText(asString(customer.note), 160)
  if (note) {
    lines.push(`Note: ${note}`)
  }

  const tags = formatTags(customer.tags)
  if (tags) {
    lines.push(tags)
  }

  const address = formatAddressInline(customer.defaultAddress)
  if (address) {
    lines.push(`Default address: ${address}`)
  }

  const metafields = formatMetafields(customer.metafields)
  if (metafields) {
    lines.push(metafields)
  }

  return lines.join('\n')
}

function formatOrders(orders: JsonRecord[]): string {
  if (orders.length === 0) {
    return 'Orders (0)\nNo orders found.'
  }

  const lines = [`Orders (${orders.length})`]

  for (const [index, order] of orders.entries()) {
    lines.push(`${index + 1}. ${asString(order.name) ?? extractIdTail(asString(order.id)) ?? 'Order'}${joinParts([
      asString(order.financialStatus),
      asString(order.fulfillmentStatus),
      formatDate(order.createdAt),
      formatMoney(order.totalPrice),
    ]) ? ` - ${joinParts([
      asString(order.financialStatus),
      asString(order.fulfillmentStatus),
      formatDate(order.createdAt),
      formatMoney(order.totalPrice),
    ])}` : ''}`)

    const customer = formatCustomerInline(order.customer)
    if (customer) {
      lines.push(`   Customer: ${customer}`)
    }

    const shipping = formatAddressInline(order.shippingAddress)
    if (shipping) {
      lines.push(`   Shipping: ${shipping}`)
    }

    const lineItems = asRecordArray(order.lineItems) ?? []
    if (lineItems.length > 0) {
      const preview = lineItems
        .slice(0, MAX_LINE_ITEMS)
        .map((lineItem) => formatLineItemInline(lineItem))
        .join('; ')
      const suffix = lineItems.length > MAX_LINE_ITEMS ? ` (+${lineItems.length - MAX_LINE_ITEMS} more)` : ''
      lines.push(`   Items: ${preview}${suffix}`)
    }

    const tags = formatTags(order.tags)
    if (tags) {
      lines.push(`   ${tags}`)
    }

    const note = truncateText(asString(order.note), 140)
    if (note) {
      lines.push(`   Note: ${note}`)
    }
  }

  return lines.join('\n')
}

function formatOrder(order: JsonRecord): string {
  const lines = [
    `Order: ${asString(order.name) ?? extractIdTail(asString(order.id)) ?? 'Order'}`,
    joinParts([
      extractIdTail(asString(order.id)) ? `ID ${extractIdTail(asString(order.id))}` : undefined,
      asString(order.financialStatus),
      asString(order.fulfillmentStatus),
      formatDate(order.createdAt),
      formatMoney(order.totalPrice),
    ]),
  ].filter((line) => line.length > 0)

  const pricing = joinParts([
    formatMoney(order.subtotalPrice) ? `Subtotal ${formatMoney(order.subtotalPrice)}` : undefined,
    formatMoney(order.totalShippingPrice)
      ? `Shipping ${formatMoney(order.totalShippingPrice)}`
      : undefined,
    formatMoney(order.totalTax) ? `Tax ${formatMoney(order.totalTax)}` : undefined,
  ])
  if (pricing) {
    lines.push(pricing)
  }

  const customer = formatCustomerInline(order.customer)
  if (customer) {
    lines.push(`Customer: ${customer}`)
  }

  const shipping = formatAddressInline(order.shippingAddress)
  if (shipping) {
    lines.push(`Shipping: ${shipping}`)
  }

  const lineItems = asRecordArray(order.lineItems) ?? []
  if (lineItems.length > 0) {
    const preview = lineItems
      .slice(0, MAX_LINE_ITEMS)
      .map((lineItem) => formatLineItemInline(lineItem))
      .join('; ')
    const suffix = lineItems.length > MAX_LINE_ITEMS ? ` (+${lineItems.length - MAX_LINE_ITEMS} more)` : ''
    lines.push(`Items: ${preview}${suffix}`)
  }

  const tags = formatTags(order.tags)
  if (tags) {
    lines.push(tags)
  }

  const note = truncateText(asString(order.note), 160)
  if (note) {
    lines.push(`Note: ${note}`)
  }

  const metafields = formatMetafields(order.metafields)
  if (metafields) {
    lines.push(metafields)
  }

  return lines.join('\n')
}

function formatVariantChanges(result: JsonRecord): string {
  const created = asRecordArray(result.created) ?? []
  const updated = asRecordArray(result.updated) ?? []
  const lines = ['Variant changes']

  if (created.length === 0 && updated.length === 0) {
    lines.push('No variant changes were returned.')
    return lines.join('\n')
  }

  if (created.length > 0) {
    lines.push(`Created (${created.length}): ${created.map((variant) => formatVariantInline(variant)).join('; ')}`)
  }

  if (updated.length > 0) {
    lines.push(`Updated (${updated.length}): ${updated.map((variant) => formatVariantInline(variant)).join('; ')}`)
  }

  return lines.join('\n')
}

function formatDeletion(result: JsonRecord): string | undefined {
  if (!('deletedProductId' in result)) {
    return undefined
  }

  const deletedProductId = asString(result.deletedProductId)
  if (!deletedProductId) {
    return 'Delete completed, but Shopify did not return a deleted product ID.'
  }

  return `Deleted product ${extractIdTail(deletedProductId) ?? deletedProductId}.`
}

function formatStructuredResult(value: unknown): string | undefined {
  const record = asRecord(value)
  if (!record) {
    return undefined
  }

  const deletion = formatDeletion(record)
  if (deletion) {
    return deletion
  }

  const products = asRecordArray(record.products)
  if (products) {
    return formatProducts(products)
  }

  const product = asRecord(record.product)
  if (product) {
    return formatProduct(product)
  }

  const customers = asRecordArray(record.customers)
  if (customers) {
    return formatCustomers(customers)
  }

  const customer = asRecord(record.customer)
  if (customer) {
    return formatCustomer(customer)
  }

  const orders = asRecordArray(record.orders)
  if (orders) {
    return formatOrders(orders)
  }

  const order = asRecord(record.order)
  if (order) {
    return formatOrder(order)
  }

  if ('created' in record || 'updated' in record) {
    return formatVariantChanges(record)
  }

  return undefined
}

export function stringifyResult(value: unknown): string {
  return formatStructuredResult(value) ?? fallbackJson(value)
}
