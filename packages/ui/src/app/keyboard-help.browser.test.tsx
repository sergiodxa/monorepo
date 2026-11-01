/**
 * Opens the keyboard help sheet in a real browser: `?` shows it, it lists the server's groups
 * and every shortcut the page registered or declared under its group, joins alternatives, sits
 * 640px wide in two columns at 1440 and one column on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { AppRuntime } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { run } from "remix/component";
import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { HeadingScope } from "../components/heading-scope.js";

import { shortcutRegistry } from "./behaviors/shortcuts.js";
import { KeyboardHelp } from "./keyboard-help.js";
import { mergeShortcutGroups } from "./utils/shortcut-groups.js";

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
let app: AppRuntime | undefined;
let controller: AbortController;

beforeEach(async () => {
	await page.viewport(1440, 900);
	controller = new AbortController();
});

afterEach(() => {
	controller.abort();
	mounted?.cleanup();
	mounted = undefined;
	app?.dispose();
	app = undefined;
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
		group.querySelector("h1, h2, h3, h4, h5, h6")?.textContent ?? "",
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

	test("titles itself an h2 with h3 groups by default, under any heading scope", () => {
		mounted = render(
			<HeadingScope level={4}>
				<KeyboardHelp
					id="keys"
					labels={LABELS}
					groups={[{ title: "Lists", shortcuts: [{ keys: "j", label: "Next" }] }]}
				/>
			</HeadingScope>,
		);
		let dialog = document.getElementById("keys")!;

		expect(dialog.querySelector('[data-slot="title"]')?.tagName).toBe("H2");
		expect(dialog.querySelector('[data-slot="keyboard-help-group"] > :first-child')?.tagName).toBe(
			"H3",
		);
	});

	test("titles itself at the level it is given, its groups one below", () => {
		mounted = render(
			<KeyboardHelp
				id="keys"
				level={4}
				labels={LABELS}
				groups={[{ title: "Lists", shortcuts: [{ keys: "j", label: "Next" }] }]}
			/>,
		);
		let dialog = document.getElementById("keys")!;

		expect(dialog.querySelector('[data-slot="title"]')?.tagName).toBe("H4");
		expect(dialog.querySelector('[data-slot="keyboard-help-group"] > :first-child')?.tagName).toBe(
			"H5",
		);
	});

	test("hydrates inside a heading scope without touching the server DOM beside it", async () => {
		document.body.innerHTML = await renderToString(
			<div>
				<nav data-shortcut-group="Navigation">
					<a href="#monitors" data-shortcut="g m">
						Go to Monitors
					</a>
				</nav>
				<HeadingScope level={2}>
					<KeyboardHelp
						id="keys"
						level={3}
						labels={LABELS}
						groups={[{ title: "Lists", shortcuts: [{ keys: "j", label: "Next" }] }]}
					/>
				</HeadingScope>
				<p data-slot="palette-text">Search conversations</p>
			</div>,
		);
		let nav = document.querySelector("nav")!;
		let text = document.querySelector('[data-slot="palette-text"]')!;
		let title = document.querySelector('[data-slot="title"]')!;
		expect(title.tagName).toBe("H3");

		let errors = vi.spyOn(console, "error").mockImplementation(() => {});
		app = run({ loadModule: () => KeyboardHelp });
		await app.ready();
		let mismatches = errors.mock.calls.filter((call) => String(call[0]).includes("mismatch"));
		errors.mockRestore();
		expect(mismatches).toEqual([]);
		let dialog = document.getElementById("keys") as HTMLDialogElement;
		await userEvent.keyboard("?");
		await expect.poll(() => listed(dialog).at(-1)?.[0]).toBe("Navigation");

		expect(nav.isConnected).toBe(true);
		expect(nav.textContent).toBe("Go to Monitors");
		expect(text.isConnected).toBe(true);
		expect(text.textContent).toBe("Search conversations");
		expect(document.querySelector('[data-slot="title"]')).toBe(title);
		expect(title.tagName).toBe("H3");
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
