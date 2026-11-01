/**
 * Measures a drawn toast in a real browser: its icon, the first line of its
 * message, its action and its close button share one centre line, whether the
 * message is a single title or a title over a description that wraps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { pageToaster, Toast } from "./toast.js";
import { Toasts } from "./toasts.js";

import "../reset.css";

const LABELS: Toast.Labels = { region: "Notifications", dismiss: "Dismiss" };

let mounted: RenderResult | undefined;

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	pageToaster().dispose();
	document.body.replaceChildren();
});

/** Vertical centre of a box, in CSS pixels from the viewport's top. */
function centreOf(rect: DOMRect): number {
	return rect.top + rect.height / 2;
}

/** The toast part with `data-slot` equal to `slot`, failing the test when it is missing. */
function part(slot: string): HTMLElement {
	let element = document.querySelector<HTMLElement>(`[data-slot="toast"] [data-slot="${slot}"]`);
	if (!element) throw new Error(`No toast part "${slot}"`);
	return element;
}

/** Vertical centre of the first rendered line of text inside `element`. */
function firstLineCentre(element: HTMLElement): number {
	let text = element.firstChild;
	if (!text) throw new Error("Element has no text");
	let range = document.createRange();
	range.selectNodeContents(text);
	let [first] = range.getClientRects();
	if (!first) throw new Error("Text has no line box");
	return centreOf(first);
}

/** Asserts the toast part named `slot` centres within 1px of `line`. */
function expectOnLine(slot: string, line: number): void {
	expect(Math.abs(centreOf(part(slot).getBoundingClientRect()) - line), slot).toBeLessThanOrEqual(
		1,
	);
}

/** Number of line boxes the text inside `element` wraps onto. */
function lineCount(element: HTMLElement): number {
	let range = document.createRange();
	range.selectNodeContents(element);
	return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
}

/** Mounts the toast stack with one flash toast that stays until it is closed. */
async function mountToast(flash: Omit<Toast.Flash, "id" | "duration">): Promise<void> {
	mounted = render(
		<Toasts labels={LABELS} stack="list" initial={[{ ...flash, id: "t1", duration: null }]} />,
	);
	await vi.waitFor(() => expect(document.querySelector('[data-slot="toast"]')).not.toBeNull());
}

describe("Toast alignment", () => {
	test("a one-line toast draws its icon, message, action and close on one centre line", async () => {
		await mountToast({
			title: "Conversation archived",
			action: { label: "Undo", form: { action: "/restore" } },
		});

		let line = firstLineCentre(part("title"));
		expectOnLine("icon", line);
		expectOnLine("action", line);
		expectOnLine("close", line);
	});

	test("a toast without an action centres its close on the message line", async () => {
		await mountToast({ color: "success", title: "Settings saved" });

		let line = firstLineCentre(part("title"));
		expectOnLine("icon", line);
		expectOnLine("close", line);
	});

	test("a toast with a wrapping description keeps its icon, action and close on the title line", async () => {
		await mountToast({
			color: "danger",
			title: "Couldn't sync",
			description:
				"The server stopped answering before the last batch of changes arrived. Try again in a moment.",
			action: { label: "Retry", form: { action: "/sync" } },
		});

		expect(lineCount(part("description"))).toBeGreaterThanOrEqual(2);
		let line = firstLineCentre(part("title"));
		let toast = document.querySelector<HTMLElement>('[data-slot="toast"]');
		let middle = centreOf(toast!.getBoundingClientRect());
		expect(Math.abs(middle - line)).toBeGreaterThan(8);
		expectOnLine("icon", line);
		expectOnLine("action", line);
		expectOnLine("close", line);
	});
});
