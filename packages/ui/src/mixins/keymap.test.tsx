// @vitest-environment happy-dom

/**
 * Tests for {@link "./keymap"} against a real document: bindings are put on the document,
 * by the function and by the mixin, and driven by the keystrokes a browser sends from
 * wherever focus sits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { bindKeymap, isClaimedKeystroke, keymap } from "./keymap.js";

let mounted: RenderResult | undefined;
let bindings = new AbortController();

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	bindings.abort();
	bindings = new AbortController();
	document.body.innerHTML = "";
});

/** Sends a keystroke from `target`, bubbling to the document the way a browser sends it. */
function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
	let event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

describe(bindKeymap.name, () => {
	test("runs the binding a keystroke names and claims the keystroke", () => {
		let next = vi.fn();
		let help = vi.fn();
		bindKeymap(document, { j: next, "?": help }, { signal: bindings.signal });

		let event = press(document.body, "j");
		press(document.body, "?", { shiftKey: true });

		expect(next).toHaveBeenCalledOnce();
		expect(help).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBe(true);
	});

	test("leaves a keystroke no binding names untouched", () => {
		bindKeymap(document, { j: vi.fn() }, { signal: bindings.signal });

		expect(press(document.body, "x").defaultPrevented).toBe(false);
	});

	test("stands down while the reader types in a field", () => {
		let next = vi.fn();
		bindKeymap(document, { j: next }, { signal: bindings.signal });
		document.body.innerHTML = `<input id="field" /><div contenteditable="true"><p id="rich">x</p></div>`;

		press(document.getElementById("field")!, "j");
		press(document.getElementById("rich")!, "j");

		expect(next).not.toHaveBeenCalled();
	});

	test("stands down for a keystroke already handled nearer its target", () => {
		let next = vi.fn();
		bindKeymap(document, { j: next }, { signal: bindings.signal });
		document.body.innerHTML = `<button id="claims">x</button>`;
		let button = document.getElementById("claims")!;
		button.addEventListener("keydown", (event) => event.preventDefault());

		press(button, "j");

		expect(next).not.toHaveBeenCalled();
	});

	test("stands down inside a dialog outside its scope, and answers inside one within it", () => {
		let next = vi.fn();
		document.body.innerHTML = `
			<div id="scope"><dialog id="own"><button id="inside-own">x</button></dialog></div>
			<dialog id="other"><button id="inside-other">x</button></dialog>`;
		bindKeymap(
			document,
			{ j: next },
			{ signal: bindings.signal, scope: document.getElementById("scope") },
		);

		press(document.getElementById("inside-other")!, "j");
		expect(next).not.toHaveBeenCalled();

		press(document.getElementById("inside-own")!, "j");
		expect(next).toHaveBeenCalledOnce();
	});

	test("comes off the document when its signal aborts", () => {
		let next = vi.fn();
		bindKeymap(document, { j: next }, { signal: bindings.signal });

		bindings.abort();
		press(document.body, "j");

		expect(next).not.toHaveBeenCalled();
	});
});

describe(isClaimedKeystroke.name, () => {
	test("claims a keystroke mid-composition", () => {
		let event = new KeyboardEvent("keydown", { key: "j", isComposing: true });

		expect(isClaimedKeystroke(event)).toBe(true);
	});
});

describe(keymap.name, () => {
	test("binds while the host is mounted and treats a dialog inside the host as its own", () => {
		let next = vi.fn();
		mounted = render(
			<div mix={[keymap({ j: next })]}>
				<dialog id="help">
					<button id="in-help">x</button>
				</dialog>
			</div>,
		);

		press(document.body, "j");
		press(mounted.$("#in-help")!, "j");
		expect(next).toHaveBeenCalledTimes(2);

		mounted.cleanup();
		mounted = undefined;
		press(document.body, "j");
		expect(next).toHaveBeenCalledTimes(2);
	});
});
