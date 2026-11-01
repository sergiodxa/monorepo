/**
 * Lays a {@link DocsNotFound} out in a real browser and checks the query a 404 pre-fills:
 * the missing path as code that wraps at 320, the search slot, the start links under a
 * heading one level below the title, and {@link searchQueryFromPath}'s derivation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { DocsNotFound, searchQueryFromPath } from "./docs-not-found.js";

import "../reset.css";
import "../theme.css";

/** A long address that has no break opportunity, as a mistyped slug often is. */
const LONG_PATH =
	"/docs/guides/configure-webhook-signatures-for-every-outbound-notification-channel";

/** Mounts a 404 for `path` in a host `width` pixels wide and returns the host. */
function mount(width: number, path = "/docs/guides/web-hooks"): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<DocsNotFound
			path={path}
			search={
				<input
					type="search"
					aria-label="Search the docs"
					value={searchQueryFromPath(path)}
					style="inline-size: 100%"
				/>
			}
			links={[
				{ title: "Quickstart", href: "/docs/quickstart", description: "Add your first monitor." },
				{ title: "API overview", href: "/docs/api/overview" },
			]}
			labels={{
				eyebrow: "404",
				title: "Page not found",
				body: "No page answers to this address. Search for it instead.",
				linksTitle: "Start from one of these",
			}}
		/>,
		{ container: host },
	);
	return host;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("searchQueryFromPath", () => {
	test.each([
		["/docs/guides/web-hooks", "web hooks"],
		["/docs/guides/web-hooks/", "web hooks"],
		["/docs/api/rate_limits.md?ref=nav#top", "rate limits"],
		["https://uptime.example.com/docs/status-pages", "status pages"],
		["/docs/caf%C3%A9-menu", "café menu"],
		["/docs/broken%E0%A4%A", "broken%E0%A4%A"],
		["/docs/sms+alerts", "sms alerts"],
		["/", ""],
		["", ""],
	])("derives %j as %j", (path, query) => {
		expect(searchQueryFromPath(path)).toBe(query);
	});
});

describe("DocsNotFound", () => {
	test("shows the missing path as code and the search pre-filled from it", () => {
		let host = mount(800);
		let code = host.querySelector('[data-slot="docs-not-found-path"]')!;
		expect(code.tagName).toBe("CODE");
		expect(code.textContent).toBe("/docs/guides/web-hooks");
		let input = host.querySelector<HTMLInputElement>('[data-slot="docs-not-found-search"] input')!;
		expect(input.value).toBe("web hooks");
	});

	test("outlines the title as h1 and the links block as h2", () => {
		let host = mount(800);
		let levels = Array.from(host.querySelectorAll("h1, h2, h3")).map((heading) => [
			heading.tagName,
			heading.textContent,
		]);
		expect(levels).toEqual([
			["H1", "Page not found"],
			["H2", "Start from one of these"],
		]);
	});

	test("makes each start link a whole-row target at least 44px tall", () => {
		let host = mount(800);
		let links = Array.from(host.querySelectorAll<HTMLElement>('[data-slot="docs-not-found-link"]'));
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/docs/quickstart",
			"/docs/api/overview",
		]);
		for (let link of links) {
			expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}
	});

	test("wraps a long path at 320 with nothing wider than the page", () => {
		let host = mount(320, LONG_PATH);
		let hostBox = host.getBoundingClientRect();
		expect(host.scrollWidth).toBeLessThanOrEqual(320);
		for (let element of Array.from(host.querySelectorAll("*"))) {
			expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(hostBox.right + 0.5);
		}
		let code = host.querySelector('[data-slot="docs-not-found-path"]')!;
		expect(code.getBoundingClientRect().height).toBeGreaterThan(30);
	});
});
