// @vitest-environment happy-dom

/**
 * Tests for the branch state {@link "./treeKeys"} keeps in step against a real
 * document: a source tree is mounted with the mixin applied, and each
 * assertion reads back both halves a branch carries — the `aria-expanded` a
 * reader hears and the `[open]` its `<details>` reveals the subtree from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { SelectionModel } from "../behaviors/selection-model.js";

import { treeKeys } from "./treeKeys.js";

/** Every row the mounted tree renders, in document order. */
const KEYS = ["ui", "ui/components", "ui/components/tree.tsx", "ui/package.json"];

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/**
 * Mounts the markup a Tree renders — a `<summary>` row per node inside the
 * `<details>` holding its subtree — with the root open around one collapsed
 * branch and one leaf.
 */
function mountTree(model: SelectionModel): RenderResult {
	mounted = render(
		<div role="tree" aria-label="Repository files" mix={[treeKeys(model)]}>
			<details open>
				<summary
					data-tree-item="ui"
					role="treeitem"
					aria-level={1}
					aria-expanded="true"
					tabIndex={-1}
				>
					ui
				</summary>

				<details>
					<summary
						data-tree-item="ui/components"
						role="treeitem"
						aria-level={2}
						aria-expanded="false"
						tabIndex={-1}
					>
						components
					</summary>
					<details>
						<summary
							data-tree-item="ui/components/tree.tsx"
							role="treeitem"
							aria-level={3}
							tabIndex={-1}
						>
							tree.tsx
						</summary>
					</details>
				</details>

				<details>
					<summary data-tree-item="ui/package.json" role="treeitem" aria-level={2} tabIndex={-1}>
						package.json
					</summary>
				</details>
			</details>
		</div>,
	);

	return mounted;
}

/** The row carrying `key`, as a keystroke or an assertion reaches for it. */
function row(view: RenderResult, key: string): HTMLElement {
	let node = view.$(`[data-tree-item="${key}"]`);
	if (node === null) throw new Error(`No row for ${key}`);
	return node;
}

/** The `<details>` the row carrying `key` reveals its subtree from. */
function disclosure(view: RenderResult, key: string): HTMLDetailsElement {
	let node = row(view, key).closest("details");
	if (node === null) throw new Error(`No disclosure for ${key}`);
	return node;
}

/** Sends a keystroke from whatever currently holds focus. */
function press(key: string, init: KeyboardEventInit = {}): void {
	let target = document.activeElement ?? document.body;
	target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
}

/** Opens or closes a branch the way a press on its row does, from the platform's side alone. */
function toggle(view: RenderResult, key: string, open: boolean): void {
	let node = disclosure(view, key);
	node.open = open;
	node.dispatchEvent(new Event("toggle"));
}

describe(treeKeys.name, () => {
	test("reveals the subtree the ARIA state says it expanded", () => {
		let view = mountTree(new SelectionModel({ keys: KEYS }));

		row(view, "ui/components").focus();
		press("ArrowRight");

		expect(row(view, "ui/components").getAttribute("aria-expanded")).toBe("true");
		expect(disclosure(view, "ui/components").open).toBe(true);
	});

	test("hides the subtree again when the ARIA state collapses", () => {
		let view = mountTree(new SelectionModel({ keys: KEYS }));

		row(view, "ui").focus();
		press("ArrowLeft");

		expect(row(view, "ui").getAttribute("aria-expanded")).toBe("false");
		expect(disclosure(view, "ui").open).toBe(false);
	});

	test("leaves a nested branch's own disclosure as it was", () => {
		let view = mountTree(new SelectionModel({ keys: KEYS }));

		toggle(view, "ui/components", true);
		row(view, "ui").focus();
		press("ArrowLeft");

		expect(disclosure(view, "ui/components").open).toBe(true);
	});

	test("announces the branch a press straight on the row opened", () => {
		let view = mountTree(new SelectionModel({ keys: KEYS }));

		toggle(view, "ui/components", true);

		expect(row(view, "ui/components").getAttribute("aria-expanded")).toBe("true");
	});

	test("keeps a leaf silent about an expanded state it has none of", () => {
		let view = mountTree(new SelectionModel({ keys: KEYS }));

		toggle(view, "ui/package.json", true);

		expect(row(view, "ui/package.json").hasAttribute("aria-expanded")).toBe(false);
	});

	test("walks into the rows a press straight on the row revealed", () => {
		let view = mountTree(new SelectionModel({ keys: KEYS }));

		toggle(view, "ui/components", true);
		row(view, "ui/components").focus();
		press("ArrowDown");

		expect(document.activeElement).toBe(row(view, "ui/components/tree.tsx"));
	});

	test("collapses a branch opened by a press on the row, from the keyboard", () => {
		let view = mountTree(new SelectionModel({ keys: KEYS }));

		toggle(view, "ui/components", true);
		row(view, "ui/components").focus();
		press("ArrowLeft");

		expect(disclosure(view, "ui/components").open).toBe(false);
		expect(row(view, "ui/components").getAttribute("aria-expanded")).toBe("false");
	});

	test("counts a revealed row among the keys select-all spans", () => {
		let model = new SelectionModel({ mode: "multiple", keys: KEYS });
		let view = mountTree(model);

		toggle(view, "ui/components", true);
		row(view, "ui").focus();
		press("a", { ctrlKey: true });

		expect(model.isSelected("ui/components/tree.tsx")).toBe(true);
	});
});
