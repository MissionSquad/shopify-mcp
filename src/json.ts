export function stringifyResult(value: unknown): string {
  const result = JSON.stringify(
    value,
    (_key, currentValue) => {
      if (typeof currentValue === 'bigint') {
        return currentValue.toString()
      }
      return currentValue
    },
    2,
  )

  return result ?? 'null'
}
