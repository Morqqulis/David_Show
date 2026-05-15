export function splitSegments(code: string, delimiter = '-'): string[] {
  return code.split(delimiter).map((s) => s.trim())
}

export type SegmentRule = {
  segmentIndex: number
  operator: 'equals' | 'starts_with' | 'in'
  value?: string | null
  listValues?: Array<{ value: string }> | null
}

export function ruleMatches(rule: SegmentRule, glCode: string, delimiter = '-'): boolean {
  const segments = splitSegments(glCode, delimiter)
  const segment = segments[rule.segmentIndex - 1]
  if (segment == null) return false
  switch (rule.operator) {
    case 'equals':
      return segment === (rule.value ?? '')
    case 'starts_with':
      return segment.startsWith(rule.value ?? '')
    case 'in':
      return (rule.listValues ?? []).some((v) => v.value === segment)
    default:
      return false
  }
}

export function anyRuleMatches(rules: SegmentRule[], glCode: string, delimiter = '-'): boolean {
  if (!rules || rules.length === 0) return false
  return rules.some((r) => ruleMatches(r, glCode, delimiter))
}
