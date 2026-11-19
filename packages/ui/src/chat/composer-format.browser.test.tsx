/**
 * Drives the composer's formatting row in a real browser: a button formats the selection
 * and returns focus to the field, a shortcut does the same only in its own field, Undo
 * reverts an edit, and a row with no field to edit does nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { FormatAction } from "./composer-format.js";

import { ComposerFormat } from "./composer-format.js";
import { Composer } from "./composer.js";

import "../reset.css";
import "../theme.css";

const LABELS: Record<FormatAction, string> = {
	bold: "Bold",
	italic: "Italic",
	strike: "Strikethrough",
	code: "Code",
	link: "Link",
	quote: "Quote",
	list: "List",
};

/** Mounts a composer holding the row, with `value` already in its field. */
function mount(value: string, actions?: FormatAction[]) {
	let mounted = render(
		<Composer>
			<Composer.Input aria-label="Message" />
			<Composer.Toolbar>
				<ComposerFormat labels={LABELS} actions={actions} />
			</Composer.Toolbar>
		</Composer>,
	);
	onTestFinished(mounted.cleanup);
	let input = mounted.container.querySelector("textarea")!;
	input.value = value;
	let button = (action: FormatAction) =>
		mounted.container.querySelector<HTMLButtonElement>(`[data-format="${action}"]`)!;
	return { mounted, input, button };
}

describe("ComposerFormat", () => {
	test("Bold wraps the selection, keeps it selected and returns focus to the field", async () => {
		let { input, button } = mount("hi there");
		let heard = vi.fn();
		input.addEventListener("input", heard);
		input.setSelectionRange(3, 8);

		await userEvent.click(button("bold"));

		expect(input.value).toBe("hi **there**");
		expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe("there");
		expect(document.activeElement).toBe(input);
		expect(heard).toHaveBeenCalled();
	});

	test("a second press toggles the format off", async () => {
		let { input, button } = mount("hi there");
		input.setSelectionRange(3, 8);

		await userEvent.click(button("italic"));
		await userEvent.click(button("italic"));

		expect(input.value).toBe("hi there");
	});

	test("List prefixes every selected line", async () => {
		let { input, button } = mount("one\ntwo");
		input.setSelectionRange(0, 7);

		await userEvent.click(button("list"));

		expect(input.value).toBe("- one\n- two");
	});

	test("Control+B formats while the field has focus", async () => {
		let { input } = mount("hi there");
		input.focus();
		input.setSelectionRange(3, 8);

		await userEvent.keyboard("{Control>}b{/Control}");

		expect(input.value).toBe("hi **there**");
	});

	test("a shortcut in another field formats nothing", async () => {
		let { input } = mount("hi there");
		let other = document.createElement("textarea");
		other.value = "elsewhere";
		document.body.appendChild(other);
		onTestFinished(() => other.remove());
		other.focus();
		other.select();

		await userEvent.keyboard("{Control>}b{/Control}");

		expect(input.value).toBe("hi there");
		expect(other.value).toBe("elsewhere");
	});

	test("Undo reverts a format in one step", async () => {
		let { input, button } = mount("");
		input.focus();
		await userEvent.keyboard("hi there");
		input.setSelectionRange(3, 8);
		await userEvent.click(button("bold"));
		expect(input.value).toBe("hi **there**");

		document.execCommand("undo");

		expect(input.value).toBe("hi there");
	});

	test("each button names its action and shows its shortcut in the title", () => {
		let { mounted, button } = mount("", ["bold", "link"]);

		expect(mounted.container.querySelectorAll("[data-format]")).toHaveLength(2);
		expect(button("bold").getAttribute("aria-label")).toBe("Bold");
		expect(button("bold").title).toMatch(/^Bold \((⌘B|Ctrl\+B)\)$/);
		expect(button("link").title).toBe("Link");
	});

	test("a row outside any form has no field and changes nothing", async () => {
		let mounted = render(<ComposerFormat labels={LABELS} />);
		onTestFinished(mounted.cleanup);

		await userEvent.click(mounted.container.querySelector<HTMLElement>('[data-format="bold"]')!);

		expect(mounted.container.querySelector("textarea")).toBeNull();
	});

	test("target names a field outside the row's form", async () => {
		let mounted = render(
			<div>
				<textarea id="notes" aria-label="Notes" />
				<ComposerFormat labels={LABELS} target="notes" />
			</div>,
		);
		onTestFinished(mounted.cleanup);
		let notes = mounted.container.querySelector("textarea")!;
		notes.value = "x";
		notes.setSelectionRange(0, 1);

		await userEvent.click(mounted.container.querySelector<HTMLElement>('[data-format="code"]')!);

		expect(notes.value).toBe("`x`");
	});
});
