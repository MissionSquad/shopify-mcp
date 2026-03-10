import { UserError } from '@missionsquad/fastmcp'

export class ShopifyConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShopifyConfigError'
  }
}

export class ShopifyAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShopifyAuthError'
  }
}

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public readonly userErrors: Array<{ field?: string | string[]; message: string }>,
  ) {
    super(message)
    this.name = 'ShopifyApiError'
  }
}

export function toUserError(error: unknown, prefix: string): UserError {
  if (error instanceof UserError) {
    return error
  }

  if (error instanceof ShopifyApiError) {
    const details = error.userErrors
      .map((e) => {
        const field = Array.isArray(e.field) ? e.field.join('.') : (e.field ?? 'unknown')
        return `${field}: ${e.message}`
      })
      .join('; ')
    return new UserError(`${prefix}: ${details}`)
  }

  if (error instanceof ShopifyConfigError || error instanceof ShopifyAuthError) {
    return new UserError(`${prefix}: ${error.message}`)
  }

  if (error instanceof Error) {
    return new UserError(`${prefix}: ${error.message}`)
  }

  return new UserError(`${prefix}: ${String(error)}`)
}
