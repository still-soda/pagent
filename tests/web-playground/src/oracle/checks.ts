import type { CheckOutcome } from './types'

export function pass(id: string, label: string, actual?: string): CheckOutcome {
  return { id, label, status: 'pass', actual }
}

export function fail(
  id: string,
  label: string,
  expected?: string,
  actual?: string,
): CheckOutcome {
  return { id, label, status: 'fail', expected, actual }
}

export function unknown(id: string, label: string, actual?: string): CheckOutcome {
  return { id, label, status: 'unknown', actual }
}

export function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return '未设置'
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join('、')
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

export function assertEqual(
  id: string,
  label: string,
  expected: unknown,
  actual: unknown,
): CheckOutcome {
  const expectedText = formatValue(expected)
  const actualText = formatValue(actual)
  if (Object.is(expected, actual) || expectedText === actualText) {
    return pass(id, label, actualText)
  }
  return fail(id, label, expectedText, actualText)
}

export function assert(
  id: string,
  label: string,
  ok: boolean,
  expected?: string,
  actual?: string,
): CheckOutcome {
  return ok ? pass(id, label, actual) : fail(id, label, expected, actual)
}
