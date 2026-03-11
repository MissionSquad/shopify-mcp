# @missionsquad/mcp-shopify

MCP Server for the Shopify GraphQL Admin API, built on `@missionsquad/fastmcp`. Provides tools for managing products, customers, and orders through the Model Context Protocol.

Designed for the MissionSquad platform where user-specific Shopify credentials are injected as hidden secrets at tool-call time via `mcp-api`. Also supports standalone local development with environment variables.

## Features

- **Product Management**: Full CRUD for products, variants, and options
- **Customer Management**: Query customers and update customer data
- **Order Management**: Query and update orders
- **GraphQL Integration**: Direct integration with Shopify's GraphQL Admin API
- **Hidden Secret Injection**: Credentials are injected per-call via `context.extraArgs` — never exposed to the LLM
- **Multi-Tenant**: Supports concurrent users with different Shopify stores and credentials

## Prerequisites

- Node.js >= 20
- A Shopify store with a custom app (see authentication below)

## Authentication

This server supports two Shopify authentication methods:

### Option 1: Client Credentials (Dev Dashboard apps, January 2026+)

New Shopify apps use OAuth client credentials. The server exchanges `clientId` + `clientSecret` for an access token on each tool call.

### Option 2: Static Access Token (legacy apps)

Existing custom apps with a static `shpat_*` access token can pass it directly.

## Usage

### MissionSquad Platform (Hidden Secrets)

When running via `mcp-api`, credentials are injected as hidden arguments into `context.extraArgs`. The LLM never sees these values — they are not part of any tool schema.

**Secret keys** (stored in mcp-api as `mcp-shopify.<key>`):

| Key | Description | Required |
|---|---|---|
| `accessToken` | Shopify Admin API access token (`shpat_*`) | Yes, if no client credentials |
| `clientId` | Shopify app client ID | Yes, if no static token |
| `clientSecret` | Shopify app client secret | Yes, if no static token |
| `shopDomain` | Store domain (e.g., `my-store.myshopify.com`) | Always required |
| `apiVersion` | Shopify API version (default: `2026-01`) | No |

**mcp-api server registration:**

```json
{
  "name": "mcp-shopify",
  "transportType": "stdio",
  "command": "node",
  "args": ["./path/to/mcp-shopify/dist/index.js"],
  "secretNames": ["accessToken", "shopDomain", "apiVersion", "clientId", "clientSecret"],
  "enabled": true
}
```

### Local Development (Environment Variables)

For standalone use, create a `.env` file:

**Client Credentials:**
```
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
MYSHOPIFY_DOMAIN=your-store.myshopify.com
```

**Static Access Token:**
```
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token
MYSHOPIFY_DOMAIN=your-store.myshopify.com
```

**Optional:**
```
SHOPIFY_API_VERSION=2026-01
LOG_LEVEL=info
```

Then run:
```bash
node dist/index.js
```

### Claude Desktop

```json
{
  "mcpServers": {
    "shopify": {
      "command": "node",
      "args": ["./path/to/mcp-shopify/dist/index.js"],
      "env": {
        "SHOPIFY_ACCESS_TOKEN": "shpat_your_token",
        "MYSHOPIFY_DOMAIN": "your-store.myshopify.com"
      }
    }
  }
}
```

## Available Tools

### Product Management

1. **`shopify_get_products`** — Get all products or search by title
   - `searchTitle` (string, optional): Filter products by title
   - `limit` (number, default: 10): Maximum products to return

2. **`shopify_get_product_by_id`** — Get a specific product by ID
   - `productId` (string, required): Shopify product GID

3. **`shopify_create_product`** — Create a new product
   - `title` (string, required): Product title
   - `descriptionHtml` (string, optional): HTML description
   - `handle` (string, optional): URL slug (auto-generated if omitted)
   - `vendor` (string, optional)
   - `productType` (string, optional)
   - `tags` (string[], optional)
   - `status` (string, optional): `ACTIVE`, `DRAFT`, or `ARCHIVED` (default: `DRAFT`)
   - `seo` (object, optional): `{ title, description }`
   - `metafields` (array, optional): `{ namespace, key, value, type }`
   - `productOptions` (array, optional): Options to create inline (max 3)
   - `collectionsToJoin` (string[], optional): Collection GIDs

4. **`shopify_update_product`** — Update an existing product
   - `id` (string, required): Product GID
   - All fields from create (optional), plus `collectionsToLeave`, `redirectNewHandle`

5. **`shopify_delete_product`** — Delete a product
   - `id` (string, required): Product GID

6. **`shopify_manage_product_variants`** — Create or update variants in bulk
   - `productId` (string, required): Product GID
   - `variants` (array, required): Variants to create/update (omit `id` to create, include to update)
   - `strategy` (string, optional): `DEFAULT`, `REMOVE_STANDALONE_VARIANT`, or `PRESERVE_STANDALONE_VARIANT`

7. **`shopify_manage_product_options`** — Create, update, or delete product options
   - `productId` (string, required): Product GID
   - `action` (string, required): `create`, `update`, or `delete`
   - Action-specific fields (see schema for details)

8. **`shopify_delete_product_variants`** — Delete variants from a product
   - `productId` (string, required): Product GID
   - `variantIds` (string[], required): Variant GIDs to delete

### Customer Management

9. **`shopify_get_customers`** — Get customers or search by name/email
   - `searchQuery` (string, optional): Search filter
   - `limit` (number, default: 10)

10. **`shopify_update_customer`** — Update a customer's information
    - `id` (string, required): Numeric customer ID (not GID)
    - `firstName`, `lastName`, `email`, `phone`, `tags`, `note`, `taxExempt`, `metafields` (all optional)

11. **`shopify_get_customer_orders`** — Get orders for a specific customer
    - `customerId` (string, required): Numeric customer ID
    - `limit` (number, default: 10)

### Order Management

12. **`shopify_get_orders`** — Get orders with optional status filter
    - `status` (string, optional): `any`, `open`, `closed`, or `cancelled` (default: `any`)
    - `limit` (number, default: 10)

13. **`shopify_get_order_by_id`** — Get a specific order by ID
    - `orderId` (string, required): Full order GID

14. **`shopify_update_order`** — Update an existing order
    - `id` (string, required): Order GID
    - `tags`, `email`, `note`, `customAttributes`, `metafields`, `shippingAddress` (all optional)

## Development

```bash
# Install dependencies
yarn install

# Build
yarn build

# Run tests
yarn test

# Run with coverage
yarn test:coverage
```

## Architecture

```
src/
  index.ts              # FastMCP entrypoint (stdio transport)
  config.ts             # Secret resolution (extraArgs -> env fallback)
  shopify-client.ts     # Per-call GraphQLClient factory + token exchange
  tools.ts              # All 14 tool definitions + registration
  schemas.ts            # Zod schemas (functional params only, no secrets)
  errors.ts             # Custom error classes + toUserError converter
  logger.ts             # Stderr logger
  stdio-safe-console.ts # Redirect console.log to stderr
  json.ts               # Deterministic JSON serialization
```

**Key design decisions:**
- **Per-call client creation**: A new `GraphQLClient` is created for each tool invocation with the resolved credentials. This enables multi-tenant operation where different users have different Shopify stores.
- **Secret isolation**: Credentials flow exclusively through `context.extraArgs` -> `config.ts` -> `shopify-client.ts`. They never appear in tool schemas (which are sent to the LLM).
- **Stateless token exchange**: For client credentials auth, the OAuth token exchange happens per-call rather than using background refresh. This is simpler and correct for multi-tenant operation.

## License

MIT
