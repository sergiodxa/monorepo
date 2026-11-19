/**
 * Holds `moveFocus` to its contract in a real browser, where visibility is layout: it moves
 * through visible, enabled controls, wraps at either end, starts at the first control from
 * outside, and answers `null` for a container with nothing to focus.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { afterEach, describe, expect, test } from "vitest";

import { moveFocus } from "./move-focus.js";

let root: HTMLElement | undefined;

afterEach(() => {
	root?.remove();
	root = undefined;
});

/** Mounts a container holding `html`. */
function mount(html: string): HTMLElement {
	root = document.createElement("div");
	root.innerHTML = html;
	document.body.appendChild(root);
	return root;
}

describe(moveFocus, () => {
	test("moves through visible, enabled controls and wraps around", () => {
		let container = mount(
			'<button id="a">A</button><button id="hidden" hidden>H</button><textarea id="b"></textarea><button id="c" disabled>C</button>',
		);
		expect(moveFocus(container, 1)?.id).toBe("a");
		expect(moveFocus(container, 1)?.id).toBe("b");
		expect(moveFocus(container, 1)?.id).toBe("a");
		expect(moveFocus(container, -1)?.id).toBe("b");
	});

	test("starts at the first control when focus is outside the container", () => {
		let container = mount('<button id="a">A</button><button id="b">B</button>');
		expect(moveFocus(container, -1)?.id).toBe("a");
	});

	test("answers null when there is nothing to focus", () => {
		let container = mount("<p>Nothing here</p>");
		expect(moveFocus(container, 1)).toBeNull();
	});
});
