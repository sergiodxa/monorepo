/**
 * Presses the optimistic toggle in a real browser against a mocked server: it flips at
 * once, posts the form in the background, puts itself back and says "Failed" when the
 * server refuses, and renders a plain POST form for a browser without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { delay, http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { OptimisticToggleProps } from "./optimistic-toggle.js";

import { OptimisticToggle } from "./optimistic-toggle.js";

const WORKER = setupWorker();

/** Disposes every island the test mounted. */
let cleanups: Array<() => void> = [];

/** Every body the mocked server received, oldest first. */
let received: Array<Record<string, string>> = [];

/** Mounts a star toggle for one post and returns its form. */
async function mount(
	pressed = false,
	labels: OptimisticToggleProps["labels"] = { label: "Star", failed: "Failed" },
): Promise<HTMLFormElement> {
	let mounted = render(
		<OptimisticToggle
			action="/posts/42/star"
			name="starred"
			pressed={pressed}
			fields={{ csrf: "t0ken", returnTo: "/inbox" }}
			labels={labels}
		/>,
	);
	cleanups.push(mounted.cleanup);
	await new Promise((resolve) => requestAnimationFrame(resolve));
	return mounted.container.querySelector("form")!;
}

/** The toggle's button. */
function button(form: HTMLFormElement): HTMLButtonElement {
	return form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
}

/** Answers the star endpoint with `status`, after `wait` milliseconds. */
function answer(status: number, wait = 0) {
	WORKER.use(
		http.post("/posts/42/star", async ({ request }) => {
			received.push(Object.fromEntries((await request.formData()) as Iterable<[string, string]>));
			await delay(wait);
			return new HttpResponse(null, { status });
		}),
	);
}

beforeAll(async () => {
	await WORKER.start({ quiet: true, onUnhandledRequest: "bypass" });
});

afterEach(() => {
	for (let cleanup of cleanups.splice(0)) cleanup();
	WORKER.resetHandlers();
	received = [];
	document.body.replaceChildren();
});

afterAll(() => {
	WORKER.stop();
});

describe("OptimisticToggle", () => {
	test("renders a plain POST form that submits the next state", async () => {
		let form = await mount(false);

		expect(form.method).toBe("post");
		expect(form.getAttribute("action")).toBe("/posts/42/star");
		let data = Object.fromEntries(new FormData(form));
		expect(data).toEqual({ csrf: "t0ken", returnTo: "/inbox", starred: "true" });
		expect(button(form).getAttribute("aria-pressed")).toBe("false");
		expect(button(form).innerText).toBe("Star");
	});

	test("flips before the server answers and posts in the background", async () => {
		answer(200, 300);
		let form = await mount(false);

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(button(form).getAttribute("aria-pressed")).toBe("true");
		expect(form.hasAttribute("data-pressed")).toBe(true);

		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(received).toEqual([{ csrf: "t0ken", returnTo: "/inbox", starred: "true" }]);
		expect(button(form).getAttribute("aria-pressed")).toBe("true");
		expect(form.querySelector('[role="status"]')?.textContent).toBe("");
	});

	test("puts itself back and says Failed in place when the server refuses", async () => {
		answer(500);
		let form = await mount(true);
		let events: Array<{ pressed: boolean; failed: boolean }> = [];
		let settled: boolean[] = [];
		form.addEventListener("ui:optimistic-toggle", (event) => {
			events.push({ pressed: event.pressed, failed: event.failed });
			settled.push(event.settled);
		});

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(button(form).getAttribute("aria-pressed")).toBe("true");
		expect(button(form).dataset.color).toBe("danger");
		expect(form.querySelector('[role="status"]')?.textContent).toBe("Failed");
		expect(events).toEqual([
			{ pressed: false, failed: false },
			{ pressed: true, failed: true },
		]);
		expect(settled).toEqual([false, true]);
	});

	test("tells the page once the server confirms the change", async () => {
		answer(204, 100);
		let form = await mount(false);
		let events: Array<{ pressed: boolean; failed: boolean; settled: boolean }> = [];
		form.addEventListener("ui:optimistic-toggle", (event) =>
			events.push({ pressed: event.pressed, failed: event.failed, settled: event.settled }),
		);

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(events).toEqual([{ pressed: true, failed: false, settled: false }]);

		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(events).toEqual([
			{ pressed: true, failed: false, settled: false },
			{ pressed: true, failed: false, settled: true },
		]);
	});

	test("confirms only the newest press when presses overlap", async () => {
		answer(204, 150);
		let form = await mount(false);
		let settled: boolean[] = [];
		form.addEventListener("ui:optimistic-toggle", (event) => {
			if (event.settled) settled.push(event.pressed);
		});

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 30));
		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 400));

		expect(settled).toEqual([false]);
	});

	test("says the refusal copy listed for the response status", async () => {
		answer(507);
		let form = await mount(false, {
			label: "Save",
			failed: "Could not be saved",
			refused: { 507: "Your saved posts are full" },
		});
		let statuses: Array<number | null> = [];
		form.addEventListener("ui:optimistic-toggle", (event) => statuses.push(event.status));

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(form.querySelector('[role="status"]')?.textContent).toBe("Your saved posts are full");
		expect(button(form).getAttribute("aria-pressed")).toBe("false");
		expect(statuses).toEqual([null, 507]);
	});

	test("falls back to the failed copy for a status the refusals leave out", async () => {
		answer(409);
		let form = await mount(false, {
			label: "Save",
			failed: "Could not be saved",
			refused: { 507: "Your saved posts are full" },
		});
		let statuses: Array<number | null> = [];
		form.addEventListener("ui:optimistic-toggle", (event) => statuses.push(event.status));

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(form.querySelector('[role="status"]')?.textContent).toBe("Could not be saved");
		expect(statuses).toEqual([null, 409]);
	});

	test("reports a network error with no status", async () => {
		WORKER.use(http.post("/posts/42/star", () => HttpResponse.error()));
		let form = await mount(true, {
			label: "Save",
			failed: "Could not be saved",
			refused: { 507: "Your saved posts are full" },
		});
		let events: Array<{ failed: boolean; settled: boolean; status: number | null }> = [];
		form.addEventListener("ui:optimistic-toggle", (event) =>
			events.push({ failed: event.failed, settled: event.settled, status: event.status }),
		);

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(form.querySelector('[role="status"]')?.textContent).toBe("Could not be saved");
		expect(button(form).getAttribute("aria-pressed")).toBe("true");
		expect(events).toEqual([
			{ failed: false, settled: false, status: null },
			{ failed: true, settled: true, status: null },
		]);
	});

	test("reports the status of a confirmed change", async () => {
		answer(204);
		let form = await mount(false);
		let statuses: Array<number | null> = [];
		form.addEventListener("ui:optimistic-toggle", (event) => statuses.push(event.status));

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(statuses).toEqual([null, 204]);
	});

	test("names the control by the pressed label while on", async () => {
		answer(204, 100);
		let form = await mount(false, {
			label: "Mark as read",
			pressed: "Mark as unread",
			failed: "Failed",
		});
		expect(button(form).title).toBe("Mark as read");
		expect(button(form).innerText).toBe("Mark as read");

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(button(form).title).toBe("Mark as unread");
		expect(button(form).innerText).toBe("Mark as unread");
		expect(button(form).getAttribute("aria-pressed")).toBe("true");
	});

	test("renders the pressed label when the server says it is on", async () => {
		let form = await mount(true, { label: "Save", pressed: "Unsave", failed: "Failed" });

		expect(button(form).title).toBe("Unsave");
		expect(button(form).innerText).toBe("Unsave");
	});

	test("puts the accessible name back with the state on a refusal", async () => {
		answer(500, 150);
		let mounted = render(
			<OptimisticToggle
				action="/posts/42/star"
				name="starred"
				pressed={false}
				labels={{ label: "Star", pressed: "Unstar", failed: "Failed" }}
				pressedContent="★"
				unpressedContent="☆"
			/>,
		);
		cleanups.push(mounted.cleanup);
		await new Promise((resolve) => requestAnimationFrame(resolve));
		let form = mounted.container.querySelector("form")!;
		expect(button(form).getAttribute("aria-label")).toBe("Star");

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(button(form).getAttribute("aria-label")).toBe("Unstar");
		expect(button(form).title).toBe("Unstar");

		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(button(form).getAttribute("aria-label")).toBe("Star");
		expect(button(form).title).toBe("Star");
	});

	test("clears the failure on the next press", async () => {
		answer(500);
		let form = await mount(false);

		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(form.hasAttribute("data-failed")).toBe(true);

		WORKER.resetHandlers();
		answer(200);
		button(form).click();
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(form.hasAttribute("data-failed")).toBe(false);
		expect(button(form).getAttribute("aria-pressed")).toBe("true");
	});
});
