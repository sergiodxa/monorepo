/**
 * Tests for {@link AppShell} in a real browser: the one sidebar as a column, a rail and a sheet
 * at both sides of 48rem and of a 64rem `sheetBelow`, the collapse toggle and ⌘B writing the cookie, rail tooltips and peek,
 * a scrolling rail keeping its current fill on the icon, the inset content card, the skip link and
 * landmarks, and no sideways scroll at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { bs, is } from "@sdxc/u/size";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { Avatar } from "../components/avatar.js";
import { Menu } from "../components/menu.js";

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

/** A 64px picture, larger than any avatar slot, so a crop would show in its rendered box. */
const PICTURE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="teal"/></svg>')}`;

/** Every kind of avatar an identity is handed: root Avatars at each size, one resized by a mix, a raw image. */
const AVATARS = [
	<Avatar size="sm">
		<Avatar.Image src={PICTURE} alt="" />
		<Avatar.Fallback>AL</Avatar.Fallback>
	</Avatar>,
	<Avatar>
		<Avatar.Image src={PICTURE} alt="" />
		<Avatar.Fallback>AL</Avatar.Fallback>
	</Avatar>,
	<Avatar mix={[is("1.5rem"), bs("1.5rem")]}>
		<Avatar.Image src={PICTURE} alt="" />
		<Avatar.Fallback>AL</Avatar.Fallback>
	</Avatar>,
	<img src={PICTURE} alt="" width="32" height="32" />,
];

/**
 * Asserts the identity's avatar slot holds its picture whole: the slot is 24px square, every
 * box inside it fits within it, and the picture is as wide as it is tall.
 */
function expectWholeAvatar(row: HTMLElement) {
	let slot = row.querySelector<HTMLElement>(":scope > span")!;
	let box = slot.getBoundingClientRect();
	expect([box.width, box.height]).toEqual([24, 24]);
	for (let inner of slot.querySelectorAll<HTMLElement>("*")) {
		let rect = inner.getBoundingClientRect();
		if (rect.width === 0) continue;
		expect(rect.left).toBeGreaterThanOrEqual(box.left - 0.5);
		expect(rect.top).toBeGreaterThanOrEqual(box.top - 0.5);
		expect(rect.right).toBeLessThanOrEqual(box.right + 0.5);
		expect(rect.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
	}
	let picture = slot.querySelector<HTMLImageElement>("img")!;
	let rect = picture.getBoundingClientRect();
	expect(rect.width).toBe(rect.height);
	expect(rect.width).toBeGreaterThan(20);
}

/** Mounts a small ops app's shell at the current viewport. */
function mountShell(props: Partial<AppShell.Props> = {}) {
	mounted = render(
		<AppShell
			labels={LABELS}
			workspace={
				<>
					<AppShell.Identity
						avatar={<Glyph />}
						name="Acme Ops"
						detail="Pro plan"
						commandfor="workspaces"
						command="toggle-popover"
					/>
					<Menu id="workspaces" aria-label="Workspace">
						<Menu.Item>Switch workspace</Menu.Item>
						<Menu.Item>Workspace settings</Menu.Item>
					</Menu>
				</>
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

/** The identity row in the sidebar's header or foot. */
function identity(where: "header" | "footer"): HTMLElement {
	return sidebar().querySelector<HTMLElement>(
		`[data-slot="app-shell-sidebar-${where}"] [data-slot="app-shell-identity"]`,
	)!;
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
	test("edges the content card with one line, not a border plus an inset ring", async () => {
		await page.viewport(1280, 800);
		document.documentElement.style.setProperty(
			"--ui-shadow-control",
			"0 1px 3px rgb(0 0 0 / 0.04), inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 0 0 1px rgb(0 0 0 / 0.06)",
		);
		document.documentElement.style.setProperty("--ui-neutral-border", "rgb(228, 228, 231)");
		mountShell();
		let card = document.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;
		let style = getComputedStyle(card);
		let rings = style.boxShadow
			.split(/,(?![^(]*\))/)
			.filter((layer) => /inset/.test(layer) && /0px 0px 0px 1px/.test(layer));

		expect(style.borderTopWidth).toBe("1px");
		expect(rings).toEqual([]);
		document.documentElement.style.removeProperty("--ui-shadow-control");
		document.documentElement.style.removeProperty("--ui-neutral-border");
	});

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

	test("writes the collapse cookie under the path it names, so pages outside it never see it", async () => {
		mountShell({ cookiePath: "/another-app" });
		await userEvent.keyboard("{Meta>}b{/Meta}");
		expect(toggle().checked).toBe(true);
		expect(readAppShellCookie(document.cookie)).toBe(false);

		mounted?.cleanup();
		mountShell({ cookiePath: location.pathname });
		await userEvent.keyboard("{Meta>}b{/Meta}");
		expect(readAppShellCookie(document.cookie)).toBe(true);
		document.cookie = `${APP_SHELL_COOKIE}=; path=${location.pathname}; max-age=0`;
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

	test("keeps the phone drawer full height at the left edge for its whole exit", async () => {
		await page.viewport(375, 812);
		mountShell();
		menuButton().click();
		await new Promise((resolve) => setTimeout(resolve, 400));
		sidebar().hidePopover();
		let samples: { top: number; height: number; left: number; right: number }[] = [];
		for (let index = 0; index < 20; index++) {
			await new Promise((resolve) => requestAnimationFrame(resolve));
			if (!sidebar().checkVisibility()) break;
			let { top, height, left, right } = sidebar().getBoundingClientRect();
			samples.push({ top, height, left, right });
		}

		expect(samples.length).toBeGreaterThan(0);
		for (let sample of samples) {
			expect(sample.top).toBe(0);
			expect(Math.round(sample.height)).toBe(812);
			expect(sample.left === 0 || sample.right <= 0 || sample.left < 0).toBe(true);
		}
	});

	test("closes the sheet in one slide at its full width, never shrinking to its content first", async () => {
		await page.viewport(900, 800);
		mountShell({ sheetBelow: "64rem", collapsed: true });
		menuButton().click();
		await new Promise((resolve) => setTimeout(resolve, 400));
		let open = Math.round(sidebar().getBoundingClientRect().width);
		sidebar().hidePopover();
		let widths = new Set<number>();
		for (let index = 0; index < 8; index++) {
			await new Promise((resolve) => setTimeout(resolve, 25));
			let width = Math.round(sidebar().getBoundingClientRect().width);
			if (width > 0) widths.add(width);
		}

		expect(open).toBe(288);
		expect([...widths]).toEqual([288]);
	});

	test("with sheetBelow 64rem, 1023px is a sheet and 1024px docks the sidebar", async () => {
		await reduceMotion();
		await page.viewport(1023, 800);
		mountShell({ sheetBelow: "64rem", collapsed: true });

		expect(sidebar().checkVisibility()).toBe(false);
		expect(menuButton().checkVisibility()).toBe(true);
		expect(toggle().closest("label")!.checkVisibility()).toBe(false);

		menuButton().click();
		expect(sidebar().matches(":popover-open")).toBe(true);
		expect(Math.round(sidebar().getBoundingClientRect().width)).toBe(288);
		let label = link("Monitors").querySelector<HTMLElement>("[data-app-shell-label]")!;
		expect(getComputedStyle(label).opacity).toBe("1");
		let count = link("Monitors").querySelector<HTMLElement>('[data-slot="app-shell-count"]')!;
		expect(Math.round(count.getBoundingClientRect().width)).toBeGreaterThan(8);

		await page.viewport(1024, 800);
		await frames();
		expect(sidebar().matches(":popover-open")).toBe(false);
		expect(sidebar().checkVisibility()).toBe(true);
		expect(Math.round(sidebar().getBoundingClientRect().width)).toBe(52);
		expect(menuButton().checkVisibility()).toBe(false);
		expect(toggle().closest("label")!.checkVisibility()).toBe(true);
	});

	test("with sheetBelow 64rem, ⌘B opens the sheet at 1023px and flips the rail at 1024px", async () => {
		await page.viewport(1023, 800);
		mountShell({ sheetBelow: "64rem" });
		await userEvent.keyboard("{Meta>}b{/Meta}");
		expect(sidebar().matches(":popover-open")).toBe(true);
		expect(toggle().checked).toBe(false);
		sidebar().hidePopover();

		await page.viewport(1024, 800);
		await frames();
		await userEvent.keyboard("{Meta>}b{/Meta}");
		expect(sidebar().matches(":popover-open")).toBe(false);
		expect(toggle().checked).toBe(true);
	});

	test("the default sheetBelow 48rem docks at 768px and is a sheet at 767px", async () => {
		await reduceMotion();
		await page.viewport(768, 800);
		mountShell({ sheetBelow: "48rem" });
		expect(sidebar().checkVisibility()).toBe(true);
		expect(menuButton().checkVisibility()).toBe(false);

		await page.viewport(767, 800);
		await frames();
		expect(sidebar().checkVisibility()).toBe(false);
		expect(menuButton().checkVisibility()).toBe(true);
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

	test("a scrolling rail keeps the current fill centred on its icon", async () => {
		await reduceMotion();
		await page.viewport(768, 360);
		let items = Array.from({ length: 16 }, (_, index) => (
			<AppShell.Item
				href={`#row-${index}`}
				icon={<Glyph />}
				label={`Row ${index}`}
				current={index === 0}
			/>
		));
		mountShell({
			collapsed: true,
			peek: false,
			nav: <AppShell.Group>{items}</AppShell.Group>,
		});
		await userEvent.hover(document.querySelector("main")!);

		let nav = sidebar().querySelector<HTMLElement>('[data-slot="app-shell-nav"]')!;
		expect(nav.scrollHeight).toBeGreaterThan(nav.clientHeight);
		expect(getComputedStyle(nav).scrollbarWidth).toBe("none");

		let current = link("Row 0");
		let icon = current.querySelector<HTMLElement>('[data-slot="app-shell-icon"]')!;
		let row = current.getBoundingClientRect();
		let glyph = icon.getBoundingClientRect();
		let rail = sidebar().getBoundingClientRect();
		expect(Math.abs(glyph.left + glyph.width / 2 - (row.left + row.width / 2))).toBeLessThan(1);
		expect(Math.abs(glyph.left + glyph.width / 2 - (rail.left + rail.width / 2))).toBeLessThan(2);
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

	test("an identity without a menu is plain content: no button, chevron or focus stop", async () => {
		mountShell();
		let row = identity("footer");
		expect(row.tagName).toBe("DIV");
		expect(row.querySelector("button")).toBeNull();
		expect(row.hasAttribute("aria-haspopup")).toBe(false);
		expect(row.querySelectorAll("svg")).toHaveLength(1);
		expect(row.tabIndex).toBe(-1);
		expect(getComputedStyle(row).cursor).toBe("default");
	});

	test("an identity with a menu is a menu button that opens it, and Esc closes it", async () => {
		mountShell();
		let row = identity("header");
		let menu = document.getElementById("workspaces")!;
		expect(row.tagName).toBe("BUTTON");
		expect(row.getAttribute("aria-haspopup")).toBe("menu");
		expect(row.querySelectorAll("svg")).toHaveLength(2);
		expect(menu.getAttribute("role")).toBe("menu");
		expect(getComputedStyle(row).cursor).toBe("pointer");

		await userEvent.click(row);
		expect(menu.matches(":popover-open")).toBe(true);
		expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			row.getBoundingClientRect().bottom,
		);

		await userEvent.keyboard("{Escape}");
		expect(menu.matches(":popover-open")).toBe(false);
	});

	test("the identity's menu opens from the collapsed rail", async () => {
		await reduceMotion();
		mountShell({ collapsed: true });
		let menu = document.getElementById("workspaces")!;
		await userEvent.click(identity("header"));
		expect(menu.matches(":popover-open")).toBe(true);
		expect(menu.textContent).toContain("Switch workspace");
	});

	test("an identity's avatar renders whole: a root Avatar at any size and a raw 32px image", async () => {
		await reduceMotion();
		await page.viewport(1280, 800);
		for (let collapsed of [false, true]) {
			for (let avatar of AVATARS) {
				mountShell({
					collapsed,
					footer: <AppShell.Identity avatar={avatar} name="Ada Lovelace" />,
				});
				await frames();
				expectWholeAvatar(identity("footer"));
				mounted?.cleanup();
				mounted = undefined;
			}
		}
	});

	test("an identity's avatar keeps its size in a row too narrow for the name", async () => {
		mounted = render(
			<div style="inline-size: 40px">
				<AppShell.Identity
					avatar={<img src={PICTURE} alt="" width="32" height="32" />}
					name="A name far wider than the row it sits in"
				/>
			</div>,
		);
		await frames();
		let slot = document.querySelector<HTMLElement>('[data-slot="app-shell-identity"] > span')!;
		expect(slot.getBoundingClientRect().width).toBe(24);
		expect(slot.getBoundingClientRect().height).toBe(24);
		expectWholeAvatar(document.querySelector<HTMLElement>('[data-slot="app-shell-identity"]')!);
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

	test("a navigation that leaves the sidebar in place moves its current row to the address", () => {
		mountShell({
			nav: (
				<AppShell.Group>
					<AppShell.Item href="/elsewhere" label="Elsewhere" current />
					<AppShell.Item href={location.pathname} label="Here" />
				</AppShell.Group>
			),
		});
		let [elsewhere, here] = document.querySelectorAll<HTMLAnchorElement>(
			'[data-slot="app-shell-item"] > a',
		);

		navigation.dispatchEvent(new Event("navigatesuccess"));

		expect(here!.getAttribute("aria-current")).toBe("page");
		expect(here!.hasAttribute("data-current")).toBe(true);
		expect(elsewhere!.hasAttribute("aria-current")).toBe(false);
		expect(elsewhere!.hasAttribute("data-current")).toBe(false);
	});

	test("a navigation retitles the page from the pane it landed", () => {
		let before = document.title;
		mountShell({
			pane: (
				<AppShell.Pane labels={LABELS} title="Invoices — Acme">
					<p>Screen</p>
				</AppShell.Pane>
			),
		});

		navigation.dispatchEvent(new Event("navigatesuccess"));

		expect(document.title).toBe("Invoices — Acme");
		document.title = before;
	});

	test("a pane passed in stands in for the top bar and main", () => {
		mountShell({
			pane: (
				<AppShell.Pane labels={LABELS} id="framed" topbar={<span>Crumb</span>}>
					<p>Screen</p>
				</AppShell.Pane>
			),
		});

		expect(document.querySelector('[data-slot="app-shell-topbar"]')!.textContent).toContain(
			"Crumb",
		);
		expect(document.querySelector("main#framed-main")!.textContent).toBe("Screen");
		expect(document.querySelectorAll("main")).toHaveLength(1);
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

describe("AppShell content scroll across in-place navigations", () => {
	/** Answers every navigation in place, as a frame router does, so the document never reloads. */
	function interceptNavigations(): () => void {
		let controller = new AbortController();
		navigation.addEventListener(
			"navigate",
			(event) => event.intercept({ handler: async () => {} }),
			{
				signal: controller.signal,
			},
		);
		return () => controller.abort();
	}

	/** The panel the shell's content scrolls in. */
	function panel(): HTMLElement {
		return document.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;
	}

	test("returns to where the visitor left a page on Back, and starts a new page at the top", async () => {
		await page.viewport(1280, 800);
		mountShell();
		let stop = interceptNavigations();
		let start = location.href;
		await new Promise((resolve) => setTimeout(resolve, 50));
		panel().scrollTop = 600;
		expect(panel().scrollTop).toBe(600);

		await navigation.navigate(`${location.pathname}-next`).finished;
		await expect.poll(() => panel().scrollTop).toBe(0);
		panel().scrollTop = 200;

		await navigation.back().finished;
		await expect.poll(() => panel().scrollTop).toBe(600);
		await navigation.forward().finished;
		await expect.poll(() => panel().scrollTop).toBe(200);

		await navigation.navigate(start, { history: "replace" }).finished;
		stop();
	});
});
