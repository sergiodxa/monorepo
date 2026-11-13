/**
 * Tests `/demo/apps/:app(/*page)` through the real router over every demo app: each screen a
 * visitor can click to answers `noindex` with one `h1`, a missing screen answers the app's own
 * 404, a toast shows only when the app names it, and a form post can only send the visitor back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import {
	DEMO_APP_TOAST_PARAM,
	demoAppActionHref,
	demoAppHref,
	findDemoApp,
	listDemoAppSlugs,
} from "~/resources/views/demo-apps";

/** Every demo's slug with its app, loaded once for the table-driven tests below. */
let apps = await Promise.all(
	listDemoAppSlugs().map(async (slug) => ({ slug, app: (await findDemoApp(slug))! })),
);

/**
 * How many links of one shape the crawl fetches: enough to cover every filter and tab, few
 * enough that a page of diffs, whose every line links to the comment form, stays quick.
 */
const LINKS_PER_SHAPE = 24;

/** What a link asks of its page: its path and the names of its query parameters. */
function linkShape(path: string): string {
	let url = new URL(path, "http://localhost");
	let names = [...new Set(url.searchParams.keys())].sort().join("&");
	return `${url.pathname}?${names}`;
}

/** Counts the `<h1>` elements a rendered page holds. */
function countH1(body: string): number {
	return [...body.matchAll(/<h1[\s>]/g)].length;
}

describe("GET /demo/apps/:app", () => {
	test("the catalogue holds a dashboard, a CMS, an inbox, a chat assistant, a social network and an issue tracker", () => {
		expect(listDemoAppSlugs()).toEqual(
			expect.arrayContaining(["cairn", "chorus", "inkwell", "pulse", "relay", "tern"]),
		);
	});

	test.each(apps)(
		"every $slug screen answers with one h1 and stays out of search",
		async ({ slug, app }) => {
			expect(app.screens).toContain("");
			for (let screen of app.screens) {
				let response = await fetchApp(demoAppHref(slug)(screen));
				let body = await response.text();

				expect(response.status, screen).toBe(200);
				expect(body, screen).toMatch(/<meta name="robots" content="noindex, nofollow"/);
				expect(countH1(body), screen).toBe(1);
				expect(body, screen).not.toContain("[object Object]");
			}
		},
	);

	test.each(apps)("every $slug link inside the app answers", async ({ slug, app }) => {
		let root = demoAppHref(slug)();
		let links = new Map<string, Set<string>>();
		for (let screen of app.screens) {
			let body = await (await fetchApp(demoAppHref(slug)(screen))).text();
			for (let [, href] of body.matchAll(/(?<![\w-])href="([^"#]+)/g)) {
				let path = href!.replaceAll("&amp;", "&");
				if (path === root || path.startsWith(`${root}/`) || path.startsWith(`${root}?`)) {
					let shaped = links.get(linkShape(path)) ?? new Set<string>();
					if (shaped.size < LINKS_PER_SHAPE) shaped.add(path);
					links.set(linkShape(path), shaped);
				}
			}
		}

		for (let shaped of links.values()) {
			for (let link of shaped) expect((await fetchApp(link)).status, link).toBe(200);
		}
	});

	test.each(apps)("a missing $slug screen answers the app's own 404", async ({ slug }) => {
		let response = await fetchApp(demoAppHref(slug)("no-such-screen/at-all"));
		let body = await response.text();

		expect(response.status).toBe(404);
		expect(countH1(body)).toBe(1);
		expect(body).toMatch(/<meta name="robots" content="noindex, nofollow"/);
	});

	test.each(apps.filter(({ slug }) => slug !== "chorus"))(
		"$slug's workspace and user rows open real menus, with Sign out back to the gallery",
		async ({ slug }) => {
			let body = await (await fetchApp(demoAppHref(slug)())).text();
			let targets = [...body.matchAll(/<button\b[^>]*aria-haspopup="menu"[^>]*>/g)].map(
				([tag]) => /commandfor="([^"]+)"/.exec(tag)?.[1],
			);

			expect(targets).toEqual([`${slug}-workspace-menu`, `${slug}-user-menu`]);
			for (let id of targets) expect(body).toContain(`id="${id}"`);
			expect(body).toMatch(/href="\/demo"[^>]*>Sign out</);
		},
	);

	test("caches each query state and layout cookie apart, and never a toast's page", async () => {
		let tag = async (path: string, cookie = "") =>
			(await fetchApp(path, { headers: cookie === "" ? {} : { Cookie: cookie } })).headers.get(
				"ETag",
			);
		let plain = await tag("/demo/apps/pulse/services");
		let filtered = await tag("/demo/apps/pulse/services?status=down");
		let collapsed = await tag("/demo/apps/pulse/services", "ui-app-shell-collapsed=1");
		let unrelated = await tag("/demo/apps/pulse/services", "theme=dark");
		let toast = await fetchApp("/demo/apps/pulse/services?toast=service-paused.1a2b3c4d");

		expect(plain).toBeTruthy();
		expect(new Set([plain, filtered, collapsed]).size).toBe(3);
		expect(unrelated).toBe(plain);
		expect(toast.headers.get("ETag")).toBeNull();
		expect(toast.headers.get("Cache-Control")).toBeNull();

		let revalidated = await fetchApp("/demo/apps/pulse/services", {
			headers: { "If-None-Match": plain! },
		});
		expect(revalidated.status).toBe(304);
	});

	test.each(apps)(
		"$slug prefetches only safe in-app pages, and its nav and rows on intent",
		async ({ slug, app }) => {
			let root = demoAppHref(slug)();
			let prefetched = 0;
			for (let screen of app.screens) {
				let body = await (await fetchApp(demoAppHref(slug)(screen))).text();
				for (let [tag] of body.matchAll(/<a\b[^>]*data-rmx-prefetch="[^"]+"[^>]*>/g)) {
					let href = /href="([^"]+)"/.exec(tag)?.[1] ?? "";
					expect(href, tag).toMatch(new RegExp(`^${root}(/|\\?|$)`));
					expect(href, tag).not.toContain("toast=");
					prefetched++;
				}
			}
			expect(prefetched).toBeGreaterThan(app.screens.length);
		},
	);

	test.each(apps)(
		"$slug drops a one-time toast from every prefetched link on the page it greets",
		async ({ slug, app }) => {
			let key = Object.keys(app.toasts)[0]!;
			for (let screen of app.screens) {
				let separator = screen.includes("?") ? "&" : "?";
				let path = `${demoAppHref(slug)(screen)}${separator}${DEMO_APP_TOAST_PARAM}=${key}.1a2b3c4d`;
				let body = await (await fetchApp(path)).text();
				let carrying = [...body.matchAll(/<a\b[^>]*data-rmx-prefetch="[^"]+"[^>]*>/g)]
					.map(([tag]) => tag)
					.filter((tag) => tag.includes("toast="));
				expect(carrying, path).toEqual([]);
			}
		},
	);

	test.each(apps)(
		"$slug varies by X-Remix-Target, and a name it owns no frame for still answers the screen",
		async ({ slug }) => {
			let page = await fetchApp(demoAppHref(slug)());
			let unknown = await fetchApp(demoAppHref(slug)(), {
				headers: { "X-Remix-Frame": "true", "X-Remix-Target": "no-such-frame" },
			});

			expect(page.headers.get("Vary")).toContain("X-Remix-Target");
			expect(unknown.headers.get("Vary")).toContain("X-Remix-Target");
			expect(await unknown.text()).toMatch(/^<!DOCTYPE html>/i);
		},
	);

	test("an unknown app answers the site's 404", async () => {
		expect((await fetchApp("/demo/apps/no-such-app")).status).toBe(404);
	});

	test.each(apps)("$slug shows a toast only when it names one", async ({ slug, app }) => {
		let [key, toast] = Object.entries(app.toasts)[0]!;
		let shown = await (
			await fetchApp(`${demoAppHref(slug)()}?${DEMO_APP_TOAST_PARAM}=${key}`)
		).text();
		let unknown = await (
			await fetchApp(`${demoAppHref(slug)()}?${DEMO_APP_TOAST_PARAM}=%3Cb%3Ehi%3C%2Fb%3E`)
		).text();

		expect(shown).toContain(toast.title!);
		expect(unknown).not.toContain("hi</b>");
		expect(unknown).not.toContain("&lt;b&gt;hi");
	});
});

describe("POST /demo/apps/:app/*page", () => {
	test("an unknown app answers 404", async () => {
		let response = await fetchApp("/demo/apps/no-such-app/anything", {
			method: "POST",
			body: new URLSearchParams({ name: "x" }),
		});
		expect(response.status).toBe(404);
	});

	test.each(apps)("$slug rejects a post it cannot read", async ({ slug }) => {
		let response = await fetchApp(demoAppActionHref(slug)("no-such-form"), {
			method: "POST",
			body: new URLSearchParams(),
		});
		expect(response.status).toBe(400);
	});
});
