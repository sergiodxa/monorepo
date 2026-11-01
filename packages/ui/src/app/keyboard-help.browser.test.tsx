/**
 * Opens the keyboard help sheet in a real browser: `?` shows it, it lists the server's groups
 * and every shortcut the page registered or declared under its group, joins alternatives, sits
 * 640px wide in two columns at 1440 and one column on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { shortcutRegistry } from "./behaviors/shortcuts.js";
import { KeyboardHelp, mergeShortcutGroups } from "./keyboard-help.js";

import "../reset.css";

const LABELS: KeyboardHelp.Labels = {
	title: "Keyboard shortcuts",
	close: "Close",
	or: "or",
	open: "Show keyboard shortcuts",
	general: "General",
	other: "More",
};

let mounted: RenderResult | undefined;
let controller: AbortController;

beforeEach(async () => {
	await page.viewport(1440, 900);
	controller = new AbortController();
});

afterEach(() => {
	controller.abort();
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts an ops page: a nav declaring its keys, a search field, and the sheet. */
function mount(): HTMLDialogElement {
	shortcutRegistry(document).register({
		keys: ["j", "arrowdown"],
		label: "Next monitor",
		group: "Monitors",
		run: () => {},
		signal: controller.signal,
	});
	mounted = render(
		<div>
			<nav data-shortcut-group="Navigation">
				<a href="#monitors" data-shortcut="g m">
					Go to Monitors
				</a>
			</nav>
			<input type="search" aria-label="Search" />
			<button type="button" commandfor="keys" command="show-modal">
				Shortcuts
			</button>
			<KeyboardHelp
				id="keys"
				labels={LABELS}
				groups={[{ title: "Monitors", shortcuts: [{ keys: "c", label: "Create monitor" }] }]}
			/>
		</div>,
	);
	return document.getElementById("keys") as HTMLDialogElement;
}

/** Each group's title with its rows, as a reader sees them. */
function listed(dialog: HTMLDialogElement): [string, string[]][] {
	return [...dialog.querySelectorAll('[data-slot="keyboard-help-group"]')].map((group) => [
		group.querySelector("h3")?.textContent ?? "",
		[...group.querySelectorAll("dt")].map((row) => row.textContent ?? ""),
	]);
}

/** Waits for the dialog's entry motion to settle. */
async function settled(dialog: HTMLDialogElement): Promise<void> {
	await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
}

describe("KeyboardHelp", () => {
	test("opens on ?, listing the server's groups and the page's shortcuts by group", async () => {
		let dialog = mount();
		await userEvent.keyboard("?");

		expect(dialog.open).toBe(true);
		await expect
			.poll(() => listed(dialog))
			.toEqual([
				["Monitors", ["Create monitor", "Next monitor"]],
				["General", ["Show keyboard shortcuts"]],
				["Navigation", ["Go to Monitors"]],
			]);
	});

	test("prints sequences as caps and joins alternatives", async () => {
		let dialog = mount();
		await userEvent.keyboard("?");
		let rows = [...dialog.querySelectorAll("dd")].map((row) => row.textContent);

		expect(rows).toContain("Jor↓");
		expect(rows).toContain("GM");
		expect(dialog.querySelectorAll("kbd").length).toBeGreaterThan(4);
	});

	test("stays shut while ? is typed into a field", async () => {
		let dialog = mount();
		document.querySelector<HTMLInputElement>('input[type="search"]')!.focus();
		await userEvent.keyboard("?");
		expect(dialog.open).toBe(false);
	});

	test("lists a shortcut declared after it mounted once opened from a button", async () => {
		let dialog = mount();
		let late = document.createElement("button");
		late.setAttribute("data-shortcut", "g i");
		late.textContent = "Go to Incidents";
		document.querySelector("nav")!.appendChild(late);

		await userEvent.click(document.querySelector<HTMLButtonElement>('[commandfor="keys"]')!);
		await expect
			.poll(() => listed(dialog).at(-1)?.[1])
			.toEqual(["Go to Monitors", "Go to Incidents"]);
	});

	test("sits 640px wide with its groups in two columns at 1440", async () => {
		let dialog = mount();
		await userEvent.keyboard("?");
		await settled(dialog);
		let [first, second] = [...dialog.querySelectorAll('[data-slot="keyboard-help-group"]')].map(
			(group) => group.getBoundingClientRect(),
		);

		expect(dialog.getBoundingClientRect().width).toBe(640);
		expect(first!.top).toBe(second!.top);
		expect(second!.left).toBeGreaterThan(first!.right);
	});

	test("stacks its groups in one column at 375", async () => {
		await page.viewport(375, 812);
		let dialog = mount();
		await userEvent.keyboard("?");
		await settled(dialog);
		let [first, second] = [...dialog.querySelectorAll('[data-slot="keyboard-help-group"]')].map(
			(group) => group.getBoundingClientRect(),
		);

		expect(second!.top).toBeGreaterThan(first!.bottom);
		expect(dialog.getBoundingClientRect().right).toBeLessThanOrEqual(375);
	});

	test("merges registry rows into the server's groups once each", () => {
		expect(
			mergeShortcutGroups(
				[{ title: "Lists", shortcuts: [{ keys: "j", label: "Next" }] }],
				[
					{ keys: ["j"], label: "Next", group: "Lists" },
					{ keys: ["x"], label: "Select", group: "Lists" },
					{ keys: ["?"], label: "Help" },
				],
				"More",
			),
		).toEqual([
			{
				title: "Lists",
				shortcuts: [
					{ keys: "j", label: "Next" },
					{ keys: ["x"], label: "Select" },
				],
			},
			{ title: "More", shortcuts: [{ keys: ["?"], label: "Help" }] },
		]);
	});
});
