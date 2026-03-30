import { z } from 'zod'

// ---- Product Schemas ----

export const GetProductsSchema = z.object({
  searchTitle: z.string().optional(),
  limit: z.number().default(10),
  after: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response\'s pageInfo.endCursor'),
})

export const GetProductByIdSchema = z.object({
  productId: z.string().min(1),
})

export const CreateProductSchema = z.object({
  title: z.string().min(1),
  descriptionHtml: z.string().optional(),
  handle: z
    .string()
    .optional()
    .describe('URL slug. Auto-generated from title if omitted.'),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('DRAFT'),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional()
    .describe('SEO title and description'),
  metafields: z
    .array(
      z.object({
        namespace: z.string(),
        key: z.string(),
        value: z.string(),
        type: z
          .string()
          .describe("e.g. 'single_line_text_field', 'json', 'number_integer'"),
      }),
    )
    .optional(),
  productOptions: z
    .array(
      z.object({
        name: z.string().describe("Option name, e.g. 'Size'"),
        values: z.array(z.object({ name: z.string() })).optional(),
      }),
    )
    .optional()
    .describe('Product options to create inline (max 3)'),
  collectionsToJoin: z
    .array(z.string())
    .optional()
    .describe('Collection GIDs to add product to'),
})

export const UpdateProductSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe('Shopify product GID, e.g. gid://shopify/Product/123'),
  title: z.string().optional(),
  descriptionHtml: z.string().optional(),
  handle: z.string().optional().describe('URL slug for the product'),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional()
    .describe('SEO title and description'),
  metafields: z
    .array(
      z.object({
        id: z.string().optional(),
        namespace: z.string().optional(),
        key: z.string().optional(),
        value: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  collectionsToJoin: z
    .array(z.string())
    .optional()
    .describe('Collection GIDs to add product to'),
  collectionsToLeave: z
    .array(z.string())
    .optional()
    .describe('Collection GIDs to remove product from'),
  redirectNewHandle: z
    .boolean()
    .optional()
    .describe('If true, old handle redirects to new handle'),
})

export const DeleteProductSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe('Shopify product GID, e.g. gid://shopify/Product/123'),
})

export const ManageProductVariantsSchema = z.object({
  productId: z.string().min(1).describe('Shopify product GID'),
  variants: z
    .array(
      z.object({
        id: z
          .string()
          .optional()
          .describe('Variant GID for updates. Omit to create new.'),
        price: z.string().optional().describe("Price as string, e.g. '49.00'"),
        compareAtPrice: z
          .string()
          .optional()
          .describe('Compare-at price for showing discounts'),
        sku: z
          .string()
          .optional()
          .describe('SKU (mapped to inventoryItem.sku)'),
        tracked: z
          .boolean()
          .optional()
          .describe(
            'Whether inventory is tracked. Set false for print-on-demand.',
          ),
        taxable: z.boolean().optional(),
        barcode: z.string().optional(),
        optionValues: z
          .array(
            z.object({
              optionName: z.string().describe("Option name, e.g. 'Size'"),
              name: z.string().describe("Option value, e.g. '8x10'"),
            }),
          )
          .optional(),
      }),
    )
    .min(1)
    .describe('Variants to create or update'),
  strategy: z
    .enum([
      'DEFAULT',
      'REMOVE_STANDALONE_VARIANT',
      'PRESERVE_STANDALONE_VARIANT',
    ])
    .optional()
    .describe(
      'How to handle the Default Title variant when creating. DEFAULT removes it automatically.',
    ),
})

export const ManageProductOptionsSchema = z.object({
  productId: z.string().min(1).describe('Shopify product GID'),
  action: z.enum(['create', 'update', 'delete']),
  options: z
    .array(
      z.object({
        name: z.string().describe("Option name, e.g. 'Size'"),
        position: z.number().optional(),
        values: z
          .array(z.string())
          .optional()
          .describe("Option values, e.g. ['A4', 'A3']"),
      }),
    )
    .optional()
    .describe('Options to create (action=create)'),
  optionId: z
    .string()
    .optional()
    .describe('Option GID to update (action=update)'),
  name: z
    .string()
    .optional()
    .describe('New name for the option (action=update)'),
  position: z.number().optional().describe('New position (action=update)'),
  valuesToAdd: z
    .array(z.string())
    .optional()
    .describe('Values to add (action=update)'),
  valuesToDelete: z
    .array(z.string())
    .optional()
    .describe('Value GIDs to delete (action=update)'),
  optionIds: z
    .array(z.string())
    .optional()
    .describe('Option GIDs to delete (action=delete)'),
})

export const DeleteProductVariantsSchema = z.object({
  productId: z.string().min(1).describe('Shopify product GID'),
  variantIds: z
    .array(z.string().min(1))
    .min(1)
    .describe('Array of variant GIDs to delete'),
})

// ---- Customer Schemas ----

export const GetCustomersSchema = z.object({
  searchQuery: z.string().optional(),
  limit: z.number().default(10),
  after: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response\'s pageInfo.endCursor'),
})

export const UpdateCustomerSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'Customer ID must be numeric')
    .describe('Shopify customer ID, numeric excluding gid prefix'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().optional(),
  taxExempt: z.boolean().optional(),
  metafields: z
    .array(
      z.object({
        id: z.string().optional(),
        namespace: z.string().optional(),
        key: z.string().optional(),
        value: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
})

export const GetCustomerOrdersSchema = z.object({
  customerId: z
    .string()
    .regex(/^\d+$/, 'Customer ID must be numeric')
    .describe('Shopify customer ID, numeric excluding gid prefix'),
  limit: z.number().default(10),
  after: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response\'s pageInfo.endCursor'),
})

// ---- Order Schemas ----

export const GetOrdersSchema = z.object({
  status: z.enum(['any', 'open', 'closed', 'cancelled']).default('any'),
  limit: z.number().default(10),
  after: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response\'s pageInfo.endCursor'),
})

export const GetOrderByIdSchema = z.object({
  orderId: z.string().min(1),
})

export const UpdateOrderSchema = z.object({
  id: z.string().min(1),
  tags: z.array(z.string()).optional(),
  email: z.string().email().optional(),
  note: z.string().optional(),
  customAttributes: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  metafields: z
    .array(
      z.object({
        id: z.string().optional(),
        namespace: z.string().optional(),
        key: z.string().optional(),
        value: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  shippingAddress: z
    .object({
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      company: z.string().optional(),
      country: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      province: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional(),
})

// ---- Blog & Article Schemas ----

export const GetBlogsSchema = z.object({
  limit: z.number().default(10),
  after: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response\'s pageInfo.endCursor'),
})

export const GetBlogArticlesSchema = z.object({
  blogId: z.string().min(1).describe('Blog GID, e.g. gid://shopify/Blog/123'),
  limit: z.number().default(10),
  after: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response\'s pageInfo.endCursor'),
  published: z
    .boolean()
    .optional()
    .describe('Filter by published status. Omit for all articles.'),
})

export const GetArticleByIdSchema = z.object({
  articleId: z.string().min(1).describe('Article GID'),
})

export const SearchArticlesSchema = z.object({
  query: z.string().min(1).describe('Search query for articles'),
  limit: z.number().default(10),
  after: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response\'s pageInfo.endCursor'),
})

export const CreateArticleSchema = z.object({
  blogId: z.string().min(1).describe('Blog GID to publish the article under'),
  title: z.string().min(1),
  body: z.string().min(1).describe('HTML content of the article'),
  summary: z.string().optional().describe('Short summary/excerpt'),
  handle: z
    .string()
    .optional()
    .describe('URL slug. Auto-generated from title if omitted.'),
  author: z.string().optional().describe('Author display name'),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().default(false),
  publishDate: z
    .string()
    .optional()
    .describe('ISO 8601 datetime for scheduled publishing'),
  image: z
    .object({
      url: z.string().describe('Public URL of the image'),
      altText: z.string().optional(),
    })
    .optional(),
})

export const UpdateArticleSchema = z.object({
  id: z.string().min(1).describe('Article GID'),
  title: z.string().optional(),
  body: z.string().optional().describe('HTML content'),
  summary: z.string().optional(),
  handle: z.string().optional(),
  author: z.string().optional().describe('Author display name'),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  publishDate: z.string().optional(),
  image: z
    .object({
      url: z.string(),
      altText: z.string().optional(),
    })
    .optional(),
  redirectNewHandle: z
    .boolean()
    .optional()
    .describe('If true, old URL redirects to new handle'),
})

export const DeleteArticleSchema = z.object({
  id: z.string().min(1).describe('Article GID'),
})

export const CreateBlogSchema = z.object({
  title: z.string().min(1),
  handle: z.string().optional(),
  commentPolicy: z
    .enum(['MODERATED', 'UNMODERATED', 'CLOSED'])
    .optional(),
  templateSuffix: z.string().optional().describe('Custom template suffix'),
})

export const UpdateBlogSchema = z.object({
  id: z.string().min(1).describe('Blog GID'),
  title: z.string().optional(),
  handle: z.string().optional(),
  commentPolicy: z
    .enum(['MODERATED', 'UNMODERATED', 'CLOSED'])
    .optional(),
  templateSuffix: z.string().optional(),
})

export const DeleteBlogSchema = z.object({
  id: z.string().min(1).describe('Blog GID'),
})

// ---- Page Schemas ----

export const GetPagesSchema = z.object({
  limit: z.number().default(10),
  after: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response\'s pageInfo.endCursor'),
  searchTitle: z.string().optional(),
})

export const GetPageByIdSchema = z.object({
  pageId: z.string().min(1).describe('Page GID'),
})

export const CreatePageSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1).describe('HTML content of the page'),
  handle: z.string().optional(),
  isPublished: z.boolean().default(false),
  templateSuffix: z.string().optional(),
  metafields: z
    .array(
      z.object({
        namespace: z.string(),
        key: z.string(),
        value: z.string(),
        type: z.string(),
      }),
    )
    .optional(),
})

export const UpdatePageSchema = z.object({
  id: z.string().min(1).describe('Page GID'),
  title: z.string().optional(),
  body: z.string().optional(),
  handle: z.string().optional(),
  isPublished: z.boolean().optional(),
  templateSuffix: z.string().optional(),
  metafields: z
    .array(
      z.object({
        id: z.string().optional(),
        namespace: z.string().optional(),
        key: z.string().optional(),
        value: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
})

export const DeletePageSchema = z.object({
  id: z.string().min(1).describe('Page GID'),
})
