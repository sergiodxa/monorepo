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

import { OptimisticToggle } from "./optimistic-toggle.js";

const WORKER = setupWorker();

/** Disposes every island the test mounted. */
let cleanups: Array<() => void> = [];

/** Every body the mocked server received, oldest first. */
let received: Array<Record<string, string>> = [];

/** Mounts a star toggle for one post and returns its form. */
async function mount(pressed = false): Promise<HTMLFormElement> {
	let mounted = render(
		<OptimisticToggle
			action="/posts/42/star"
			name="starred"
			pressed={pressed}
			fields={{ csrf: "t0ken", returnTo: "/inbox" }}
			labels={{ label: "Star", failed: "Failed" }}
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
