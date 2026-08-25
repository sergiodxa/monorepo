/**
 * Selection state for list-shaped widgets: a set of selected keys plus the
 * toggle, contiguous-range, and select-all semantics behind row selection.
 * Consumers subscribe to the `"change"` event and render from
 * `selectedKeys`, so selection lives on independently of the rendering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/ui";

/**
 * Types associated with {@link SelectionModel}.
 */
export namespace SelectionModel {
	/**
	 * Identifier for a selectable item. Row/item identity is left to the
	 * consumer — a string slug and a numeric row id are both valid keys.
	 */
	export type Key = string | number;

	/**
	 * Selection cardinality a model enforces: `"none"` accepts no selection
	 * at all, `"single"` keeps at most one selected key, and `"multiple"`
	 * allows any subset of the known keys.
	 */
	export type Mode = "none" | "single" | "multiple";

	/**
	 * Constructor options for {@link SelectionModel}.
	 */
	export interface Options {
		/** Selection cardinality; defaults to `"multiple"`. */
		mode?: Mode;
		/**
		 * Ordered universe of selectable keys, backing
		 * {@link SelectionModel.selectRange} spans and the full set for
		 * {@link SelectionModel.selectAll}. Point selection works without it.
		 */
		keys?: Iterable<Key>;
		/** Keys excluded from selection; any of them present in `selectedKeys` are dropped. */
		disabledKeys?: Iterable<Key>;
		/** Keys selected on construction, clamped to `mode` and `disabledKeys`. */
		selectedKeys?: Iterable<Key>;
	}
}

const DEFAULT_MODE: SelectionModel.Mode = "multiple";

/**
 * State model for list, grid, tree, and table row selection. Every mutating
 * method dispatches a plain `"change"` event exactly once, and only when the
 * selected-key set really changes, so a subscriber can re-render blindly.
 */
export class SelectionModel extends TypedEventTarget<{ change: Event }> {
	#mode: SelectionModel.Mode;
	#keys: SelectionModel.Key[];
	#selected: Set<SelectionModel.Key>;
	#disabled: Set<SelectionModel.Key>;
	#anchorKey: SelectionModel.Key | null = null;

	/**
	 * @param options - Initial mode, known key order, disabled keys, and
	 * pre-selected keys. All are optional and default to an empty,
	 * `"multiple"`-mode model with no known keys.
	 */
	constructor(options: SelectionModel.Options = {}) {
		super();

		this.#mode = options.mode ?? DEFAULT_MODE;
		this.#keys = options.keys ? Array.from(new Set(options.keys)) : [];
		this.#disabled = new Set(options.disabledKeys ?? []);

		let initial = new Set<SelectionModel.Key>();
		for (let key of options.selectedKeys ?? []) {
			if (!this.#disabled.has(key)) initial.add(key);
		}
		this.#selected = normalizeForMode(this.#mode, initial);
	}

	/** Current selection cardinality. */
	get mode(): SelectionModel.Mode {
		return this.#mode;
	}

	/** Known selectable keys, in the order last provided to the constructor or {@link setKeys}. */
	get keys(): readonly SelectionModel.Key[] {
		return this.#keys;
	}

	/** Currently selected keys. */
	get selectedKeys(): ReadonlySet<SelectionModel.Key> {
		return this.#selected;
	}

	/** Keys excluded from selection. */
	get disabledKeys(): ReadonlySet<SelectionModel.Key> {
		return this.#disabled;
	}

	/** Key that anchors the next {@link selectRange} call, or `null` before any point interaction. */
	get anchorKey(): SelectionModel.Key | null {
		return this.#anchorKey;
	}

	/** Number of currently selected keys. */
	get size(): number {
		return this.#selected.size;
	}

	/** `true` when no key is selected. */
	get isEmpty(): boolean {
		return this.#selected.size === 0;
	}

	/**
	 * `true` when every non-disabled key in {@link keys} is selected. Always
	 * `false` when {@link keys} is empty, since there is nothing to select.
	 */
	get isAll(): boolean {
		let selectable = this.#keys.filter((key) => !this.#disabled.has(key));
		return selectable.length > 0 && selectable.every((key) => this.#selected.has(key));
	}

	/**
	 * Replaces the selection mode. The current selection clamps to it
	 * (`"none"` empties it, `"single"` keeps at most the first selected key),
	 * dispatching `"change"` when that clamp shrinks the selected-key set.
	 */
	setMode(mode: SelectionModel.Mode): void {
		if (mode === this.#mode) return;

		this.#mode = mode;
		this.#replaceSelection(normalizeForMode(mode, this.#selected));
	}

	/**
	 * Replaces the known universe of selectable keys, in order. Selected and
	 * anchor keys no longer present in `keys` are dropped, so removing a
	 * rendered row also removes it from the selection.
	 */
	setKeys(keys: Iterable<SelectionModel.Key>): void {
		this.#keys = Array.from(new Set(keys));

		let keySet = new Set(this.#keys);
		let next = new Set<SelectionModel.Key>();
		for (let key of this.#selected) {
			if (keySet.has(key)) next.add(key);
		}

		if (this.#anchorKey !== null && !keySet.has(this.#anchorKey)) this.#anchorKey = null;

		this.#replaceSelection(next);
	}

	/**
	 * Replaces the set of keys excluded from selection. Any of those keys
	 * currently selected are dropped from the selection.
	 */
	setDisabledKeys(keys: Iterable<SelectionModel.Key>): void {
		this.#disabled = new Set(keys);

		let next = new Set<SelectionModel.Key>();
		for (let key of this.#selected) {
			if (!this.#disabled.has(key)) next.add(key);
		}

		this.#replaceSelection(next);
	}

	/** Reports whether `key` is currently selected. */
	isSelected(key: SelectionModel.Key): boolean {
		return this.#selected.has(key);
	}

	/** Reports whether `key` is excluded from selection. */
	isDisabled(key: SelectionModel.Key): boolean {
		return this.#disabled.has(key);
	}

	/**
	 * Selects `key`, replacing the selection in `"single"` mode or adding to
	 * it in `"multiple"` mode. No-op for a disabled key or in `"none"` mode.
	 * Sets {@link anchorKey} to `key` on success.
	 */
	select(key: SelectionModel.Key): void {
		if (this.#mode === "none" || this.#disabled.has(key)) return;

		this.#anchorKey = key;

		if (this.#mode === "single") {
			this.#replaceSelection(new Set([key]));
			return;
		}

		if (this.#selected.has(key)) return;

		let next = new Set(this.#selected);
		next.add(key);
		this.#replaceSelection(next);
	}

	/**
	 * Removes `key` from the selection, regardless of mode. Sets
	 * {@link anchorKey} to `key` when it was selected; no-op otherwise.
	 */
	deselect(key: SelectionModel.Key): void {
		if (!this.#selected.has(key)) return;

		this.#anchorKey = key;

		let next = new Set(this.#selected);
		next.delete(key);
		this.#replaceSelection(next);
	}

	/**
	 * Flips whether `key` is selected, replacing the selection in `"single"`
	 * mode and staying a no-op for a disabled key or in `"none"` mode. Sets
	 * {@link anchorKey} on success; a plain click maps to this operation.
	 */
	toggle(key: SelectionModel.Key): void {
		if (this.#mode === "none" || this.#disabled.has(key)) return;

		this.#anchorKey = key;

		if (this.#selected.has(key)) {
			let next = new Set(this.#selected);
			next.delete(key);
			this.#replaceSelection(next);
			return;
		}

		if (this.#mode === "single") {
			this.#replaceSelection(new Set([key]));
			return;
		}

		let next = new Set(this.#selected);
		next.add(key);
		this.#replaceSelection(next);
	}

	/**
	 * Selects the contiguous span between {@link anchorKey} and `key` in
	 * {@link keys} order, skipping disabled keys; the anchor stays put so
	 * repeated shift-clicks re-span. Anchorless calls run {@link toggle}.
	 */
	selectRange(key: SelectionModel.Key): void {
		if (this.#disabled.has(key)) return;

		if (this.#mode !== "multiple" || this.#anchorKey === null) {
			this.toggle(key);
			return;
		}

		let anchorIndex = this.#keys.indexOf(this.#anchorKey);
		let targetIndex = this.#keys.indexOf(key);
		if (anchorIndex === -1 || targetIndex === -1) {
			this.toggle(key);
			return;
		}

		let start = Math.min(anchorIndex, targetIndex);
		let end = Math.max(anchorIndex, targetIndex);

		let next = new Set<SelectionModel.Key>();
		for (let index = start; index <= end; index += 1) {
			let candidate = this.#keys[index] as SelectionModel.Key;
			if (!this.#disabled.has(candidate)) next.add(candidate);
		}

		this.#replaceSelection(next);
	}

	/**
	 * Selects every non-disabled key in {@link keys}. No-op outside
	 * `"multiple"` mode or when {@link keys} is empty.
	 */
	selectAll(): void {
		if (this.#mode !== "multiple") return;

		let next = new Set<SelectionModel.Key>();
		for (let key of this.#keys) {
			if (!this.#disabled.has(key)) next.add(key);
		}

		this.#replaceSelection(next);
	}

	/** Deselects every key, regardless of mode. */
	clear(): void {
		this.#replaceSelection(new Set());
	}

	/**
	 * Swaps in `next` and dispatches `"change"` only when it differs from
	 * the current selection, so every public method can call this
	 * unconditionally and stay free of no-op guards.
	 */
	#replaceSelection(next: Set<SelectionModel.Key>): void {
		if (setsAreEqual(this.#selected, next)) return;

		this.#selected = next;
		this.dispatchEvent(new Event("change"));
	}
}

/**
 * Clamps `keys` to what `mode` allows: empties it for `"none"`, keeps at
 * most the first key (in iteration order) for `"single"`, and passes
 * `"multiple"` through unchanged.
 */
function normalizeForMode(
	mode: SelectionModel.Mode,
	keys: Set<SelectionModel.Key>,
): Set<SelectionModel.Key> {
	if (mode === "none") return new Set();

	if (mode === "single") {
		let [first] = keys;
		return first === undefined ? new Set() : new Set([first]);
	}

	return keys;
}

function setsAreEqual(a: Set<SelectionModel.Key>, b: Set<SelectionModel.Key>): boolean {
	if (a.size !== b.size) return false;

	for (let key of a) {
		if (!b.has(key)) return false;
	}

	return true;
}
