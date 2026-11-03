/**
 * Drives the icon gallery's islands in a real browser: typing narrows the grid in place, a
 * slider restyles every tile through the grid's custom properties, and a plain click on a
 * tile opens the one dialog with that icon's frame instead of leaving the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { IconEntry } from "~/app/services/icons";

import { DEFAULT_ICON_STYLE } from "~/app/services/icon-style";
import { findIcon } from "~/app/services/icons";
import IconControls from "~/resources/components/icon-controls";
import IconDialog from "~/resources/components/icon-dialog";
import IconGrid, { ICON_FRAME_ATTRIBUTE } from "~/resources/components/icon-grid";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** The icons the grid holds: enough that a query hides some and keeps others. */
const ICONS = ["heart", "heart-crack", "zap"].map((name) => findIcon(name)) as IconEntry[];

/** Every frame source the dialog asked for, in order. */
let requested: string[] = [];

/** Unmounts what a test mounted, so its dialog stops listening for clicks on the next test's grid. */
let cleanups: Array<() => void> = [];

/** Mounts the controls, the grid and the dialog the way the gallery page lays them out. */
function mount(): HTMLElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	let { cleanup } = render(
		<div>
			<IconControls
				action="/api/icons"
				gridId="icon-grid"
				query=""
				{...DEFAULT_ICON_STYLE}
				matching={ICONS.length}
				total={ICONS.length}
				version="1.61.0"
			/>
			<IconGrid
				id="icon-grid"
				icons={ICONS}
				sprite="/api/icons/sprite.svg?v=1.61.0"
				query=""
				style={DEFAULT_ICON_STYLE}
			/>
			<IconDialog id="icon-detail" gridId="icon-grid" frameAttribute={ICON_FRAME_ATTRIBUTE} />
		</div>,
		{
			container: host,
			frameInit: {
				resolveFrame(src) {
					requested.push(src);
					return `<p data-testid="detail">Detail for ${src}</p>`;
				},
			},
		},
	);
	cleanups.push(cleanup);
	return host;
}

/** The grid item holding `name`'s tile. */
function tile(host: HTMLElement, name: string): HTMLElement {
	return host.querySelector<HTMLElement>(`a[data-icon-name="${name}"]`)!.parentElement!;
}

/** Moves a slider to `value` the way dragging its thumb does. */
function slide(host: HTMLElement, name: string, value: string): void {
	let input = host.querySelector<HTMLInputElement>(`input[type=range][name="${name}"]`)!;
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(async () => {
	await page.viewport(1280, 900);
	history.replaceState(null, "", "/api/icons");
	requested = [];
});

afterEach(() => {
	for (let cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
});

describe("IconControls", () => {
	test("narrows the grid as the reader types, and the address follows", async () => {
		let host = mount();
		await userEvent.type(page.getByRole("searchbox"), "crack");

		await expect.poll(() => tile(host, "heart").hidden).toBe(true);
		expect(tile(host, "heart-crack").hidden).toBe(false);
		expect(tile(host, "zap").hidden).toBe(true);
		expect(host.textContent).toContain("1 of 3 icons match “crack”.");
		expect(location.search).toBe("?q=crack");
	});

	test("restyles every tile through the grid's custom properties", async () => {
		let host = mount();
		slide(host, "size", "40");

		let svg = tile(host, "zap").querySelector("svg")!;
		await expect.poll(() => svg.getBoundingClientRect().width).toBe(40);
		expect(location.search).toBe("?size=40");
	});

	test("colours every tile from a hex typed in the colour field, and clears it when emptied", async () => {
		let host = mount();
		let field = page.getByRole("textbox", { name: "Color" });
		let grid = host.querySelector<HTMLElement>("#icon-grid")!;

		await userEvent.fill(field, "#ff3366");
		await expect.poll(() => grid.style.getPropertyValue("--icon-color")).toBe("#ff3366");
		expect(location.search).toBe("?color=%23ff3366");

		await userEvent.clear(field);
		await expect.poll(() => grid.style.getPropertyValue("--icon-color")).toBe("");
	});

	test("follows the hue wheel's keyboard into the area, the field and the grid", async () => {
		let host = mount();
		let hue = host.querySelector<HTMLInputElement>(
			'[data-slot="color-wheel"] input[type="range"]',
		)!;
		let area = host.querySelector<HTMLElement>('[style*="--ui-color-area-hue"]')!;
		await userEvent.click(page.getByRole("button", { name: "Open the color picker" }));
		hue.focus();

		await userEvent.keyboard("{ArrowRight}{ArrowRight}");

		await expect.poll(() => area.style.getPropertyValue("--ui-color-area-hue")).toBe("212");
		let field = host.querySelector<HTMLInputElement>("#icon-color")!;
		expect(field.value).toMatch(/^#[0-9a-f]{6}$/);
		expect(
			host.querySelector<HTMLElement>("#icon-grid")!.style.getPropertyValue("--icon-color"),
		).toBe(field.value);
	});

	test("moves the wheel to a hex typed in the field", async () => {
		let host = mount();
		await userEvent.fill(page.getByRole("textbox", { name: "Color" }), "#00ff00");

		let hue = host.querySelector<HTMLInputElement>(
			'[data-slot="color-wheel"] input[type="range"]',
		)!;
		await expect.poll(() => hue.valueAsNumber).toBe(120);
	});

	test("says so when nothing matches", async () => {
		let host = mount();
		await userEvent.type(page.getByRole("searchbox"), "zzzz");

		await expect.poll(() => host.textContent).toContain("No icon matches “zzzz”.");
	});
});

describe("IconDialog", () => {
	test("opens on a plain click with the icon's frame, staying on the gallery", async () => {
		let host = mount();
		slide(host, "size", "32");
		await userEvent.click(page.getByTitle("heart", { exact: true }));

		let dialog = host.querySelector<HTMLDialogElement>("#icon-detail")!;
		await expect.poll(() => dialog.open).toBe(true);
		await expect.poll(() => requested).toEqual(["/frames/icons/heart?size=32"]);
		expect(dialog.textContent).toContain("heart");
		expect(location.pathname).toBe("/api/icons");
	});

	test("closes on a press outside its panel", async () => {
		let host = mount();
		await userEvent.click(page.getByTitle("zap", { exact: true }));
		let dialog = host.querySelector<HTMLDialogElement>("#icon-detail")!;
		await expect.poll(() => dialog.open).toBe(true);

		await userEvent.click(page.getByRole("dialog"), { position: { x: -10, y: -10 }, force: true });

		await expect.poll(() => dialog.open).toBe(false);
	});

	test("leaves a click with a modifier to the browser", async () => {
		let host = mount();
		let prevented: boolean | null = null;
		document.addEventListener(
			"click",
			(event) => {
				prevented = event.defaultPrevented;
				event.preventDefault();
			},
			{ once: true },
		);

		let link = host.querySelector<HTMLAnchorElement>('a[data-icon-name="zap"]')!;
		link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));

		expect(prevented).toBe(false);
		expect(host.querySelector<HTMLDialogElement>("#icon-detail")!.open).toBe(false);
	});
});
