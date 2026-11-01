/**
 * Tests for {@link AppShell} in a real browser: the one sidebar as a column, a rail and a sheet
 * at both sides of 48rem, the collapse toggle and ⌘B writing the cookie, rail tooltips and peek,
 * the inset content card, the skip link and landmarks, and no sideways scroll at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { APP_SHELL_COOKIE, AppShell, readAppShellCookie } from "./app-shell.js";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
	document.cookie = `${APP_SHELL_COOKIE}=; path=/; max-age=0`;
	history.replaceState(null, "", location.pathname + location.search);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	await page.viewport(1280, 800);
});

/** Every string the shell needs. */
const LABELS: AppShell.Labels = {
	nav: "Main",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** A square standing in for an icon, so rows have a 16px glyph to measure. */
function Glyph() {
	return () => <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" />;
}

/** Mounts a small ops app's shell at the current viewport. */
function mountShell(props: Partial<AppShell.Props> = {}) {
	mounted = render(
		<AppShell
			labels={LABELS}
			workspace={
				<AppShell.Identity
					avatar={<Glyph />}
					name="Acme Ops"
					detail="Pro plan"
					aria-label="Acme Ops"
				/>
			}
			nav={
				<>
					<AppShell.Group>
						<AppShell.Item href="#overview" icon={<Glyph />} label="Overview" />
						<AppShell.Item
							href="#monitors"
							icon={<Glyph />}
							label="Monitors"
							count={2}
							countTone="danger"
							countLabel="2 down"
							active
						/>
						<AppShell.Item href="#incidents" icon={<Glyph />} label="Incidents" current />
					</AppShell.Group>
					<AppShell.Group title="Settings">
						<AppShell.Item href="#team" icon={<Glyph />} label="Team" />
					</AppShell.Group>
				</>
			}
			footer={<AppShell.Identity avatar={<Glyph />} name="Ada Lovelace" detail="ada@acme.dev" />}
			topbar={<span>Incidents</span>}
			{...props}
		>
			{props.children ?? (
				<>
					<h1>Incidents</h1>
					<p style="block-size: 1600px">Body</p>
				</>
			)}
		</AppShell>,
	);
}

/** The shell's one sidebar element. */
function sidebar(): HTMLElement {
	return document.querySelector<HTMLElement>('[data-slot="app-shell-sidebar"]')!;
}

/** The collapse checkbox inside the toggle. */
function toggle(): HTMLInputElement {
	return document.querySelector<HTMLInputElement>("[data-app-shell-collapse]")!;
}

/** The menu button that opens the sheet. */
function menuButton(): HTMLButtonElement {
	return document.querySelector<HTMLButtonElement>('[data-slot="app-shell-menu"] button')!;
}

/** A nav link by its label. */
function link(label: string): HTMLAnchorElement {
	return [...sidebar().querySelectorAll<HTMLAnchorElement>("a")].find((anchor) =>
		anchor.textContent?.includes(label),
	)!;
}

/** Holds the rest of the test until the browser has painted twice, after a style change. */
async function frames() {
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** Turns every transition off, so a width reads its final value at once. */
async function reduceMotion() {
	await cdp().send("Emulation.setEmulatedMedia", {
		features: [{ name: "prefers-reduced-motion", value: "reduce" }],
	});
}

describe("AppShell", () => {
	test("reads the collapse cookie from a Cookie header", () => {
		expect(readAppShellCookie(`theme=dark; ${APP_SHELL_COOKIE}=true`)).toBe(true);
		expect(readAppShellCookie(`${APP_SHELL_COOKIE}=false`)).toBe(false);
		expect(readAppShellCookie(null)).toBe(false);
		expect(readAppShellCookie("other=true")).toBe(false);
	});

	test("at 768px a persisted collapse draws the icon rail with no menu button", async () => {
		await reduceMotion();
		await page.viewport(768, 800);
		mountShell({ collapsed: true });
		await userEvent.hover(document.querySelector("main")!);

		expect(toggle().checked).toBe(true);
		expect(sidebar().checkVisibility()).toBe(true);
		expect(Math.round(sidebar().getBoundingClientRect().width)).toBe(52);
		expect(menuButton().checkVisibility()).toBe(false);
		let label = link("Monitors").querySelector<HTMLElement>("[data-app-shell-label]")!;
		expect(getComputedStyle(label).opacity).toBe("0");
		let dot = link("Monitors").querySelector<HTMLElement>('[data-slot="app-shell-count"]')!;
		expect(Math.round(dot.getBoundingClientRect().width)).toBe(8);
	});

	test("at 767px the same collapse leaves a sheet behind the menu button", async () => {
		await reduceMotion();
		await page.viewport(767, 800);
		mountShell({ collapsed: true });

		expect(sidebar().checkVisibility()).toBe(false);
		expect(menuButton().checkVisibility()).toBe(true);
		expect(toggle().closest("label")!.checkVisibility()).toBe(false);
		expect(document.querySelectorAll('[data-slot="app-shell-nav"]')).toHaveLength(1);

		menuButton().click();
		expect(sidebar().matches(":popover-open")).toBe(true);
		expect(Math.round(sidebar().getBoundingClientRect().width)).toBe(288);
		let label = link("Monitors").querySelector<HTMLElement>("[data-app-shell-label]")!;
		expect(getComputedStyle(label).opacity).toBe("1");
		let close = sidebar().querySelector<HTMLButtonElement>(
			'button[aria-label="Close navigation"]',
		)!;
		expect(close.checkVisibility()).toBe(true);

		link("Incidents").click();
		expect(sidebar().matches(":popover-open")).toBe(false);
	});

	test("the sheet's close button closes it", async () => {
		await page.viewport(375, 800);
		mountShell();
		menuButton().click();
		sidebar().querySelector<HTMLButtonElement>('button[aria-label="Close navigation"]')!.click();
		expect(sidebar().matches(":popover-open")).toBe(false);
	});

	test("⌘B and Ctrl+B flip the rail at once and write the cookie", async () => {
		await reduceMotion();
		await page.viewport(1280, 800);
		mountShell();
		expect(Math.round(sidebar().getBoundingClientRect().width)).toBe(256);

		await userEvent.keyboard("{Meta>}b{/Meta}");
		expect(toggle().checked).toBe(true);
		expect(readAppShellCookie(document.cookie)).toBe(true);
		await frames();
		expect(Math.round(sidebar().getBoundingClientRect().width)).toBe(52);

		await userEvent.keyboard("{Control>}b{/Control}");
		expect(toggle().checked).toBe(false);
		expect(document.cookie).toContain(`${APP_SHELL_COOKIE}=false`);
	});

	test("clicking the toggle writes the cookie, and ⌘B in a text area stays bold", async () => {
		mountShell({ children: <textarea aria-label="Notes" /> });
		toggle().click();
		expect(readAppShellCookie(document.cookie)).toBe(true);

		document.querySelector("textarea")!.focus();
		await userEvent.keyboard("{Meta>}b{/Meta}");
		expect(toggle().checked).toBe(true);
	});

	test("⌘B opens the sheet below 48rem", async () => {
		await page.viewport(375, 800);
		mountShell();
		await userEvent.keyboard("{Meta>}b{/Meta}");
		expect(sidebar().matches(":popover-open")).toBe(true);
		expect(toggle().checked).toBe(false);
	});

	test("rail rows keep their names and show a tooltip only in the rail", async () => {
		await reduceMotion();
		mountShell({ collapsed: true, peek: false });

		let monitors = page.getByRole("link", { name: "Monitors 2 down" });
		await expect.element(monitors).toBeInTheDocument();
		expect(link("Incidents").getAttribute("aria-current")).toBe("page");
		expect(link("Monitors").hasAttribute("aria-current")).toBe(false);
		expect(link("Monitors").hasAttribute("data-current")).toBe(true);

		let tooltip = link("Incidents").querySelector<HTMLElement>('[data-slot="app-shell-tooltip"]')!;
		expect(tooltip.checkVisibility()).toBe(false);
		await userEvent.hover(link("Incidents"));
		expect(tooltip.checkVisibility()).toBe(true);
		let rail = sidebar().getBoundingClientRect();
		let tip = tooltip.getBoundingClientRect();
		expect(tip.left).toBeGreaterThanOrEqual(rail.right);
		let row = link("Incidents").getBoundingClientRect();
		expect(Math.abs(tip.top + tip.height / 2 - (row.top + row.height / 2))).toBeLessThan(2);
		expect(Math.round(sidebar().getBoundingClientRect().width)).toBe(52);

		toggle().click();
		await frames();
		await userEvent.hover(link("Incidents"));
		expect(tooltip.checkVisibility()).toBe(false);
	});

	test("the rail peeks over the content without moving it", async () => {
		await reduceMotion();
		mountShell({ collapsed: true });
		let card = document.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;
		let before = card.getBoundingClientRect().left;

		await userEvent.hover(link("Overview"));
		await frames();
		expect(Math.round(sidebar().getBoundingClientRect().width)).toBe(256);
		expect(card.getBoundingClientRect().left).toBe(before);
		let label = link("Monitors").querySelector<HTMLElement>("[data-app-shell-label]")!;
		expect(getComputedStyle(label).opacity).toBe("1");
	});

	test("insets the content card on the tinted frame", async () => {
		await page.viewport(1280, 800);
		mountShell();
		let card = document.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;
		let box = card.getBoundingClientRect();
		expect(Math.round(box.top)).toBe(8);
		expect(Math.round(1280 - box.right)).toBe(8);
		expect(Math.round(box.left)).toBe(256);
		expect(Math.round(800 - box.bottom)).toBe(8);
		expect(getComputedStyle(card).borderTopLeftRadius).toBe("12px");
		let frame = getComputedStyle(document.querySelector('[data-slot="app-shell"]')!);
		expect(frame.backgroundColor).not.toBe(getComputedStyle(card).backgroundColor);
		expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(800);
	});

	test("a banner pushes the frame down", async () => {
		mountShell({ banner: <div style="block-size: 36px">Sandbox</div> });
		let card = document.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;
		expect(Math.round(card.getBoundingClientRect().top)).toBe(44);
		expect(Math.round(sidebar().getBoundingClientRect().top)).toBe(36);
	});

	test("has a skip link, a named nav and a main landmark", async () => {
		mountShell();
		let skip = document.querySelector<HTMLAnchorElement>('[data-slot="app-shell-skip"]')!;
		let main = document.querySelector("main")!;
		expect(skip.getAttribute("href")).toBe(`#${main.id}`);
		expect(skip.getBoundingClientRect().width).toBeLessThanOrEqual(1);
		await userEvent.tab();
		expect(document.activeElement).toBe(skip);
		expect(skip.getBoundingClientRect().width).toBeGreaterThan(40);
		await expect.element(page.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
		await expect.element(page.getByRole("main")).toBeInTheDocument();
		await expect.element(page.getByRole("group", { name: "Settings" })).toBeInTheDocument();
	});

	test("Esc follows a swapped panel's back row unless something else owns Esc", async () => {
		mountShell({
			nav: (
				<>
					<AppShell.Back href="#overview" label="Settings" />
					<AppShell.Group>
						<AppShell.Item href="#general" label="General" current />
					</AppShell.Group>
				</>
			),
			children: <input aria-label="Name" />,
		});

		document.querySelector<HTMLInputElement>("input:not([type])")!.focus();
		await userEvent.keyboard("{Escape}");
		expect(location.hash).toBe("");

		(document.activeElement as HTMLElement).blur();
		await userEvent.keyboard("{Escape}");
		expect(location.hash).toBe("#overview");
	});

	test("nothing scrolls sideways at 320px, open or closed", async () => {
		await page.viewport(320, 640);
		mountShell({
			topbar: <span>A very long breadcrumb trail that keeps going past the edge of a phone</span>,
		});
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
		menuButton().click();
		expect(sidebar().getBoundingClientRect().right).toBeLessThanOrEqual(320);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});
});
