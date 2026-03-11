import { UserError } from '@missionsquad/fastmcp'
import dotenv from 'dotenv'
import { z } from 'zod'
import { logger } from './logger.js'

dotenv.config()

const DEFAULT_API_VERSION = '2026-01'

const EnvSchema = z.object({
  SHOPIFY_ACCESS_TOKEN: z.string().optional(),
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  MYSHOPIFY_DOMAIN: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().optional(),
})

const env = EnvSchema.parse(process.env)

export interface AppConfig {
  defaultAccessToken: string | undefined
  defaultClientId: string | undefined
  defaultClientSecret: string | undefined
  defaultShopDomain: string | undefined
  defaultApiVersion: string
}

export interface ResolvedShopifyConfig {
  accessToken: string | undefined
  clientId: string | undefined
  clientSecret: string | undefined
  shopDomain: string
  apiVersion: string
}

export const appConfig: AppConfig = {
  defaultAccessToken: env.SHOPIFY_ACCESS_TOKEN?.trim() || undefined,
  defaultClientId: env.SHOPIFY_CLIENT_ID?.trim() || undefined,
  defaultClientSecret: env.SHOPIFY_CLIENT_SECRET?.trim() || undefined,
  defaultShopDomain: env.MYSHOPIFY_DOMAIN?.trim() || undefined,
  defaultApiVersion: env.SHOPIFY_API_VERSION?.trim() || DEFAULT_API_VERSION,
}

function readHiddenString(
  extraArgs: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = extraArgs?.[key]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new UserError(`Hidden argument "${key}" must be a string when provided.`)
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new UserError(`Hidden argument "${key}" must be a non-empty string when provided.`)
  }

  return trimmed
}

export function resolveShopifyConfig(
  extraArgs: Record<string, unknown> | undefined,
  defaults: AppConfig = appConfig,
): ResolvedShopifyConfig {
  logger.debug(
    `resolveShopifyConfig extraArgs keys: ${extraArgs ? Object.keys(extraArgs).join(', ') : 'undefined'}`,
  )

  const accessToken = readHiddenString(extraArgs, 'accessToken') ?? defaults.defaultAccessToken
  const clientId = readHiddenString(extraArgs, 'clientId') ?? defaults.defaultClientId
  const clientSecret = readHiddenString(extraArgs, 'clientSecret') ?? defaults.defaultClientSecret
  const shopDomain = readHiddenString(extraArgs, 'shopDomain') ?? defaults.defaultShopDomain
  const apiVersion = readHiddenString(extraArgs, 'apiVersion') ?? defaults.defaultApiVersion

  if (shopDomain === undefined || shopDomain.length === 0) {
    throw new UserError(
      'Shopify shop domain is required. Provide hidden argument "shopDomain" or set MYSHOPIFY_DOMAIN.',
    )
  }

  const hasAccessToken = accessToken !== undefined && accessToken.length > 0
  const hasClientCredentials =
    clientId !== undefined &&
    clientId.length > 0 &&
    clientSecret !== undefined &&
    clientSecret.length > 0

  if (!hasAccessToken && !hasClientCredentials) {
    throw new UserError(
      'Shopify authentication is required. Provide hidden argument "accessToken" or both "clientId" and "clientSecret". ' +
        'Alternatively, set SHOPIFY_ACCESS_TOKEN or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET environment variables.',
    )
  }

  return {
    accessToken: hasAccessToken ? accessToken : undefined,
    clientId: hasClientCredentials ? clientId : undefined,
    clientSecret: hasClientCredentials ? clientSecret : undefined,
    shopDomain,
    apiVersion,
  }
}
