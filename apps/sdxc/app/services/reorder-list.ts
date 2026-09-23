/**
 * Where an item lands when a drag drops it beside another one. Kept apart from the markup
 * because it is array arithmetic with one edge worth getting right: the source is removed
 * before the destination is counted, so dragging downward does not overshoot by one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Where a drop sits relative to the row it landed on. */
export type DropPosition = "before" | "after" | "on";

/**
 * The list with one item moved next to another.
 *
 * @param items - The list as it stands, identified by `key`.
 * @param sourceKey - The item being moved.
 * @param targetKey - The item it was dropped beside.
 * @param position - Which side of the target it landed on.
 * @returns A new list in the resulting order, or the same order when the move is a no-op.
 * @example reorder(["a", "b", "c"], "a", "c", "after", (key) => key) // ["b", "c", "a"]
 */
export function reorder<item>(
	items: ReadonlyArray<item>,
	sourceKey: string,
	targetKey: string,
	position: DropPosition,
	keyOf: (value: item) => string,
): item[] {
	if (sourceKey === targetKey) return [...items];

	let source = items.find((item) => keyOf(item) === sourceKey);
	if (source === undefined) return [...items];

	let remaining = items.filter((item) => keyOf(item) !== sourceKey);
	let targetIndex = remaining.findIndex((item) => keyOf(item) === targetKey);
	if (targetIndex === -1) return [...items];

	let insertAt = position === "before" ? targetIndex : targetIndex + 1;
	return [...remaining.slice(0, insertAt), source, ...remaining.slice(insertAt)];
}
