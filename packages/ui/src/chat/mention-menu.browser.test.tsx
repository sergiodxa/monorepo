/**
 * Drives the mention menu in a real browser inside a composer that sends on Enter: typing a
 * trigger opens the list and gives the field combobox state, the keys move and pick without
 * sending, Escape and a mid-word trigger leave the message alone, and a click picks too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { MentionPerson } from "./mention-menu.js";

import { ComposerSubmit } from "./composer-submit.js";
import { Composer } from "./composer.js";
import { MentionMenu } from "./mention-menu.js";

import "../reset.css";
import "../theme.css";

const PEOPLE: MentionPerson[] = [
	{ id: "u1", handle: "ana", name: "Ana Lima", initials: "AL", color: "#7c3aed", detail: "Design" },
	{ id: "u2", handle: "marco", name: "Marco Díaz", initials: "MD" },
	{ id: "u3", handle: "mariela", name: "Mariela Soto", initials: "MS" },
];

/** Mounts a sending composer with the menu, focused and ready to type into. */
function mount() {
	let mounted = render(
		<Composer>
			<Composer.Input aria-label="Message" />
			<MentionMenu people={PEOPLE} labels={{ list: "People", empty: "Nobody matches" }} />
			<Composer.Toolbar>
				<ComposerSubmit labels={{ send: "Send", stop: "Stop" }} />
			</Composer.Toolbar>
		</Composer>,
	);
	onTestFinished(mounted.cleanup);
	let form = mounted.container.querySelector("form")!;
	let input = form.querySelector("textarea")!;
	let menu = form.querySelector<HTMLElement>('[data-slot="mention-menu"]')!;
	let sent = vi.fn((event: Event) => event.preventDefault());
	form.addEventListener("submit", sent);
	input.focus();
	let options = () => Array.from(menu.querySelectorAll<HTMLElement>('[role="option"]'));
	let isOpen = () => menu.matches(":popover-open");
	return { input, menu, sent, options, isOpen };
}

describe("MentionMenu", () => {
	test("a trigger opens the list and makes the field its combobox", async () => {
		let { input, options, isOpen } = mount();

		await userEvent.keyboard("hi @");

		await vi.waitFor(() => expect(isOpen()).toBe(true));
		expect(options().map((option) => option.dataset.mentionHandle)).toEqual([
			"ana",
			"marco",
			"mariela",
		]);
		expect(input.getAttribute("aria-expanded")).toBe("true");
		expect(input.getAttribute("aria-autocomplete")).toBe("list");
		expect(input.getAttribute("aria-controls")).toBe(options()[0]!.parentElement!.id);
		expect(input.getAttribute("aria-activedescendant")).toBe(options()[0]!.id);
	});

	test("typing narrows the list, ArrowDown moves, Enter writes the handle and sends nothing", async () => {
		let { input, options, isOpen, sent } = mount();

		await userEvent.keyboard("hey @mar");
		await vi.waitFor(() => expect(options()).toHaveLength(2));
		await userEvent.keyboard("{ArrowDown}");
		await vi.waitFor(() => expect(options()[1]!.getAttribute("aria-selected")).toBe("true"));
		expect(input.getAttribute("aria-activedescendant")).toBe(options()[1]!.id);
		await userEvent.keyboard("{Enter}");

		expect(input.value).toBe("hey @mariela ");
		expect(sent).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(isOpen()).toBe(false));
		expect(input.getAttribute("aria-expanded")).toBe("false");
		expect(input.hasAttribute("aria-activedescendant")).toBe(false);
	});

	test("ArrowUp from the first person wraps to the last, and Tab picks", async () => {
		let { input, options } = mount();

		await userEvent.keyboard("@");
		await vi.waitFor(() => expect(options()).toHaveLength(3));
		await userEvent.keyboard("{ArrowUp}");
		await vi.waitFor(() => expect(options()[2]!.getAttribute("aria-selected")).toBe("true"));
		await userEvent.keyboard("{Tab}");

		expect(input.value).toBe("@mariela ");
		expect(document.activeElement).toBe(input);
	});

	test("Escape closes the list, and the next Enter sends", async () => {
		let { isOpen, sent } = mount();

		await userEvent.keyboard("ping @an");
		await vi.waitFor(() => expect(isOpen()).toBe(true));
		await userEvent.keyboard("{Escape}");
		await vi.waitFor(() => expect(isOpen()).toBe(false));
		await userEvent.keyboard("a");
		expect(isOpen()).toBe(false);
		await userEvent.keyboard("{Enter}");

		expect(sent).toHaveBeenCalledTimes(1);
	});

	test("a trigger in the middle of a word opens nothing", async () => {
		let { isOpen } = mount();

		await userEvent.keyboard("me@ana");
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(isOpen()).toBe(false);
	});

	test("a query nobody matches shows the empty line, and Enter then sends", async () => {
		let { menu, sent } = mount();

		await userEvent.keyboard("@zz");
		await vi.waitFor(() => expect(menu.textContent).toContain("Nobody matches"));
		await userEvent.keyboard("{Enter}");

		expect(sent).toHaveBeenCalledTimes(1);
	});

	test("clicking a person writes the handle and keeps focus in the field", async () => {
		let { input, options, isOpen } = mount();

		await userEvent.keyboard("cc @an");
		await vi.waitFor(() => expect(isOpen() && options().length === 1).toBe(true));
		await userEvent.click(options()[0]!);

		expect(input.value).toBe("cc @ana ");
		expect(document.activeElement).toBe(input);
	});

	test("on a short screen the list stays inside the viewport and every person is reachable", async () => {
		await page.viewport(414, 180);
		onTestFinished(() => page.viewport(414, 896));
		let { input, menu, options, isOpen } = mount();

		await userEvent.keyboard("@");
		await vi.waitFor(() => expect(isOpen()).toBe(true));
		let box = menu.getBoundingClientRect();

		expect(box.top).toBeGreaterThanOrEqual(0);
		expect(box.bottom).toBeLessThanOrEqual(document.documentElement.clientHeight);
		await userEvent.click(options()[2]!);
		expect(input.value).toBe("@mariela ");
	});

	test("each person shows a tile, the name and the handle with its detail", async () => {
		let { options } = mount();

		await userEvent.keyboard("@an");
		await vi.waitFor(() => expect(options()).toHaveLength(1));
		let option = options()[0]!;
		let tile = option.querySelector<HTMLElement>('[aria-hidden="true"]')!;

		expect(tile.textContent).toBe("AL");
		expect(getComputedStyle(tile).backgroundColor).toBe("rgb(124, 58, 237)");
		expect(option.textContent).toContain("Ana Lima");
		expect(option.textContent).toContain("@ana · Design");
	});
});
