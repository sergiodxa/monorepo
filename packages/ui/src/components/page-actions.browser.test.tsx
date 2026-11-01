/**
 * Runs the "Copy page" split button in a real browser: the chevron opens the menu through
 * `popovertarget` alone, every link carries its description and new-tab rule, a copy writes
 * the fetched Markdown and swaps the label to "Copied" with an announcement, and 320px fits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PageActions } from "./page-actions.js";

import "../theme.css";

const LABELS: PageActions.Labels = {
	copy: "Copy page",
	copied: "Copied",
	failed: "Could not copy the page",
	more: "More ways to use this page",
};

const LINKS: PageActions.Link[] = [
	{
		label: "View as Markdown",
		description: "Read the page as plain text",
		href: "/docs/install.md",
	},
	{
		label: "Open in Claude",
		description: "Ask questions about this page",
		href: "https://claude.ai/new?q=Read",
		external: true,
	},
];

const MARKDOWN = "# Install\n\nRun `bun add @sdxc/ui`.";

let worker = setupWorker(
	http.get("*/docs/install.md", () => HttpResponse.text(MARKDOWN)),
	http.get("*/docs/missing.md", () => new HttpResponse(null, { status: 404 })),
);

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The main copy button. */
function copyButton(host: HTMLElement): HTMLButtonElement {
	return host.querySelector<HTMLButtonElement>('[data-slot="page-actions-copy"]')!;
}

/** The label a sighted reader sees on the copy button right now. */
function visibleLabel(button: HTMLButtonElement): string {
	return [...button.querySelectorAll<HTMLElement>("[data-state]")]
		.filter((element) => getComputedStyle(element).display !== "none")
		.map((element) => element.textContent)
		.join("");
}

/** Clicks the copy button and resolves once its `ui:copy` event settles. */
async function clickCopy(button: HTMLButtonElement): Promise<boolean> {
	let settled = new Promise<boolean>((resolve) => {
		button.addEventListener("ui:copy", (event) => resolve(event.success), { once: true });
	});
	button.click();
	return settled;
}

beforeAll(async () => {
	await worker.start({ onUnhandledRequest: "bypass", quiet: true });
});

afterAll(() => worker.stop());

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("PageActions buttons", () => {
	test("draw as one filled shape, rounded on the group's outer corners", () => {
		let host = mount(<PageActions markdownHref="/docs/install.md" labels={LABELS} links={LINKS} />);
		let copy = getComputedStyle(copyButton(host));
		let trigger = getComputedStyle(
			host.querySelector<HTMLButtonElement>('[data-slot="page-actions-trigger"]')!,
		);

		expect(copy.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(trigger.backgroundColor).toBe(copy.backgroundColor);
		expect(copy.borderStartStartRadius).not.toBe("0px");
		expect(copy.borderStartEndRadius).toBe("0px");
		expect(trigger.borderStartStartRadius).toBe("0px");
		expect(trigger.borderStartEndRadius).toBe(copy.borderStartStartRadius);
		expect(trigger.borderEndEndRadius).toBe(copy.borderEndStartRadius);
	});
});

describe("PageActions menu", () => {
	test("opens the menu from the chevron through popovertarget, with no script of its own", async () => {
		let host = mount(<PageActions markdownHref="/docs/install.md" labels={LABELS} links={LINKS} />);
		let trigger = host.querySelector<HTMLButtonElement>('[data-slot="page-actions-trigger"]')!;
		let menu = host.querySelector<HTMLElement>("[popover]")!;

		expect(trigger.getAttribute("popovertarget")).toBe(menu.id);
		expect(trigger.getAttribute("aria-label")).toBe("More ways to use this page");
		expect(menu.matches(":popover-open")).toBe(false);
		await userEvent.click(trigger);
		expect(menu.matches(":popover-open")).toBe(true);
	});

	test("lists each link with its description and opens external ones in a new tab", () => {
		let host = mount(<PageActions markdownHref="/docs/install.md" labels={LABELS} links={LINKS} />);
		let [markdown, claude] = [...host.querySelectorAll<HTMLAnchorElement>("[popover] a")];

		expect(markdown?.textContent).toContain("Read the page as plain text");
		expect(markdown?.hasAttribute("target")).toBe(false);
		expect(claude?.getAttribute("target")).toBe("_blank");
		expect(claude?.getAttribute("rel")).toBe("noopener noreferrer");
	});

	test("leaves the chevron out when there are no links", () => {
		let host = mount(<PageActions markdownHref="/docs/install.md" labels={LABELS} />);

		expect(host.querySelector('[data-slot="page-actions-trigger"]')).toBeNull();
		expect(host.querySelector("[popover]")).toBeNull();
	});
});

describe("PageActions copy", () => {
	test("copies the fetched Markdown, swaps the label to Copied and announces it", async () => {
		let written: string[] = [];
		vi.spyOn(navigator.clipboard, "write").mockImplementation(async (items) => {
			for (let item of items) written.push(await (await item.getType("text/plain")).text());
		});
		let host = mount(<PageActions markdownHref="/docs/install.md" labels={LABELS} links={LINKS} />);
		let button = copyButton(host);

		expect(visibleLabel(button)).toBe("Copy page");
		expect(await clickCopy(button)).toBe(true);
		expect(written).toEqual([MARKDOWN]);
		expect(visibleLabel(button)).toBe("Copied");
		expect(button.querySelector('[role="status"]')?.textContent).toBe("Copied");
	});

	test("announces a failure when the Markdown twin is missing", async () => {
		vi.spyOn(navigator.clipboard, "write").mockImplementation(async (items) => {
			for (let item of items) await item.getType("text/plain");
		});
		let host = mount(<PageActions markdownHref="/docs/missing.md" labels={LABELS} />);
		let button = copyButton(host);

		expect(await clickCopy(button)).toBe(false);
		expect(visibleLabel(button)).toBe("Copy page");
		expect(button.querySelector('[role="status"]')?.textContent).toBe("Could not copy the page");
	});

	test("fits a 320px viewport", async () => {
		await page.viewport(320, 640);
		mount(<PageActions markdownHref="/docs/install.md" labels={LABELS} links={LINKS} />, 288);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});
});
