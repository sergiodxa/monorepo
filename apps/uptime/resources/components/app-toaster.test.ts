/**
 * Tests for the app-wide toaster's dispatch side. `showToast` is called from islands whose
 * render functions also run server-side, so the invariant worth pinning is that it stays a
 * no-op without a `document` instead of throwing — a toast is a progressive enhancement,
 * and a crash in the server pass would take the whole page down with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { showToast } from "./app-toaster";

describe("showToast", () => {
	// Vitest's default `node` environment has no browser globals, so this is the server case.
	test("does nothing when there is no document to dispatch on", () => {
		expect(() => showToast({ title: "Homepage is up", color: "success" })).not.toThrow();
	});

	test("dispatches the toast on the document when there is one", () => {
		let received: unknown;
		let target = new EventTarget();
		(globalThis as { document?: unknown }).document = target;

		try {
			target.addEventListener("uptime:toast", (event) => {
				received = (event as CustomEvent).detail;
			});

			showToast({ title: "Homepage is down", description: "Changed", color: "danger" });

			expect(received).toEqual({
				title: "Homepage is down",
				description: "Changed",
				color: "danger",
			});
		} finally {
			delete (globalThis as { document?: unknown }).document;
		}
	});
});
