/**
 * Checks Quoin's "start a project" form in a real browser: an untouched form shows no
 * corrections, a refused submit reveals one under each field the browser marks
 * `:user-invalid`, a complete brief submits, and the budget tiles fill when chosen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import StudioEnquiry from "~/resources/views/demos/studio/enquiry";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts the band in a `width`-pixel column and returns its form. */
function mount(width: number): HTMLFormElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(<StudioEnquiry />, { container: host });
	let form = host.querySelector<HTMLFormElement>('form[data-slot="studio-enquiry"]');
	if (!form) throw new Error("missing the enquiry form");
	return form;
}

/** The corrections currently drawn on screen. */
function shownHints(form: HTMLFormElement): string[] {
	return [...form.querySelectorAll<HTMLElement>('[data-slot="studio-hint"]')]
		.filter((hint) => getComputedStyle(hint).display !== "none")
		.map((hint) => hint.textContent ?? "");
}

/** Types into a control and leaves it, so the browser counts the value as the reader's edit. */
async function type(form: HTMLFormElement, name: string, value: string) {
	let control = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
	await userEvent.fill(control, value);
	await userEvent.tab();
}

describe("Quoin's enquiry form", () => {
	test("posts to the example endpoint and starts with no corrections", () => {
		let form = mount(1280);
		expect(form.method).toBe("post");
		expect(new URL(form.action).pathname).toBe("/examples/studio/enquiry");
		expect(form.checkValidity()).toBe(false);
		expect(shownHints(form)).toEqual([]);
	});

	test("refuses an empty brief and explains each required field", () => {
		let form = mount(1280);
		let submitted = false;
		form.addEventListener("submit", (event) => {
			submitted = true;
			event.preventDefault();
		});

		form.requestSubmit();

		expect(submitted).toBe(false);
		expect(shownHints(form)).toHaveLength(5);
	});

	test("explains a malformed email once the reader leaves the field", async () => {
		let form = mount(1280);
		await type(form, "email", "lieve-at-antwerp");
		expect(shownHints(form)).toEqual(["Enter an email address, like you@company.com."]);
	});

	test("submits a complete brief", async () => {
		let form = mount(1280);
		let submitted = false;
		form.addEventListener("submit", (event) => {
			submitted = true;
			event.preventDefault();
		});

		await type(form, "name", "Lieve Martens");
		await type(form, "email", "lieve@example.com");
		await type(
			form,
			"brief",
			"Our riders miss the tram after the ferry; we want them to stop missing it.",
		);
		await userEvent.click(
			form
				.querySelector<HTMLInputElement>('input[name="budget"][value="80-150"]')!
				.closest("label")!,
		);
		await userEvent.selectOptions(
			form.elements.namedItem("start") as HTMLSelectElement,
			"March 2027",
		);
		form.requestSubmit();

		expect(
			[...form.elements]
				.filter((e) => !(e as HTMLInputElement).checkValidity())
				.map((e) => (e as HTMLInputElement).name),
		).toEqual([]);
		expect(submitted).toBe(true);
		expect(new FormData(form).get("budget")).toBe("80-150");
	});

	test("fills the chosen budget tile with the ink", async () => {
		let form = mount(375);
		form.style.setProperty("--ui-neutral-fg-emphasis", "rgb(10, 20, 30)");
		let tile = form
			.querySelector<HTMLInputElement>('input[name="budget"][value="150-300"]')!
			.closest("label")!;
		expect(getComputedStyle(tile).backgroundColor).toBe("rgba(0, 0, 0, 0)");

		await userEvent.click(tile);

		expect(getComputedStyle(tile).backgroundColor).toBe("rgb(10, 20, 30)");
		expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
	});
});
