import type { GraphQLClient } from 'graphql-request'
import { gql } from 'graphql-request'
import type { FastMCP } from '@missionsquad/fastmcp'
import { z } from 'zod'
import { ShopifyApiError, toUserError } from './errors.js'
import { stringifyResult } from './json.js'
import { logger } from './logger.js'
import { createShopifyClient } from './shopify-client.js'
import {
  GetProductsSchema,
  GetProductByIdSchema,
  CreateProductSchema,
  UpdateProductSchema,
  DeleteProductSchema,
  ManageProductVariantsSchema,
  ManageProductOptionsSchema,
  DeleteProductVariantsSchema,
  GetCustomersSchema,
  UpdateCustomerSchema,
  GetCustomerOrdersSchema,
  GetOrdersSchema,
  GetOrderByIdSchema,
  UpdateOrderSchema,
  GetBlogsSchema,
  GetBlogArticlesSchema,
  GetArticleByIdSchema,
  SearchArticlesSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
  DeleteArticleSchema,
  CreateBlogSchema,
  UpdateBlogSchema,
  DeleteBlogSchema,
  GetPagesSchema,
  GetPageByIdSchema,
  CreatePageSchema,
  UpdatePageSchema,
  DeletePageSchema,
} from './schemas.js'

type ToolParams = z.ZodTypeAny

interface ShopifyToolDefinition<TParams extends ToolParams> {
  name: string
  description: string
  parameters: TParams
  run: (client: GraphQLClient, args: z.infer<TParams>) => Promise<unknown>
}

function defineTool<TParams extends ToolParams>(
  definition: ShopifyToolDefinition<TParams>,
): ShopifyToolDefinition<TParams> {
  return definition
}

// ---- GraphQL Fragment for Product Options ----

const PRODUCT_OPTIONS_FRAGMENT = gql`
  fragment ProductOptionsFields on Product {
    id
    title
    options {
      id
      name
      position
      optionValues {
        id
        name
        hasVariants
      }
    }
    variants(first: 20) {
      edges {
        node {
          id
          title
          price
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
`

function formatProductOptionsResponse(product: any) {
  return {
    product: {
      id: product.id,
      title: product.title,
      options: product.options.map((o: any) => ({
        id: o.id,
        name: o.name,
        position: o.position,
        values: o.optionValues.map((v: any) => ({
          id: v.id,
          name: v.name,
          hasVariants: v.hasVariants,
        })),
      })),
      variants: product.variants.edges.map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        price: e.node.price,
        options: e.node.selectedOptions,
      })),
    },
  }
}

// ---- Tool Definitions ----

const shopifyTools = [
  // ---- Products ----

  defineTool({
    name: 'shopify_get_products',
    description: 'Get all products or search by title from a Shopify store.',
    parameters: GetProductsSchema,
    run: async (client, args) => {
      const { searchTitle, limit } = args

      const query = gql`
        query GetProducts($first: Int!, $query: String) {
          products(first: $first, query: $query) {
            edges {
              node {
                id
                title
                description
                handle
                status
                createdAt
                updatedAt
                totalInventory
                priceRangeV2 {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                  maxVariantPrice {
                    amount
                    currencyCode
                  }
                }
                images(first: 1) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 5) {
                  edges {
                    node {
                      id
                      title
                      price
                      inventoryQuantity
                      sku
                    }
                  }
                }
              }
            }
          }
        }
      `

      const variables = {
        first: limit,
        query: searchTitle ? `title:*${searchTitle}*` : undefined,
      }

      const data = (await client.request(query, variables)) as {
        products: any
      }

      const products = data.products.edges.map((edge: any) => {
        const product = edge.node

        const variants = product.variants.edges.map((variantEdge: any) => ({
          id: variantEdge.node.id,
          title: variantEdge.node.title,
          price: variantEdge.node.price,
          inventoryQuantity: variantEdge.node.inventoryQuantity,
          sku: variantEdge.node.sku,
        }))

        const imageUrl =
          product.images.edges.length > 0
            ? product.images.edges[0].node.url
            : null

        return {
          id: product.id,
          title: product.title,
          description: product.description,
          handle: product.handle,
          status: product.status,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          totalInventory: product.totalInventory,
          priceRange: {
            minPrice: {
              amount: product.priceRangeV2.minVariantPrice.amount,
              currencyCode:
                product.priceRangeV2.minVariantPrice.currencyCode,
            },
            maxPrice: {
              amount: product.priceRangeV2.maxVariantPrice.amount,
              currencyCode:
                product.priceRangeV2.maxVariantPrice.currencyCode,
            },
          },
          imageUrl,
          variants,
        }
      })

      return { products }
    },
  }),

  defineTool({
    name: 'shopify_get_product_by_id',
    description: 'Get a specific product by ID with full details.',
    parameters: GetProductByIdSchema,
    run: async (client, args) => {
      const { productId } = args

      const query = gql`
        query GetProductById($id: ID!) {
          product(id: $id) {
            id
            title
            description
            handle
            status
            createdAt
            updatedAt
            totalInventory
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 5) {
              edges {
                node {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 20) {
              edges {
                node {
                  id
                  title
                  price
                  inventoryQuantity
                  sku
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
            collections(first: 5) {
              edges {
                node {
                  id
                  title
                }
              }
            }
            tags
            vendor
          }
        }
      `

      const data = (await client.request(query, { id: productId })) as {
        product: any
      }

      if (!data.product) {
        throw new Error(`Product with ID ${productId} not found`)
      }

      const product = data.product

      const variants = product.variants.edges.map((variantEdge: any) => ({
        id: variantEdge.node.id,
        title: variantEdge.node.title,
        price: variantEdge.node.price,
        inventoryQuantity: variantEdge.node.inventoryQuantity,
        sku: variantEdge.node.sku,
        options: variantEdge.node.selectedOptions,
      }))

      const images = product.images.edges.map((imageEdge: any) => ({
        id: imageEdge.node.id,
        url: imageEdge.node.url,
        altText: imageEdge.node.altText,
        width: imageEdge.node.width,
        height: imageEdge.node.height,
      }))

      const collections = product.collections.edges.map(
        (collectionEdge: any) => ({
          id: collectionEdge.node.id,
          title: collectionEdge.node.title,
        }),
      )

      return {
        product: {
          id: product.id,
          title: product.title,
          description: product.description,
          handle: product.handle,
          status: product.status,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          totalInventory: product.totalInventory,
          priceRange: {
            minPrice: {
              amount: product.priceRangeV2.minVariantPrice.amount,
              currencyCode:
                product.priceRangeV2.minVariantPrice.currencyCode,
            },
            maxPrice: {
              amount: product.priceRangeV2.maxVariantPrice.amount,
              currencyCode:
                product.priceRangeV2.maxVariantPrice.currencyCode,
            },
          },
          images,
          variants,
          collections,
          tags: product.tags,
          vendor: product.vendor,
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_create_product',
    description:
      'Create a new product. When using productOptions, Shopify registers all option values but only creates one default variant (first value of each option, price $0). Use shopify_manage_product_variants with strategy=REMOVE_STANDALONE_VARIANT afterward to create all real variants with prices.',
    parameters: CreateProductSchema,
    run: async (client, args) => {
      const query = gql`
        mutation productCreate(
          $product: ProductCreateInput!
          $media: [CreateMediaInput!]
        ) {
          productCreate(product: $product, media: $media) {
            product {
              id
              title
              handle
              descriptionHtml
              vendor
              productType
              status
              tags
              seo {
                title
                description
              }
              options {
                id
                name
                values
              }
              metafields(first: 10) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `

      const variables: Record<string, any> = {
        product: args,
      }

      const data = (await client.request(query, variables)) as {
        productCreate: {
          product: any
          userErrors: Array<{ field: string; message: string }>
        }
      }

      if (data.productCreate.userErrors.length > 0) {
        throw new ShopifyApiError(
          'Shopify productCreate mutation returned user errors',
          data.productCreate.userErrors,
        )
      }

      const product = data.productCreate.product

      return {
        product: {
          id: product.id,
          title: product.title,
          handle: product.handle,
          descriptionHtml: product.descriptionHtml,
          vendor: product.vendor,
          productType: product.productType,
          status: product.status,
          tags: product.tags,
          seo: product.seo,
          options: product.options,
          metafields:
            product.metafields?.edges.map((e: any) => e.node) || [],
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_update_product',
    description:
      "Update an existing product's fields (title, description, status, tags, etc.).",
    parameters: UpdateProductSchema,
    run: async (client, args) => {
      const { id, ...productFields } = args

      const query = gql`
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              title
              handle
              descriptionHtml
              vendor
              productType
              status
              tags
              seo {
                title
                description
              }
              metafields(first: 10) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
                }
              }
              variants(first: 20) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `

      const data = (await client.request(query, {
        input: { id, ...productFields },
      })) as {
        productUpdate: {
          product: any
          userErrors: Array<{ field: string; message: string }>
        }
      }

      if (data.productUpdate.userErrors.length > 0) {
        throw new ShopifyApiError(
          'Shopify productUpdate mutation returned user errors',
          data.productUpdate.userErrors,
        )
      }

      const product = data.productUpdate.product

      return {
        product: {
          id: product.id,
          title: product.title,
          handle: product.handle,
          descriptionHtml: product.descriptionHtml,
          vendor: product.vendor,
          productType: product.productType,
          status: product.status,
          tags: product.tags,
          seo: product.seo,
          metafields:
            product.metafields?.edges.map((e: any) => e.node) || [],
          variants:
            product.variants?.edges.map((e: any) => ({
              id: e.node.id,
              title: e.node.title,
              price: e.node.price,
              sku: e.node.sku,
              options: e.node.selectedOptions,
            })) || [],
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_delete_product',
    description: 'Delete a product by its GID.',
    parameters: DeleteProductSchema,
    run: async (client, args) => {
      const query = gql`
        mutation productDelete($input: ProductDeleteInput!) {
          productDelete(input: $input) {
            deletedProductId
            userErrors {
              field
              message
            }
          }
        }
      `

      const data = (await client.request(query, {
        input: { id: args.id },
      })) as {
        productDelete: {
          deletedProductId: string | null
          userErrors: Array<{ field: string; message: string }>
        }
      }

      if (data.productDelete.userErrors.length > 0) {
        throw new ShopifyApiError(
          'Shopify productDelete mutation returned user errors',
          data.productDelete.userErrors,
        )
      }

      return { deletedProductId: data.productDelete.deletedProductId }
    },
  }),

  defineTool({
    name: 'shopify_manage_product_variants',
    description:
      'Create or update product variants. Omit variant id to create new, include id to update existing.',
    parameters: ManageProductVariantsSchema,
    run: async (client, args) => {
      const { productId, variants } = args

      const toCreate = variants.filter((v) => !v.id)
      const toUpdate = variants.filter((v) => v.id)

      const results: { created: any[]; updated: any[] } = {
        created: [],
        updated: [],
      }

      if (toCreate.length > 0) {
        const createQuery = gql`
          mutation productVariantsBulkCreate(
            $productId: ID!
            $variants: [ProductVariantsBulkInput!]!
            $strategy: ProductVariantsBulkCreateStrategy
          ) {
            productVariantsBulkCreate(
              productId: $productId
              variants: $variants
              strategy: $strategy
            ) {
              productVariants {
                id
                title
                price
                sku
                selectedOptions {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `

        const createVariants = toCreate.map((v) => {
          const variant: Record<string, any> = {}
          if (v.price) variant.price = v.price
          if (v.compareAtPrice) variant.compareAtPrice = v.compareAtPrice
          if (v.barcode) variant.barcode = v.barcode
          if (v.taxable !== undefined) variant.taxable = v.taxable
          const inventoryItem: Record<string, any> = {}
          if (v.sku) inventoryItem.sku = v.sku
          if (v.tracked !== undefined) inventoryItem.tracked = v.tracked
          if (Object.keys(inventoryItem).length > 0)
            variant.inventoryItem = inventoryItem
          if (v.optionValues) {
            variant.optionValues = v.optionValues.map((ov) => ({
              optionName: ov.optionName,
              name: ov.name,
            }))
          }
          return variant
        })

        const createData = (await client.request(createQuery, {
          productId,
          variants: createVariants,
          ...(args.strategy && { strategy: args.strategy }),
        })) as {
          productVariantsBulkCreate: {
            productVariants: any[]
            userErrors: Array<{ field: string; message: string }>
          }
        }

        if (createData.productVariantsBulkCreate.userErrors.length > 0) {
          throw new ShopifyApiError(
            'Shopify productVariantsBulkCreate mutation returned user errors',
            createData.productVariantsBulkCreate.userErrors,
          )
        }

        results.created =
          createData.productVariantsBulkCreate.productVariants.map(
            (v: any) => ({
              id: v.id,
              title: v.title,
              price: v.price,
              sku: v.sku,
              options: v.selectedOptions,
            }),
          )
      }

      if (toUpdate.length > 0) {
        const updateQuery = gql`
          mutation productVariantsBulkUpdate(
            $productId: ID!
            $variants: [ProductVariantsBulkInput!]!
          ) {
            productVariantsBulkUpdate(
              productId: $productId
              variants: $variants
            ) {
              productVariants {
                id
                title
                price
                sku
                selectedOptions {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `

        const updateVariants = toUpdate.map((v) => {
          const variant: Record<string, any> = { id: v.id }
          if (v.price) variant.price = v.price
          if (v.compareAtPrice) variant.compareAtPrice = v.compareAtPrice
          if (v.barcode) variant.barcode = v.barcode
          if (v.taxable !== undefined) variant.taxable = v.taxable
          const inventoryItem: Record<string, any> = {}
          if (v.sku) inventoryItem.sku = v.sku
          if (v.tracked !== undefined) inventoryItem.tracked = v.tracked
          if (Object.keys(inventoryItem).length > 0)
            variant.inventoryItem = inventoryItem
          if (v.optionValues) {
            variant.optionValues = v.optionValues.map((ov) => ({
              optionName: ov.optionName,
              name: ov.name,
            }))
          }
          return variant
        })

        const updateData = (await client.request(updateQuery, {
          productId,
          variants: updateVariants,
        })) as {
          productVariantsBulkUpdate: {
            productVariants: any[]
            userErrors: Array<{ field: string; message: string }>
          }
        }

        if (updateData.productVariantsBulkUpdate.userErrors.length > 0) {
          throw new ShopifyApiError(
            'Shopify productVariantsBulkUpdate mutation returned user errors',
            updateData.productVariantsBulkUpdate.userErrors,
          )
        }

        results.updated =
          updateData.productVariantsBulkUpdate.productVariants.map(
            (v: any) => ({
              id: v.id,
              title: v.title,
              price: v.price,
              sku: v.sku,
              options: v.selectedOptions,
            }),
          )
      }

      return results
    },
  }),

  defineTool({
    name: 'shopify_manage_product_options',
    description:
      "Create, update, or delete product options (e.g. Size, Color). Use action='create' to add options, 'update' to rename or add/remove values, 'delete' to remove options.",
    parameters: ManageProductOptionsSchema,
    run: async (client, args) => {
      const { productId, action } = args

      if (action === 'create') {
        if (!args.options?.length) {
          throw new Error('options array is required for action=create')
        }

        const query = gql`
          mutation productOptionsCreate(
            $productId: ID!
            $options: [OptionCreateInput!]!
          ) {
            productOptionsCreate(
              productId: $productId
              options: $options
              variantStrategy: LEAVE_AS_IS
            ) {
              product {
                ...ProductOptionsFields
              }
              userErrors {
                field
                message
                code
              }
            }
          }
          ${PRODUCT_OPTIONS_FRAGMENT}
        `

        const options = args.options.map((o) => ({
          name: o.name,
          ...(o.position !== undefined && { position: o.position }),
          ...(o.values && {
            values: o.values.map((v) => ({ name: v })),
          }),
        }))

        const data = (await client.request(query, {
          productId,
          options,
        })) as {
          productOptionsCreate: {
            product: any
            userErrors: Array<{
              field: string
              message: string
              code?: string
            }>
          }
        }

        if (data.productOptionsCreate.userErrors.length > 0) {
          throw new ShopifyApiError(
            'Shopify productOptionsCreate mutation returned user errors',
            data.productOptionsCreate.userErrors,
          )
        }

        return formatProductOptionsResponse(
          data.productOptionsCreate.product,
        )
      }

      if (action === 'update') {
        if (!args.optionId) {
          throw new Error('optionId is required for action=update')
        }

        const query = gql`
          mutation productOptionUpdate(
            $productId: ID!
            $option: OptionUpdateInput!
            $optionValuesToAdd: [OptionValueCreateInput!]
            $optionValuesToDelete: [ID!]
          ) {
            productOptionUpdate(
              productId: $productId
              option: $option
              optionValuesToAdd: $optionValuesToAdd
              optionValuesToDelete: $optionValuesToDelete
            ) {
              product {
                ...ProductOptionsFields
              }
              userErrors {
                field
                message
                code
              }
            }
          }
          ${PRODUCT_OPTIONS_FRAGMENT}
        `

        const option: Record<string, any> = { id: args.optionId }
        if (args.name) option.name = args.name
        if (args.position !== undefined) option.position = args.position

        const variables: Record<string, any> = { productId, option }
        if (args.valuesToAdd?.length) {
          variables.optionValuesToAdd = args.valuesToAdd.map((v) => ({
            name: v,
          }))
        }
        if (args.valuesToDelete?.length) {
          variables.optionValuesToDelete = args.valuesToDelete
        }

        const data = (await client.request(query, variables)) as {
          productOptionUpdate: {
            product: any
            userErrors: Array<{
              field: string
              message: string
              code?: string
            }>
          }
        }

        if (data.productOptionUpdate.userErrors.length > 0) {
          throw new ShopifyApiError(
            'Shopify productOptionUpdate mutation returned user errors',
            data.productOptionUpdate.userErrors,
          )
        }

        return formatProductOptionsResponse(
          data.productOptionUpdate.product,
        )
      }

      if (action === 'delete') {
        if (!args.optionIds?.length) {
          throw new Error('optionIds array is required for action=delete')
        }

        const query = gql`
          mutation productOptionsDelete(
            $productId: ID!
            $options: [ID!]!
          ) {
            productOptionsDelete(
              productId: $productId
              options: $options
            ) {
              product {
                ...ProductOptionsFields
              }
              userErrors {
                field
                message
                code
              }
            }
          }
          ${PRODUCT_OPTIONS_FRAGMENT}
        `

        const data = (await client.request(query, {
          productId,
          options: args.optionIds,
        })) as {
          productOptionsDelete: {
            product: any
            userErrors: Array<{
              field: string
              message: string
              code?: string
            }>
          }
        }

        if (data.productOptionsDelete.userErrors.length > 0) {
          throw new ShopifyApiError(
            'Shopify productOptionsDelete mutation returned user errors',
            data.productOptionsDelete.userErrors,
          )
        }

        return formatProductOptionsResponse(
          data.productOptionsDelete.product,
        )
      }

      throw new Error(`Unknown action: ${action}`)
    },
  }),

  defineTool({
    name: 'shopify_delete_product_variants',
    description: 'Delete one or more variants from a product.',
    parameters: DeleteProductVariantsSchema,
    run: async (client, args) => {
      const { productId, variantIds } = args

      const query = gql`
        mutation productVariantsBulkDelete(
          $productId: ID!
          $variantsIds: [ID!]!
        ) {
          productVariantsBulkDelete(
            productId: $productId
            variantsIds: $variantsIds
          ) {
            product {
              id
              title
              variants(first: 20) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `

      const data = (await client.request(query, {
        productId,
        variantsIds: variantIds,
      })) as {
        productVariantsBulkDelete: {
          product: any
          userErrors: Array<{ field: string; message: string }>
        }
      }

      if (data.productVariantsBulkDelete.userErrors.length > 0) {
        throw new ShopifyApiError(
          'Shopify productVariantsBulkDelete mutation returned user errors',
          data.productVariantsBulkDelete.userErrors,
        )
      }

      const product = data.productVariantsBulkDelete.product

      return {
        product: {
          id: product.id,
          title: product.title,
          remainingVariants: product.variants.edges.map((e: any) => ({
            id: e.node.id,
            title: e.node.title,
            price: e.node.price,
            sku: e.node.sku,
            options: e.node.selectedOptions,
          })),
        },
      }
    },
  }),

  // ---- Customers ----

  defineTool({
    name: 'shopify_get_customers',
    description: 'Get customers or search by name/email.',
    parameters: GetCustomersSchema,
    run: async (client, args) => {
      const { searchQuery, limit } = args

      const query = gql`
        query GetCustomers($first: Int!, $query: String) {
          customers(first: $first, query: $query) {
            edges {
              node {
                id
                firstName
                lastName
                email
                phone
                createdAt
                updatedAt
                tags
                defaultAddress {
                  address1
                  address2
                  city
                  provinceCode
                  zip
                  country
                  phone
                }
                addresses {
                  address1
                  address2
                  city
                  provinceCode
                  zip
                  country
                  phone
                }
                amountSpent {
                  amount
                  currencyCode
                }
                numberOfOrders
              }
            }
          }
        }
      `

      const variables = {
        first: limit,
        query: searchQuery,
      }

      const data = (await client.request(query, variables)) as {
        customers: any
      }

      const customers = data.customers.edges.map((edge: any) => {
        const customer = edge.node
        return {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
          tags: customer.tags,
          defaultAddress: customer.defaultAddress,
          addresses: customer.addresses,
          amountSpent: customer.amountSpent,
          numberOfOrders: customer.numberOfOrders,
        }
      })

      return { customers }
    },
  }),

  defineTool({
    name: 'shopify_update_customer',
    description: "Update a customer's information.",
    parameters: UpdateCustomerSchema,
    run: async (client, args) => {
      const { id, ...customerFields } = args

      const customerGid = `gid://shopify/Customer/${id}`

      const query = gql`
        mutation customerUpdate($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
              firstName
              lastName
              email
              phone
              tags
              note
              taxExempt
              metafields(first: 10) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `

      const data = (await client.request(query, {
        input: { id: customerGid, ...customerFields },
      })) as {
        customerUpdate: {
          customer: any
          userErrors: Array<{ field: string; message: string }>
        }
      }

      if (data.customerUpdate.userErrors.length > 0) {
        throw new ShopifyApiError(
          'Shopify customerUpdate mutation returned user errors',
          data.customerUpdate.userErrors,
        )
      }

      const customer = data.customerUpdate.customer

      return {
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          tags: customer.tags,
          note: customer.note,
          taxExempt: customer.taxExempt,
          metafields:
            customer.metafields?.edges.map((edge: any) => edge.node) || [],
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_get_customer_orders',
    description: 'Get orders for a specific customer.',
    parameters: GetCustomerOrdersSchema,
    run: async (client, args) => {
      const { customerId, limit } = args

      const query = gql`
        query GetCustomerOrders($query: String!, $first: Int!) {
          orders(query: $query, first: $first) {
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                subtotalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalShippingPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalTaxSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                customer {
                  id
                  firstName
                  lastName
                  email
                }
                lineItems(first: 5) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      originalTotalSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                      variant {
                        id
                        title
                        sku
                      }
                    }
                  }
                }
                tags
                note
              }
            }
          }
        }
      `

      const variables = {
        query: `customer_id:${customerId}`,
        first: limit,
      }

      const data = (await client.request(query, variables)) as {
        orders: any
      }

      const orders = data.orders.edges.map((edge: any) => {
        const order = edge.node

        const lineItems = order.lineItems.edges.map(
          (lineItemEdge: any) => {
            const lineItem = lineItemEdge.node
            return {
              id: lineItem.id,
              title: lineItem.title,
              quantity: lineItem.quantity,
              originalTotal: lineItem.originalTotalSet.shopMoney,
              variant: lineItem.variant
                ? {
                    id: lineItem.variant.id,
                    title: lineItem.variant.title,
                    sku: lineItem.variant.sku,
                  }
                : null,
            }
          },
        )

        return {
          id: order.id,
          name: order.name,
          createdAt: order.createdAt,
          financialStatus: order.displayFinancialStatus,
          fulfillmentStatus: order.displayFulfillmentStatus,
          totalPrice: order.totalPriceSet.shopMoney,
          subtotalPrice: order.subtotalPriceSet.shopMoney,
          totalShippingPrice: order.totalShippingPriceSet.shopMoney,
          totalTax: order.totalTaxSet.shopMoney,
          customer: order.customer
            ? {
                id: order.customer.id,
                firstName: order.customer.firstName,
                lastName: order.customer.lastName,
                email: order.customer.email,
              }
            : null,
          lineItems,
          tags: order.tags,
          note: order.note,
        }
      })

      return { orders }
    },
  }),

  // ---- Orders ----

  defineTool({
    name: 'shopify_get_orders',
    description: 'Get orders with optional filtering by status.',
    parameters: GetOrdersSchema,
    run: async (client, args) => {
      const { status, limit } = args

      let queryFilter = ''
      if (status !== 'any') {
        queryFilter = `status:${status}`
      }

      const query = gql`
        query GetOrders($first: Int!, $query: String) {
          orders(first: $first, query: $query) {
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                subtotalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalShippingPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalTaxSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                customer {
                  id
                  firstName
                  lastName
                  email
                }
                shippingAddress {
                  address1
                  address2
                  city
                  provinceCode
                  zip
                  country
                  phone
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      originalTotalSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                      variant {
                        id
                        title
                        sku
                      }
                    }
                  }
                }
                tags
                note
              }
            }
          }
        }
      `

      const variables = {
        first: limit,
        query: queryFilter || undefined,
      }

      const data = (await client.request(query, variables)) as {
        orders: any
      }

      const orders = data.orders.edges.map((edge: any) => {
        const order = edge.node

        const lineItems = order.lineItems.edges.map(
          (lineItemEdge: any) => {
            const lineItem = lineItemEdge.node
            return {
              id: lineItem.id,
              title: lineItem.title,
              quantity: lineItem.quantity,
              originalTotal: lineItem.originalTotalSet.shopMoney,
              variant: lineItem.variant
                ? {
                    id: lineItem.variant.id,
                    title: lineItem.variant.title,
                    sku: lineItem.variant.sku,
                  }
                : null,
            }
          },
        )

        return {
          id: order.id,
          name: order.name,
          createdAt: order.createdAt,
          financialStatus: order.displayFinancialStatus,
          fulfillmentStatus: order.displayFulfillmentStatus,
          totalPrice: order.totalPriceSet.shopMoney,
          subtotalPrice: order.subtotalPriceSet.shopMoney,
          totalShippingPrice: order.totalShippingPriceSet.shopMoney,
          totalTax: order.totalTaxSet.shopMoney,
          customer: order.customer
            ? {
                id: order.customer.id,
                firstName: order.customer.firstName,
                lastName: order.customer.lastName,
                email: order.customer.email,
              }
            : null,
          shippingAddress: order.shippingAddress,
          lineItems,
          tags: order.tags,
          note: order.note,
        }
      })

      return { orders }
    },
  }),

  defineTool({
    name: 'shopify_get_order_by_id',
    description: 'Get a specific order by ID with full details.',
    parameters: GetOrderByIdSchema,
    run: async (client, args) => {
      const { orderId } = args

      const query = gql`
        query GetOrderById($id: ID!) {
          order(id: $id) {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalShippingPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customer {
              id
              firstName
              lastName
              email
              phone
            }
            shippingAddress {
              address1
              address2
              city
              provinceCode
              zip
              country
              phone
            }
            lineItems(first: 20) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalTotalSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  variant {
                    id
                    title
                    sku
                  }
                }
              }
            }
            tags
            note
            metafields(first: 20) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      `

      const data = (await client.request(query, { id: orderId })) as {
        order: any
      }

      if (!data.order) {
        throw new Error(`Order with ID ${orderId} not found`)
      }

      const order = data.order

      const lineItems = order.lineItems.edges.map((lineItemEdge: any) => {
        const lineItem = lineItemEdge.node
        return {
          id: lineItem.id,
          title: lineItem.title,
          quantity: lineItem.quantity,
          originalTotal: lineItem.originalTotalSet.shopMoney,
          variant: lineItem.variant
            ? {
                id: lineItem.variant.id,
                title: lineItem.variant.title,
                sku: lineItem.variant.sku,
              }
            : null,
        }
      })

      const metafields = order.metafields.edges.map(
        (metafieldEdge: any) => {
          const metafield = metafieldEdge.node
          return {
            id: metafield.id,
            namespace: metafield.namespace,
            key: metafield.key,
            value: metafield.value,
            type: metafield.type,
          }
        },
      )

      return {
        order: {
          id: order.id,
          name: order.name,
          createdAt: order.createdAt,
          financialStatus: order.displayFinancialStatus,
          fulfillmentStatus: order.displayFulfillmentStatus,
          totalPrice: order.totalPriceSet.shopMoney,
          subtotalPrice: order.subtotalPriceSet.shopMoney,
          totalShippingPrice: order.totalShippingPriceSet.shopMoney,
          totalTax: order.totalTaxSet.shopMoney,
          customer: order.customer
            ? {
                id: order.customer.id,
                firstName: order.customer.firstName,
                lastName: order.customer.lastName,
                email: order.customer.email,
                phone: order.customer.phone,
              }
            : null,
          shippingAddress: order.shippingAddress,
          lineItems,
          tags: order.tags,
          note: order.note,
          metafields,
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_update_order',
    description: 'Update an existing order with new information.',
    parameters: UpdateOrderSchema,
    run: async (client, args) => {
      const { id, ...orderFields } = args

      const query = gql`
        mutation orderUpdate($input: OrderInput!) {
          orderUpdate(input: $input) {
            order {
              id
              name
              email
              note
              tags
              customAttributes {
                key
                value
              }
              metafields(first: 10) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
                }
              }
              shippingAddress {
                address1
                address2
                city
                company
                country
                firstName
                lastName
                phone
                province
                zip
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `

      const data = (await client.request(query, {
        input: { id, ...orderFields },
      })) as {
        orderUpdate: {
          order: any
          userErrors: Array<{ field: string; message: string }>
        }
      }

      if (data.orderUpdate.userErrors.length > 0) {
        throw new ShopifyApiError(
          'Shopify orderUpdate mutation returned user errors',
          data.orderUpdate.userErrors,
        )
      }

      const order = data.orderUpdate.order

      return {
        order: {
          id: order.id,
          name: order.name,
          email: order.email,
          note: order.note,
          tags: order.tags,
          customAttributes: order.customAttributes,
          metafields:
            order.metafields?.edges.map((edge: any) => edge.node) || [],
          shippingAddress: order.shippingAddress,
        },
      }
    },
  }),

  // ---- Blog & Articles ----

  defineTool({
    name: 'shopify_get_blogs',
    description: 'List all blogs in the Shopify store.',
    parameters: GetBlogsSchema,
    run: async (client, args) => {
      const { limit } = args
      const query = gql`
        query GetBlogs($first: Int!) {
          blogs(first: $first) {
            edges {
              node {
                id
                title
                handle
                commentPolicy
                templateSuffix
              }
            }
          }
        }
      `
      const data = (await client.request(query, { first: limit })) as {
        blogs: { edges: any[] }
      }
      const blogs = data.blogs.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        commentPolicy: edge.node.commentPolicy,
        templateSuffix: edge.node.templateSuffix,
      }))
      return { blogs }
    },
  }),

  defineTool({
    name: 'shopify_get_blog_articles',
    description: 'List articles for a specific blog.',
    parameters: GetBlogArticlesSchema,
    run: async (client, args) => {
      const { blogId, limit, published } = args
      let queryFilter: string | null = null
      if (published === true) queryFilter = 'published_status:published'
      else if (published === false) queryFilter = 'published_status:unpublished'

      const query = gql`
        query GetBlogArticles($blogId: ID!, $first: Int!, $query: String) {
          blog(id: $blogId) {
            id
            title
            articles(first: $first, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  body
                  summary
                  tags
                  isPublished
                  publishedAt
                  createdAt
                  updatedAt
                  author {
                    name
                  }
                  image {
                    url
                    altText
                    width
                    height
                  }
                }
              }
            }
          }
        }
      `
      const data = (await client.request(query, {
        blogId,
        first: limit,
        query: queryFilter,
      })) as { blog: any }

      if (!data.blog) {
        throw new Error(`Blog with ID ${blogId} not found`)
      }

      const articles = data.blog.articles.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        body: edge.node.body,
        summary: edge.node.summary,
        tags: edge.node.tags,
        isPublished: edge.node.isPublished,
        publishedAt: edge.node.publishedAt,
        createdAt: edge.node.createdAt,
        updatedAt: edge.node.updatedAt,
        author: edge.node.author?.name || null,
        image: edge.node.image,
      }))
      return {
        blog: { id: data.blog.id, title: data.blog.title },
        articles,
      }
    },
  }),

  defineTool({
    name: 'shopify_get_article_by_id',
    description: 'Get a single article by ID with full details.',
    parameters: GetArticleByIdSchema,
    run: async (client, args) => {
      const query = gql`
        query GetArticle($id: ID!) {
          article(id: $id) {
            id
            title
            handle
            body
            summary
            tags
            isPublished
            publishedAt
            createdAt
            updatedAt
            author {
              name
            }
            blog {
              id
              title
            }
            image {
              url
              altText
              width
              height
            }
            seo {
              title
              description
            }
          }
        }
      `
      const data = (await client.request(query, { id: args.articleId })) as {
        article: any
      }
      if (!data.article) {
        throw new Error(`Article with ID ${args.articleId} not found`)
      }
      const a = data.article
      return {
        article: {
          id: a.id,
          title: a.title,
          handle: a.handle,
          body: a.body,
          summary: a.summary,
          tags: a.tags,
          isPublished: a.isPublished,
          publishedAt: a.publishedAt,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          author: a.author?.name || null,
          blog: a.blog,
          image: a.image,
          seo: a.seo,
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_search_articles',
    description: 'Search articles across all blogs by title or tag. Returns up to `limit` results (no cursor pagination).',
    parameters: SearchArticlesSchema,
    run: async (client, args) => {
      const query = gql`
        query SearchArticles($first: Int!, $query: String!) {
          articles(first: $first, query: $query) {
            edges {
              node {
                id
                title
                handle
                summary
                tags
                isPublished
                publishedAt
                author {
                  name
                }
                blog {
                  id
                  title
                }
              }
            }
          }
        }
      `
      const data = (await client.request(query, {
        first: args.limit,
        query: args.query,
      })) as { articles: { edges: any[] } }

      const articles = data.articles.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        summary: edge.node.summary,
        tags: edge.node.tags,
        isPublished: edge.node.isPublished,
        publishedAt: edge.node.publishedAt,
        author: edge.node.author?.name || null,
        blog: edge.node.blog,
      }))
      return { articles }
    },
  }),

  defineTool({
    name: 'shopify_create_article',
    description:
      'Create a new blog article. Requires a blogId — use shopify_get_blogs first to find the target blog.',
    parameters: CreateArticleSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation CreateArticle($article: ArticleCreateInput!) {
          articleCreate(article: $article) {
            article {
              id
              title
              handle
              body
              summary
              tags
              isPublished
              publishedAt
              author {
                name
              }
              image {
                altText
                originalSrc
              }
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const articleInput: any = {
        blogId: args.blogId,
        title: args.title,
        body: args.body,
        isPublished: args.isPublished,
      }
      if (args.summary !== undefined) articleInput.summary = args.summary
      if (args.handle !== undefined) articleInput.handle = args.handle
      if (args.author !== undefined) articleInput.author = { name: args.author }
      if (args.tags !== undefined) articleInput.tags = args.tags
      if (args.publishDate !== undefined) articleInput.publishDate = args.publishDate
      if (args.image !== undefined) articleInput.image = args.image

      const data = (await client.request(mutation, {
        article: articleInput,
      })) as {
        articleCreate: { article: any; userErrors: any[] }
      }
      const { article, userErrors } = data.articleCreate
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to create article', userErrors)
      }
      return {
        article: {
          id: article.id,
          title: article.title,
          handle: article.handle,
          body: article.body,
          summary: article.summary,
          tags: article.tags,
          isPublished: article.isPublished,
          publishedAt: article.publishedAt,
          author: article.author?.name || null,
          imageUrl: article.image?.originalSrc || null,
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_update_article',
    description: 'Update an existing article.',
    parameters: UpdateArticleSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation UpdateArticle($id: ID!, $article: ArticleUpdateInput!) {
          articleUpdate(id: $id, article: $article) {
            article {
              id
              title
              handle
              body
              summary
              tags
              isPublished
              publishedAt
              author {
                name
              }
              image {
                altText
                originalSrc
              }
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const articleInput: any = {}
      if (args.title !== undefined) articleInput.title = args.title
      if (args.body !== undefined) articleInput.body = args.body
      if (args.summary !== undefined) articleInput.summary = args.summary
      if (args.handle !== undefined) articleInput.handle = args.handle
      if (args.author !== undefined) articleInput.author = { name: args.author }
      if (args.tags !== undefined) articleInput.tags = args.tags
      if (args.isPublished !== undefined) articleInput.isPublished = args.isPublished
      if (args.publishDate !== undefined) articleInput.publishDate = args.publishDate
      if (args.image !== undefined) articleInput.image = args.image
      if (args.redirectNewHandle !== undefined) articleInput.redirectNewHandle = args.redirectNewHandle

      const data = (await client.request(mutation, {
        id: args.id,
        article: articleInput,
      })) as {
        articleUpdate: { article: any; userErrors: any[] }
      }
      const { article, userErrors } = data.articleUpdate
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to update article', userErrors)
      }
      return {
        article: {
          id: article.id,
          title: article.title,
          handle: article.handle,
          body: article.body,
          summary: article.summary,
          tags: article.tags,
          isPublished: article.isPublished,
          publishedAt: article.publishedAt,
          author: article.author?.name || null,
          imageUrl: article.image?.originalSrc || null,
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_delete_article',
    description: 'Delete an article.',
    parameters: DeleteArticleSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation DeleteArticle($id: ID!) {
          articleDelete(id: $id) {
            deletedArticleId
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const data = (await client.request(mutation, { id: args.id })) as {
        articleDelete: { deletedArticleId: string; userErrors: any[] }
      }
      const { deletedArticleId, userErrors } = data.articleDelete
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to delete article', userErrors)
      }
      return { deletedArticleId }
    },
  }),

  defineTool({
    name: 'shopify_create_blog',
    description: 'Create a new blog container.',
    parameters: CreateBlogSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation CreateBlog($blog: BlogCreateInput!) {
          blogCreate(blog: $blog) {
            blog {
              id
              title
              handle
              templateSuffix
              commentPolicy
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const blogInput: any = { title: args.title }
      if (args.handle !== undefined) blogInput.handle = args.handle
      if (args.commentPolicy !== undefined) blogInput.commentPolicy = args.commentPolicy
      if (args.templateSuffix !== undefined) blogInput.templateSuffix = args.templateSuffix

      const data = (await client.request(mutation, { blog: blogInput })) as {
        blogCreate: { blog: any; userErrors: any[] }
      }
      const { blog, userErrors } = data.blogCreate
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to create blog', userErrors)
      }
      return { blog }
    },
  }),

  defineTool({
    name: 'shopify_update_blog',
    description: "Update a blog's settings.",
    parameters: UpdateBlogSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation UpdateBlog($id: ID!, $blog: BlogUpdateInput!) {
          blogUpdate(id: $id, blog: $blog) {
            blog {
              id
              title
              handle
              templateSuffix
              commentPolicy
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const blogInput: any = {}
      if (args.title !== undefined) blogInput.title = args.title
      if (args.handle !== undefined) blogInput.handle = args.handle
      if (args.commentPolicy !== undefined) blogInput.commentPolicy = args.commentPolicy
      if (args.templateSuffix !== undefined) blogInput.templateSuffix = args.templateSuffix

      const data = (await client.request(mutation, {
        id: args.id,
        blog: blogInput,
      })) as {
        blogUpdate: { blog: any; userErrors: any[] }
      }
      const { blog, userErrors } = data.blogUpdate
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to update blog', userErrors)
      }
      return { blog }
    },
  }),

  defineTool({
    name: 'shopify_delete_blog',
    description: 'Delete a blog and all its articles.',
    parameters: DeleteBlogSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation DeleteBlog($id: ID!) {
          blogDelete(id: $id) {
            deletedBlogId
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const data = (await client.request(mutation, { id: args.id })) as {
        blogDelete: { deletedBlogId: string; userErrors: any[] }
      }
      const { deletedBlogId, userErrors } = data.blogDelete
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to delete blog', userErrors)
      }
      return { deletedBlogId }
    },
  }),

  // ---- Pages ----

  defineTool({
    name: 'shopify_get_pages',
    description: 'List pages from the online store.',
    parameters: GetPagesSchema,
    run: async (client, args) => {
      const { limit, searchTitle } = args
      const query = gql`
        query GetPages($first: Int!, $query: String) {
          pages(first: $first, query: $query) {
            edges {
              node {
                id
                title
                handle
                body
                isPublished
                createdAt
                updatedAt
              }
            }
          }
        }
      `
      const data = (await client.request(query, {
        first: limit,
        query: searchTitle ? `title:${searchTitle}` : null,
      })) as { pages: { edges: any[] } }

      const pages = data.pages.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        body: edge.node.body,
        isPublished: edge.node.isPublished,
        createdAt: edge.node.createdAt,
        updatedAt: edge.node.updatedAt,
      }))
      return { pages }
    },
  }),

  defineTool({
    name: 'shopify_get_page_by_id',
    description: 'Get a specific page by ID with full details.',
    parameters: GetPageByIdSchema,
    run: async (client, args) => {
      const query = gql`
        query GetPage($id: ID!) {
          page(id: $id) {
            id
            title
            handle
            body
            isPublished
            publishedAt
            createdAt
            updatedAt
            templateSuffix
            seo {
              title
              description
            }
          }
        }
      `
      const data = (await client.request(query, { id: args.pageId })) as {
        page: any
      }
      if (!data.page) {
        throw new Error(`Page with ID ${args.pageId} not found`)
      }
      const p = data.page
      return {
        page: {
          id: p.id,
          title: p.title,
          handle: p.handle,
          body: p.body,
          isPublished: p.isPublished,
          publishedAt: p.publishedAt,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          templateSuffix: p.templateSuffix || null,
          seo: p.seo || null,
        },
      }
    },
  }),

  defineTool({
    name: 'shopify_create_page',
    description: 'Create a new page (e.g. About Us, Contact, FAQ).',
    parameters: CreatePageSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation CreatePage($page: PageCreateInput!) {
          pageCreate(page: $page) {
            page {
              id
              title
              handle
              body
              isPublished
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const pageInput: any = {
        title: args.title,
        body: args.body,
        isPublished: args.isPublished,
      }
      if (args.handle !== undefined) pageInput.handle = args.handle
      if (args.templateSuffix !== undefined) pageInput.templateSuffix = args.templateSuffix
      if (args.metafields !== undefined) pageInput.metafields = args.metafields

      const data = (await client.request(mutation, { page: pageInput })) as {
        pageCreate: { page: any; userErrors: any[] }
      }
      const { page, userErrors } = data.pageCreate
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to create page', userErrors)
      }
      return { page }
    },
  }),

  defineTool({
    name: 'shopify_update_page',
    description: 'Update an existing page.',
    parameters: UpdatePageSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation UpdatePage($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) {
            page {
              id
              title
              handle
              body
              isPublished
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const pageInput: any = {}
      if (args.title !== undefined) pageInput.title = args.title
      if (args.body !== undefined) pageInput.body = args.body
      if (args.handle !== undefined) pageInput.handle = args.handle
      if (args.isPublished !== undefined) pageInput.isPublished = args.isPublished
      if (args.templateSuffix !== undefined) pageInput.templateSuffix = args.templateSuffix
      if (args.metafields !== undefined) pageInput.metafields = args.metafields

      const data = (await client.request(mutation, {
        id: args.id,
        page: pageInput,
      })) as {
        pageUpdate: { page: any; userErrors: any[] }
      }
      const { page, userErrors } = data.pageUpdate
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to update page', userErrors)
      }
      return { page }
    },
  }),

  defineTool({
    name: 'shopify_delete_page',
    description: 'Delete a page.',
    parameters: DeletePageSchema,
    run: async (client, args) => {
      const mutation = gql`
        mutation DeletePage($id: ID!) {
          pageDelete(id: $id) {
            deletedPageId
            userErrors {
              code
              field
              message
            }
          }
        }
      `
      const data = (await client.request(mutation, { id: args.id })) as {
        pageDelete: { deletedPageId: string; userErrors: any[] }
      }
      const { deletedPageId, userErrors } = data.pageDelete
      if (userErrors?.length > 0) {
        throw new ShopifyApiError('Failed to delete page', userErrors)
      }
      return { deletedPageId }
    },
  }),
] as const

export const SHOPIFY_TOOL_NAMES = shopifyTools.map((tool) => tool.name)

export function registerShopifyTools(server: FastMCP<undefined>): void {
  for (const tool of shopifyTools) {
    server.addTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: async (args, context) => {
        logger.info(`Tool: ${tool.name} - called`)
        logger.debug(
          `Tool: ${tool.name} - extraArgs keys: ${context.extraArgs ? Object.keys(context.extraArgs).join(', ') : 'none'}`,
        )
        try {
          const client = await createShopifyClient(context.extraArgs)
          const run = tool.run as (
            client: GraphQLClient,
            args: unknown,
          ) => Promise<unknown>
          const result = await run(client, args)
          logger.info(`Tool: ${tool.name} - success`)
          return stringifyResult(result)
        } catch (error) {
          if (error instanceof ShopifyApiError) {
            logger.error(
              `Tool: ${tool.name} - API error: ${error.message} | userErrors=${JSON.stringify(error.userErrors)}`,
            )
          } else {
            logger.error(
              `Tool: ${tool.name} - failed: ${error instanceof Error ? error.message : String(error)}`,
            )
          }
          throw toUserError(error, `Tool ${tool.name} failed`)
        }
      },
    })
  }
}
