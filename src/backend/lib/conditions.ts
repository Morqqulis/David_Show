export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'in'
  | 'notIn'

export type Condition = {
  fieldKey: string
  operator: ConditionOperator
  value?: unknown
}

export type ConditionGroup = {
  operator: 'and' | 'or'
  conditions: Condition[]
}

export type ValueGetter = (fieldKey: string) => unknown

export function evaluateCondition(cond: Condition, get: ValueGetter): boolean {
  const left = get(cond.fieldKey)
  const right = cond.value
  switch (cond.operator) {
    case 'equals':
      return left == right
    case 'notEquals':
      return left != right
    case 'contains':
      return String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase())
    case 'notContains':
      return !String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase())
    case 'startsWith':
      return String(left ?? '').toLowerCase().startsWith(String(right ?? '').toLowerCase())
    case 'isEmpty':
      return left == null || left === '' || (Array.isArray(left) && left.length === 0)
    case 'isNotEmpty':
      return !(left == null || left === '' || (Array.isArray(left) && left.length === 0))
    case 'greaterThan':
      return Number(left) > Number(right)
    case 'greaterThanOrEqual':
      return Number(left) >= Number(right)
    case 'lessThan':
      return Number(left) < Number(right)
    case 'lessThanOrEqual':
      return Number(left) <= Number(right)
    case 'in':
      return Array.isArray(right) && right.some((v) => v == left)
    case 'notIn':
      return Array.isArray(right) && !right.some((v) => v == left)
    default:
      return false
  }
}

export function evaluateGroup(group: ConditionGroup | null | undefined, get: ValueGetter): boolean {
  if (!group || !group.conditions || group.conditions.length === 0) return true
  if (group.operator === 'and') return group.conditions.every((c) => evaluateCondition(c, get))
  return group.conditions.some((c) => evaluateCondition(c, get))
}
