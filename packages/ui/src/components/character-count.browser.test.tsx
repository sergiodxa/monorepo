/**
 * Types into a field beside its character count in a real browser: the server-drawn state
 * matches the field's text, the ring and number follow every keystroke, the number shows
 * only near the limit, Post waits while the field is empty or over, the ring gives way to
 * the number far past the limit, and a screen reader hears each change of state once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { countCharacters } from "../mixins/character-count.js";

import { CharacterCount } from "./character-count.js";

import "../reset.css";
import "../theme.css";

/** Announcement templates. */
const LABELS = { remaining: "{count} characters left", over: "{count} characters over the limit" };

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a form with a 20-character field and its count, then waits for the island. */
async function mount(value = "", holdSubmit = true) {
	mounted = render(
		<form>
			<textarea id="draft" name="text" defaultValue={value} />
			<CharacterCount
				for="draft"
				max={20}
				warn={5}
				value={value}
				holdSubmit={holdSubmit}
				labels={LABELS}
			/>
			<button type="submit">Post</button>
		</form>,
	);
	await new Promise((resolve) => requestAnimationFrame(resolve));
	await new Promise((resolve) => setTimeout(resolve, 0));
	let root = mounted.container;
	return {
		field: root.querySelector("textarea")!,
		count: root.querySelector<HTMLElement>('[data-slot="character-count"]')!,
		number: root.querySelector<HTMLElement>("[data-character-count-number]")!,
		status: root.querySelector<HTMLElement>("[data-character-count-status]")!,
		submit: root.querySelector<HTMLButtonElement>('button[type="submit"]')!,
		ring: root.querySelector<SVGElement>("[data-character-count-ring]")!,
	};
}

/** Replaces the field's text as typing does, firing `input`. */
function type(field: HTMLTextAreaElement, text: string) {
	field.value = text;
	field.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CharacterCount", () => {
	test("opens on the state of the text the server rendered", async () => {
		let { count, number } = await mount("Seventeen letters");

		expect(count.dataset.state).toBe("warn");
		expect(number.textContent).toBe("3");
	});

	test("shows no number while there is room, then the characters left near the limit", async () => {
		let { count, field, number } = await mount();

		type(field, "Short");
		expect(count.dataset.state).toBe("ok");
		expect(number.textContent).toBe("");

		type(field, "Getting close now..");
		expect(count.dataset.state).toBe("warn");
		expect(number.textContent).toBe("1");
	});

	test("fills the ring in step with the text", async () => {
		let { count, field } = await mount();

		type(field, "1234567890");
		expect(count.style.getPropertyValue("--ui-character-count-progress")).toBe("0.5");
	});

	test("holds the submit button while empty or over, and marks the field invalid past the limit", async () => {
		let { field, submit } = await mount();

		expect(submit.disabled).toBe(true);
		type(field, "Fine");
		expect(submit.disabled).toBe(false);
		type(field, "This is well over twenty");
		expect(submit.disabled).toBe(true);
		expect(field.getAttribute("aria-invalid")).not.toBeNull();
	});

	test("leaves the submit button alone without holdSubmit", async () => {
		let { submit } = await mount("", false);

		expect(submit.disabled).toBe(false);
	});

	test("drops the ring for the number alone ten past the limit", async () => {
		let { count, field, number, ring } = await mount();

		type(field, "a".repeat(25));
		expect(count.hasAttribute("data-ring-hidden")).toBe(false);
		type(field, "a".repeat(30));
		expect(count.hasAttribute("data-ring-hidden")).toBe(true);
		expect(number.textContent).toBe("-10");
		await expect.poll(() => getComputedStyle(ring).opacity).toBe("0");
	});

	test("announces each change of state once, not every keystroke", async () => {
		let { field, status } = await mount();

		type(field, "a".repeat(16));
		expect(status.textContent).toBe("4 characters left");
		status.textContent = "";
		type(field, "a".repeat(17));
		expect(status.textContent).toBe("");
		type(field, "a".repeat(22));
		expect(status.textContent).toBe("2 characters over the limit");
	});

	test("counts what a reader sees as one character once", () => {
		expect(countCharacters("👋🏽")).toBe(1);
		expect(countCharacters("🇵🇹 Lisboa")).toBe(8);
		expect(countCharacters("e\u0301")).toBe(1);
	});
});
