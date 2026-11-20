/**
 * Copies play state while keeping each Blob asset file as the very object the novel declared,
 * so a stage or a mixer that caches per Blob (an object URL, a decoded buffer) reuses its work
 * on every stop of the play.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A deep copy of `value`, as `structuredClone` makes one, with every Blob shared with the
 * original; Blobs are immutable, so sharing one keeps the copy independent.
 *
 * @template Value - The copied value.
 * @param value - The state to copy.
 * @returns The copy.
 */
export function copyKeepingFiles<Value>(value: Value): Value {
	return restoreFiles(value, structuredClone(value), new Set()) as Value;
}

/**
 * Puts each Blob of `original` back where `copy` holds its clone, through arrays and plain
 * objects. Saved state is untrusted, so the keys that reach a prototype when written
 * (`__proto__`, `constructor`, `prototype`) keep what `structuredClone` copied.
 */
function restoreFiles(original: unknown, copy: unknown, seen: Set<object>): unknown {
	if (original instanceof Blob) return original;
	if (typeof original !== "object" || original === null || seen.has(original)) return copy;
	let prototype: unknown = Object.getPrototypeOf(original);
	if (!Array.isArray(original) && prototype !== Object.prototype && prototype !== null) return copy;
	seen.add(original);
	let target = copy as Record<string, unknown>;
	for (let [key, item] of Object.entries(original)) {
		if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
		target[key] = restoreFiles(item, target[key], seen);
	}
	return copy;
}
