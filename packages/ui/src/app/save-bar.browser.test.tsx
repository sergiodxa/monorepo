/**
 * Drives the save bar in a real browser: it appears once the form differs from how it
 * loaded, Discard resets it, ⌘S submits it, and the leave guard holds only while dirty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import type { SaveBarProps } from "./save-bar.js";

import { SaveBar } from "./save-bar.js";

/** Disposes every island the test mounted, detaching its document and window listeners. */
let cleanups: Array<() => void> = [];

const LABELS: SaveBarProps["labels"] = {
	message: "Unsaved changes",
	discard: "Discard",
	save: "Save",
	shortcut: "⌘S",
};

/** Mounts a monitor form with the bar inside it and returns the form and its submissions. */
async function mount(): Promise<{
	form: HTMLFormElement;
	bar: HTMLElement;
	submits: () => number;
}> {
	let host = document.createElement("div");
	document.body.appendChild(host);
	let mounted = render(
		<form method="post" action="/monitors/api">
			<input name="name" defaultValue="api.acme.dev" />
			<select name="interval">
				<option value="60">1 minute</option>
				<option value="30">30 seconds</option>
			</select>
			<SaveBar labels={LABELS} />
		</form>,
		{ container: host },
	);
	cleanups.push(mounted.cleanup);
	await new Promise((resolve) => requestAnimationFrame(resolve));
	let form = host.querySelector("form")!;
	let count = 0;
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		count++;
	});
	return {
		form,
		bar: host.querySelector<HTMLElement>('[data-slot="save-bar"]')!,
		submits: () => count,
	};
}

/** Whether leaving the page now would ask first. */
function guardsLeaving(): boolean {
	let event = new Event("beforeunload", { cancelable: true });
	globalThis.dispatchEvent(event);
	return event.defaultPrevented;
}

/** Lets the island's render settle. */
function settle(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 20));
}

afterEach(() => {
	for (let cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
});

describe("SaveBar", () => {
	test("stays hidden and lets the page go while the form is clean", async () => {
		let { bar } = await mount();

		expect(bar.hidden).toBe(true);
		expect(bar.getBoundingClientRect().height).toBe(0);
		expect(guardsLeaving()).toBe(false);
	});

	test("appears with its message and guards leaving once a field changes", async () => {
		let { form, bar } = await mount();

		await userEvent.type(form.querySelector("input")!, "x");
		await settle();

		expect(bar.hidden).toBe(false);
		expect(bar.getBoundingClientRect().height).toBeGreaterThan(0);
		expect(bar.querySelector('[role="status"]')?.textContent).toBe("Unsaved changes");
		expect(guardsLeaving()).toBe(true);
	});

	test("hides again when the change is undone by hand", async () => {
		let { form, bar } = await mount();
		let input = form.querySelector("input")!;

		await userEvent.type(input, "x");
		await userEvent.type(input, "{Backspace}");
		await settle();

		expect(bar.hidden).toBe(true);
		expect(guardsLeaving()).toBe(false);
	});

	test("resets the form on Discard and drops the guard", async () => {
		let { form, bar } = await mount();
		let input = form.querySelector("input")!;

		await userEvent.type(input, "-eu");
		await settle();
		expect(bar.hidden).toBe(false);

		await userEvent.click(bar.querySelector("button")!);
		await settle();

		expect(input.value).toBe("api.acme.dev");
		expect(bar.hidden).toBe(true);
		expect(guardsLeaving()).toBe(false);
	});

	test("submits on ⌘S and Ctrl+S only while dirty", async () => {
		let { form, submits } = await mount();

		await userEvent.keyboard("{Meta>}s{/Meta}");
		expect(submits()).toBe(0);

		await userEvent.type(form.querySelector("input")!, "x");
		await settle();
		await userEvent.keyboard("{Meta>}s{/Meta}");
		expect(submits()).toBe(1);

		await userEvent.type(form.querySelector("input")!, "y");
		await settle();
		await userEvent.keyboard("{Control>}s{/Control}");
		expect(submits()).toBe(2);
	});

	test("drops the guard when the form is submitted", async () => {
		let { form, bar } = await mount();

		await userEvent.type(form.querySelector("input")!, "x");
		await settle();
		await userEvent.click(bar.querySelector('button[type="submit"]')!);
		await settle();

		expect(guardsLeaving()).toBe(false);
	});
});
