/**
 * Types into an autocomplete in a real browser: the server markup suggests through a native
 * datalist, and once its island mounts the field opens a styled list with a heading, filters
 * as it is typed in, walks with the arrows, picks on Enter or a press without submitting the
 * form, closes on Escape, carries the picked value in a hidden field and fits a 320px screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { AutocompleteSelectDetail } from "./autocomplete.js";

import { Autocomplete } from "./autocomplete.js";

import "../reset.css";
import "../theme.css";

/** The destinations every test searches. */
const OPTIONS: Array<Autocomplete.Option> = [
	{ value: "lis", label: "Lisbon", description: "Portugal", icon: <svg viewBox="0 0 16 16" /> },
	{ value: "por", label: "Porto", description: "Portugal" },
	{ value: "mad", label: "Madrid", description: "Spain" },
	{ value: "bcn", label: "Barcelona", description: "Catalonia, Spain" },
];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
	await page.viewport(1024, 768);
});

/** Mounts the autocomplete in a form, letting the island enhance it. */
async function mount(props: Partial<Autocomplete.Props> = {}) {
	let submit = vi.fn((event: SubmitEvent) => event.preventDefault());
	mounted = render(
		<form>
			<Autocomplete
				id="where"
				name="where"
				label="Where to?"
				heading="Suggested destinations"
				placeholder="Search destinations"
				options={OPTIONS}
				{...props}
			/>
			<button type="submit">Search</button>
		</form>,
	);
	await new Promise((resolve) => requestAnimationFrame(resolve));
	let root = mounted.container;
	root.querySelector("form")!.addEventListener("submit", submit);
	return {
		root,
		submit,
		input: root.querySelector<HTMLInputElement>("#where")!,
		popup: root.querySelector<HTMLElement>("#where-popup")!,
		heading: root.querySelector<HTMLElement>("[data-autocomplete-heading]")!,
		empty: root.querySelector<HTMLElement>("[data-autocomplete-empty]")!,
	};
}

/** The labels of the options the list shows. */
function shownLabels(root: HTMLElement): Array<string> {
	return Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'))
		.filter((option) => !option.hidden)
		.map((option) => option.dataset.label ?? "");
}

describe("Autocomplete", () => {
	test("renders a plain field suggesting through a native datalist before any script", async () => {
		document.body.innerHTML = await renderToString(
			<Autocomplete id="where" name="where" label="Where to?" options={OPTIONS} />,
		);
		let input = document.querySelector<HTMLInputElement>("#where")!;
		let datalist = document.getElementById(input.getAttribute("list") ?? "");

		expect(input.getAttribute("role")).toBeNull();
		expect(datalist?.tagName).toBe("DATALIST");
		expect(Array.from(datalist!.querySelectorAll("option")).map((o) => o.value)).toEqual([
			"Lisbon",
			"Porto",
			"Madrid",
			"Barcelona",
		]);
		expect(document.querySelector<HTMLElement>("#where-popup")!.matches(":popover-open")).toBe(
			false,
		);
	});

	test("becomes a combobox that opens its list with the heading on focus", async () => {
		let { input, popup, heading } = await mount();

		expect(input.hasAttribute("list")).toBe(false);
		expect(input.getAttribute("role")).toBe("combobox");
		expect(input.getAttribute("aria-autocomplete")).toBe("list");
		expect(input.getAttribute("aria-controls")).toBe("where-listbox");
		expect(input.getAttribute("aria-expanded")).toBe("false");

		input.focus();
		expect(popup.matches(":popover-open")).toBe(true);
		expect(input.getAttribute("aria-expanded")).toBe("true");
		expect(heading.hidden).toBe(false);
		expect(popup.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			input.getBoundingClientRect().bottom,
		);
	});

	test("filters by label and description as the reader types, marking the match", async () => {
		let { root, input, heading, empty } = await mount();

		await userEvent.click(input);
		await userEvent.keyboard("spain");
		expect(shownLabels(root)).toEqual(["Madrid", "Barcelona"]);
		expect(heading.hidden).toBe(true);

		await userEvent.clear(input);
		await userEvent.keyboard("POR");
		expect(shownLabels(root)).toEqual(["Lisbon", "Porto"]);
		expect(root.querySelector("#where-option-1 [data-autocomplete-label] mark")?.textContent).toBe(
			"Por",
		);

		await userEvent.keyboard("xyz");
		expect(shownLabels(root)).toEqual([]);
		expect(empty.hidden).toBe(false);
		expect(empty.textContent).toBe("No matches");
	});

	test("walks the shown options with the arrows through aria-activedescendant", async () => {
		let { input } = await mount();

		await userEvent.click(input);
		await userEvent.keyboard("spain");
		await userEvent.keyboard("{ArrowDown}");
		expect(input.getAttribute("aria-activedescendant")).toBe("where-option-2");
		await userEvent.keyboard("{ArrowDown}");
		expect(input.getAttribute("aria-activedescendant")).toBe("where-option-3");
		expect(document.getElementById("where-option-3")?.getAttribute("aria-selected")).toBe("true");
		await userEvent.keyboard("{ArrowDown}");
		expect(input.getAttribute("aria-activedescendant")).toBe("where-option-2");
		await userEvent.keyboard("{ArrowUp}");
		expect(input.getAttribute("aria-activedescendant")).toBe("where-option-3");
	});

	test("picks on Enter, firing change and autocomplete-select, without submitting", async () => {
		let { root, input, popup, submit } = await mount();
		let change = vi.fn();
		let select = vi.fn((event: CustomEvent<AutocompleteSelectDetail>) => event.detail);
		root.addEventListener("change", change);
		root.addEventListener("autocomplete-select", select);

		await userEvent.click(input);
		await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

		expect(input.value).toBe("Porto");
		expect(popup.matches(":popover-open")).toBe(false);
		expect(change).toHaveBeenCalledTimes(1);
		expect(select).toHaveReturnedWith({ value: "por", label: "Porto" });
		expect(submit).not.toHaveBeenCalled();
	});

	test("closes on the first Escape and clears the field on the second", async () => {
		let { input, popup } = await mount();

		await userEvent.click(input);
		await userEvent.keyboard("Lis");
		await userEvent.keyboard("{Escape}");
		expect(popup.matches(":popover-open")).toBe(false);
		expect(input.value).toBe("Lis");
		await userEvent.keyboard("{Escape}");
		expect(input.value).toBe("");
	});

	test("picks an option pressed with the pointer, and closes on a press elsewhere", async () => {
		let { input, popup } = await mount();

		await userEvent.click(input);
		await userEvent.click(page.getByRole("option", { name: /Madrid/ }));
		expect(input.value).toBe("Madrid");
		expect(document.activeElement).toBe(input);

		await userEvent.click(input);
		expect(popup.matches(":popover-open")).toBe(true);
		await userEvent.click(document.body, { position: { x: 5, y: 700 } });
		expect(popup.matches(":popover-open")).toBe(false);
	});

	test("carries the picked value in a hidden field until the text is edited", async () => {
		let { root, input } = await mount({ valueName: "placeId" });
		let hidden = root.querySelector<HTMLInputElement>('input[name="placeId"]')!;

		await userEvent.click(input);
		await userEvent.keyboard("Barc{ArrowDown}{Enter}");
		expect(input.value).toBe("Barcelona");
		expect(hidden.value).toBe("bcn");
		expect(new FormData(root.querySelector("form")!).get("where")).toBe("Barcelona");

		await userEvent.keyboard("{Backspace}");
		expect(hidden.value).toBe("");
	});

	test("draws a bare field with no border or background", async () => {
		let { input } = await mount({ variant: "bare" });
		let style = getComputedStyle(input);

		expect(style.borderTopWidth).toBe("0px");
		expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
	});

	test("fits a 320px screen, field and open list alike", async () => {
		await page.viewport(320, 640);
		let { input, popup } = await mount();

		input.focus();
		let list = popup.getBoundingClientRect();
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
		expect(input.getBoundingClientRect().right).toBeLessThanOrEqual(320);
		expect(list.left).toBeGreaterThanOrEqual(0);
		expect(list.right).toBeLessThanOrEqual(320);
	});
});
