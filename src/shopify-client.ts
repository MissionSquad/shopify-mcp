import { GraphQLClient } from 'graphql-request'
import { appConfig, resolveShopifyConfig } from './config.js'
import { ShopifyAuthError } from './errors.js'
import { logger } from './logger.js'

interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
}

async function exchangeClientCredentials(
  clientId: string,
  clientSecret: string,
  shopDomain: string,
): Promise<string> {
  const url = `https://${shopDomain}/admin/oauth/access_token`

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new ShopifyAuthError(
      `Shopify client credentials token exchange failed (${res.status}): ${text}`,
    )
  }

  const data = (await res.json()) as TokenResponse
  return data.access_token
}

export async function createShopifyClient(
  extraArgs: Record<string, unknown> | undefined,
): Promise<GraphQLClient> {
  const config = resolveShopifyConfig(extraArgs, appConfig)

  let accessToken: string

  if (config.accessToken) {
    accessToken = config.accessToken
  } else {
    logger.debug('Exchanging client credentials for access token')
    accessToken = await exchangeClientCredentials(
      config.clientId!,
      config.clientSecret!,
      config.shopDomain,
    )
  }

  const endpoint = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`

  return new GraphQLClient(endpoint, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })
}
