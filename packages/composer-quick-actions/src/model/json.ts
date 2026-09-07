/**
 * JSON structural comparison shared by the mutation planner and the Host's
 * canonical rewrite.
 *
 * Structural, not canonical-JSON: object key order carries no meaning here.
 * A stored section round-tripped through YAML, and a tombstone written by a
 * higher version, both come back with whatever key order their writer chose —
 * comparing serialized text would report a difference that is not one, and the
 * rewrite would then write on every start instead of being idempotent.
 */
export function deepEqualJson(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((item, index) => deepEqualJson(item, right[index]))
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every(
    (key) =>
      Object.hasOwn(right, key) &&
      deepEqualJson((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  )
}
