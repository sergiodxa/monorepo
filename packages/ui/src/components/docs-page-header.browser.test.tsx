/**
 * Renders the docs page header in a real browser: the trail marks the current page, the
 * title is the page's only `<h1>`, the date is a machine-readable `<time>`, slots land in
 * place, and a long unbroken title fits 320px with the current crumb dropped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { DocsPageHeader } from "./docs-page-header.js";

const CRUMBS: DocsPageHeader.Crumb[] = [
	{ label: "Docs", href: "/docs" },
	{ label: "Packages" },
	{ label: "@sdxc/http-cache-control-middleware" },
];

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** A header with every slot filled. */
function full(): JSX.Element {
	return (
		<DocsPageHeader
			crumbs={CRUMBS}
			crumbsLabel="Breadcrumb"
			title="@sdxc/http-cache-control-middleware"
			mono
			description="Sets Cache-Control on every response from one declared policy."
			updated={{ label: "Last updated", date: "2026-10-12", text: "Oct 12, 2026" }}
			actions={<button type="button">Copy page</button>}
			notice={<p data-testid="notice">Available on the Team plan</p>}
		/>
	);
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("DocsPageHeader", () => {
	test("links every crumb but the last, which marks the current page", () => {
		let host = mount(full());
		let nav = host.querySelector("nav")!;
		let links = [...nav.querySelectorAll("a")];

		expect(nav.getAttribute("aria-label")).toBe("Breadcrumb");
		expect(links[0]?.getAttribute("href")).toBe("/docs");
		expect(links[1]?.hasAttribute("href")).toBe(false);
		expect(links[2]?.getAttribute("aria-current")).toBe("page");
		expect(links[2]?.hasAttribute("href")).toBe(false);
	});

	test("titles the page with its one h1 and keeps the slots in reading order", () => {
		let host = mount(full());
		let order = [...host.querySelectorAll("header > *")].map(
			(element) => element.getAttribute("data-slot") ?? element.getAttribute("data-testid"),
		);

		expect(host.querySelectorAll("h1")).toHaveLength(1);
		expect(order).toEqual([
			"breadcrumbs",
			"docs-page-header-title",
			"docs-page-header-description",
			"notice",
			"docs-page-header-meta",
		]);
	});

	test("renders the date as a machine-readable time beside the actions", () => {
		let host = mount(full());
		let time = host.querySelector("time")!;
		let meta = host.querySelector('[data-slot="docs-page-header-meta"]')!;

		expect(time.getAttribute("datetime")).toBe("2026-10-12");
		expect(time.textContent).toBe("Oct 12, 2026");
		expect(meta.querySelector("button")?.textContent).toBe("Copy page");
	});

	test("omits the trail and meta row when given neither", () => {
		let host = mount(<DocsPageHeader title="Alerts" />);

		expect(host.querySelector("nav")).toBeNull();
		expect(host.querySelector('[data-slot="docs-page-header-meta"]')).toBeNull();
	});

	test("fits a long unbroken title at 320px and drops the current crumb", async () => {
		await page.viewport(320, 640);
		let host = mount(full(), 288);
		let crumbs = host.querySelectorAll("li");

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
		expect(host.querySelector("h1")!.scrollWidth).toBeLessThanOrEqual(288);
		expect(getComputedStyle(crumbs[2]!).display).toBe("none");
		expect(getComputedStyle(crumbs[0]!).display).not.toBe("none");
	});
});
