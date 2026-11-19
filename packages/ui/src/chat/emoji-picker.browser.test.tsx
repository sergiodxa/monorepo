/**
 * Drives the emoji picker in a real browser: the trigger opens the grid with the filter
 * focused, the filter narrows it or says nothing matched, the arrow keys walk the grid,
 * a pick in a composer lands at the caret, and a pick in a form posts the emoji.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { Composer } from "./composer.js";
import { EMOJI, EmojiPicker } from "./emoji-picker.js";

import "../reset.css";
import "../theme.css";

const LABELS = { trigger: "Insert emoji", search: "Search emoji", empty: "No emoji found" };

/** Mounts a composer with an insert-mode picker in its toolbar. */
function mountComposer() {
	let mounted = render(
		<Composer style="margin-block-start: 24rem">
			<Composer.Input aria-label="Message" />
			<Composer.Toolbar>
				<EmojiPicker id="picker" labels={LABELS} />
			</Composer.Toolbar>
		</Composer>,
	);
	onTestFinished(mounted.cleanup);
	return parts(mounted.container);
}

/** The picker's trigger, panel, filter and the emoji buttons it currently lists. */
function parts(container: HTMLElement) {
	let trigger = container.querySelector<HTMLButtonElement>('[data-slot="emoji-picker-trigger"]')!;
	let panel = container.querySelector<HTMLElement>("#picker")!;
	let search = panel.querySelector<HTMLInputElement>("[data-emoji-search]")!;
	let buttons = () => Array.from(panel.querySelectorAll<HTMLButtonElement>("[data-emoji]"));
	let input = container.querySelector("textarea");
	return { trigger, panel, search, buttons, input };
}

describe("EmojiPicker", () => {
	test("the trigger opens the grid under headings with the filter focused", async () => {
		let { trigger, panel, search, buttons } = mountComposer();

		await userEvent.click(trigger);

		expect(panel.matches(":popover-open")).toBe(true);
		await vi.waitFor(() => expect(document.activeElement).toBe(search));
		expect(buttons()).toHaveLength(EMOJI.length);
		expect(panel.querySelectorAll('[role="group"]')).toHaveLength(6);
		let thumbs = panel.querySelector<HTMLElement>('[data-emoji="👍"]')!;
		expect(thumbs.getAttribute("aria-label")).toBe("thumbs up");
		expect(thumbs.title).toBe("thumbs up");
	});

	test("the filter narrows by name and says when nothing matches", async () => {
		let { trigger, panel, buttons } = mountComposer();
		await userEvent.click(trigger);

		await userEvent.keyboard("thumbs");
		await vi.waitFor(() =>
			expect(buttons().map((button) => button.dataset.emoji)).toEqual(["👍", "👎"]),
		);
		expect(panel.querySelectorAll('[role="group"]')).toHaveLength(1);

		await userEvent.keyboard("xyz");
		await vi.waitFor(() => expect(buttons()).toHaveLength(0));
		expect(panel.textContent).toContain("No emoji found");
	});

	test("a pick lands at the caret, closes the grid and returns to the field", async () => {
		let { trigger, panel, input } = mountComposer();
		input!.value = "hi there";
		input!.setSelectionRange(2, 2);
		let heard = vi.fn();
		input!.addEventListener("input", heard);

		await userEvent.click(trigger);
		await userEvent.click(panel.querySelector<HTMLElement>('[data-emoji="🔥"]')!);

		expect(input!.value).toBe("hi🔥 there");
		expect(panel.matches(":popover-open")).toBe(false);
		expect(document.activeElement).toBe(input);
		expect(heard).toHaveBeenCalled();
	});

	test("Enter in the filter picks the first match", async () => {
		let { trigger, input } = mountComposer();

		await userEvent.click(trigger);
		await userEvent.keyboard("rocket{Enter}");

		expect(input!.value).toBe("🚀");
	});

	test("the arrow keys walk the grid and keep one tab stop", async () => {
		let { trigger, buttons } = mountComposer();
		await userEvent.click(trigger);

		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(buttons()[0]);
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(buttons()[1]);
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(buttons()[9]);
		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(buttons()[8]);
		await userEvent.keyboard("{End}");
		expect(document.activeElement).toBe(buttons().at(-1));

		expect(buttons().filter((button) => button.tabIndex === 0)).toEqual([buttons().at(-1)]);
	});

	test("ArrowUp from the first row returns to the filter", async () => {
		let { trigger, search } = mountComposer();
		await userEvent.click(trigger);

		await userEvent.keyboard("{ArrowDown}{ArrowUp}");

		expect(document.activeElement).toBe(search);
	});

	test("Escape closes the grid", async () => {
		let { trigger, panel } = mountComposer();
		await userEvent.click(trigger);

		await userEvent.keyboard("{Escape}");

		expect(panel.matches(":popover-open")).toBe(false);
	});

	test("in a form, each emoji submits itself under the picker's name", async () => {
		let mounted = render(
			<form method="post" action="/reactions" style="margin-block-start: 24rem">
				<EmojiPicker id="picker" name="emoji" labels={LABELS} />
			</form>,
		);
		onTestFinished(mounted.cleanup);
		let { trigger, panel } = parts(mounted.container);
		let posted: FormDataEntryValue | null = null;
		let form = mounted.container.querySelector("form")!;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			posted = new FormData(form, event.submitter).get("emoji");
		});

		let heart = panel.querySelector<HTMLButtonElement>('[data-emoji="❤️"]')!;
		expect(heart.type).toBe("submit");
		expect(heart.value).toBe("❤️");
		await userEvent.click(trigger);
		await userEvent.click(heart);

		expect(posted).toBe("❤️");
		expect(panel.matches(":popover-open")).toBe(false);
	});

	test("the server's markup opens and submits without script", async () => {
		let html = await renderToString(<EmojiPicker id="picker" name="emoji" labels={LABELS} />);
		let document = new DOMParser().parseFromString(html, "text/html");
		let trigger = document.querySelector('[data-slot="emoji-picker-trigger"]')!;
		let heart = document.querySelector('[data-emoji="❤️"]')!;

		expect(trigger.getAttribute("popovertarget")).toBe("picker");
		expect(document.getElementById("picker")?.getAttribute("popover")).toBe("auto");
		expect(heart.getAttribute("type")).toBe("submit");
		expect(heart.getAttribute("name")).toBe("emoji");
		expect(heart.hasAttribute("tabindex")).toBe(false);
	});

	test("a custom set replaces the default one", async () => {
		let mounted = render(
			<EmojiPicker
				id="picker"
				name="emoji"
				labels={LABELS}
				emoji={[{ char: "🦕", name: "sauropod", group: "Dinosaurs" }]}
			/>,
		);
		onTestFinished(mounted.cleanup);
		let { buttons, panel } = parts(mounted.container);

		expect(buttons().map((button) => button.dataset.emoji)).toEqual(["🦕"]);
		expect(panel.textContent).toContain("Dinosaurs");
	});
});
