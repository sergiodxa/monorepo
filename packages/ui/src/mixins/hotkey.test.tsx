// @vitest-environment happy-dom

/**
 * Tests for {@link "./hotkey"} against a real document, on a host the client inserts and
 * on one an island adopts from server HTML, so a page whose shortcut sits inside a
 * hydrated island answers the keystroke the same way a client-rendered one does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { clientEntry, run } from "remix/component";
import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { hotkey } from "./hotkey.js";

let mounted: RenderResult | undefined;
let app: AppRuntime | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	app?.dispose();
	app = undefined;
	document.body.innerHTML = "";
});

/** Sends ⌘I from the document, the way a browser sends a shortcut struck outside any field. */
function pressModI(): KeyboardEvent {
	let event = new KeyboardEvent("keydown", {
		key: "i",
		code: "KeyI",
		metaKey: true,
		bubbles: true,
		cancelable: true,
	});
	document.dispatchEvent(event);
	return event;
}

/** The island under test: a dialog carrying the shortcut, as a page ships it to the browser. */
const ISLAND = clientEntry("/hotkey-island.tsx#HotkeyIsland", function HotkeyIsland() {
	return () => (
		<div>
			<dialog id="invite" mix={[hotkey("mod+i")]}>
				Invite people
			</dialog>
		</div>
	);
});

describe(hotkey.name, () => {
	test("toggles a dialog the client inserted", () => {
		mounted = render(<dialog id="invite" mix={[hotkey("mod+i")]} />);
		let dialog = mounted.$("#invite") as HTMLDialogElement;

		expect(pressModI().defaultPrevented).toBe(true);
		expect(dialog.open).toBe(true);

		pressModI();
		expect(dialog.open).toBe(false);
	});

	test("toggles a dialog an island adopted from server HTML", async () => {
		document.body.innerHTML = await renderToString(<ISLAND />);
		let dialog = document.getElementById("invite") as HTMLDialogElement;

		app = run({ loadModule: () => ISLAND });
		await app.ready();

		expect(document.getElementById("invite")).toBe(dialog);
		pressModI();
		expect(dialog.open).toBe(true);
	});

	test("comes off the document when the host unmounts", () => {
		mounted = render(<dialog id="invite" mix={[hotkey("mod+i")]} />);
		let dialog = mounted.$("#invite") as HTMLDialogElement;

		mounted.cleanup();
		mounted = undefined;

		expect(pressModI().defaultPrevented).toBe(false);
		expect(dialog.open).toBe(false);
	});
});
