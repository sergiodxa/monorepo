/**
 * Tests for the fragments a guide's `frame` tag loads. A guide's region is only as live
 * as the route behind it, so these assertions keep a preview that stopped resolving, or
 * a page that stopped resolving its frames, from reaching a reader as a blank region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp, ORIGIN } from "~/app/lib/test/router";
import { readComponent } from "~/app/services/components";
import {
	exampleComponents,
	findPreview,
	listExamples,
	previewSlugs,
} from "~/resources/components/preview-registry.server";

describe("GET /frames/previews/:component", () => {
	test("answers with the component's live preview as a fragment", async () => {
		let response = await fetchApp("/frames/previews/color-picker");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toMatch(/^text\/html/);
		expect(body).not.toContain("<html");
		expect(body).toContain(`aria-label="Open the color picker"`);
	});

	/**
	 * Rebuilding the body from a string, as the bundle cache does, lets the Workers runtime
	 * hand it back in 4 KB reads, and a page inlines only the first read of a blocking frame,
	 * which left the reference page's preview as a stylesheet with its markup after the page.
	 */
	test("streams the renderer's body rather than a rebuilt one", async () => {
		let response = await fetchApp("/frames/previews/color-picker");

		expect(response.headers.get("etag")).toBeNull();
		expect(response.headers.get("cache-control")).toBeNull();
	});

	test("answers a slug with no preview with a 404 fragment naming it", async () => {
		let response = await fetchApp("/frames/previews/not-a-component");

		expect(response.status).toBe(404);
		expect(await response.text()).toContain("No preview for “not-a-component”.");
	});
});

describe("a guide holding a frame", () => {
	test("streams the fallback, then the region the frame's route renders", async () => {
		let body = await (await fetchApp("/docs/content-and-feeds/markdown-frames")).text();
		let fallback = body.indexOf("Loading the color picker…");
		let region = body.indexOf(`aria-label="Open the color picker"`);

		expect(fallback).toBeGreaterThan(-1);
		expect(region).toBeGreaterThan(fallback);
	});
});

describe("GET /frames/previews/:component/:example", () => {
	test("answers with the example as a fragment", async () => {
		let response = await fetchApp("/frames/previews/dialog/animated");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).not.toContain("<html");
		expect(body).toContain("Welcome to Acme");
	});

	test("answers an example the component lacks with a 404 fragment naming it", async () => {
		let response = await fetchApp("/frames/previews/dialog/not-an-example");

		expect(response.status).toBe(404);
		expect(await response.text()).toContain("No preview for “dialog/not-an-example”.");
	});
});

describe("live examples", () => {
	/**
	 * A component page shows either every documented example live or every one as source,
	 * so a component with live examples covers each example its reference documents beyond
	 * the one the opening preview already shows.
	 */
	test.each(exampleComponents())("%s covers every documented example", async (component) => {
		let reference = await readComponent(component);
		expect(reference).not.toBeNull();

		let documented = (reference?.examples.length ?? 0) - (findPreview(component) ? 1 : 0);
		expect(listExamples(component).length).toBeGreaterThanOrEqual(documented);
	});

	test.each(exampleComponents())(
		"%s renders its examples inline on its page",
		async (component) => {
			let body = await (await fetchApp(`/api/ui/${component}`)).text();

			for (let example of listExamples(component)) {
				expect(body).toContain(`>${example.title}</h3>`);
				let fragment = await (
					await fetchApp(`/frames/previews/${component}/${example.slug}`)
				).text();
				expect(fragment.length).toBeGreaterThan(0);
			}
			expect(body).not.toContain("<template");
		},
	);
});

/** Every fragment a component page frames: each opening preview, then each live example. */
function previewSources(): string[] {
	return [
		...previewSlugs().map((component) => `/frames/previews/${component}`),
		...exampleComponents().flatMap((component) =>
			listExamples(component).map((example) => `/frames/previews/${component}/${example.slug}`),
		),
	];
}

/**
 * The places a fragment's links and forms send a reader, outside the code block it shows. A
 * `POST` form with no `action` submits to the page holding it, so it is reported as unreachable.
 */
function destinations(html: string): { method: string; url: string }[] {
	let markup = html.replace(/<pre[\s\S]*?<\/pre>/g, "");
	let found = [
		...[...markup.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((match) => ({
			method: "GET",
			url: match[1] ?? "",
		})),
		...[...markup.matchAll(/\s(?:action|formaction)="([^"]*)"/g)].map((match) => ({
			method: "POST",
			url: match[1] ?? "",
		})),
	].map((found) => ({ ...found, url: found.url.replaceAll("&amp;", "&") }));
	for (let form of markup.matchAll(/<form\b[^>]*>/g)) {
		if (/method="post"/i.test(form[0]) && !/\saction="/.test(form[0])) {
			found.push({ method: "POST", url: "(the page holding the form)" });
		}
	}
	return found;
}

describe("live example destinations", () => {
	/**
	 * A reader pressing a link or submitting a form inside an example stays on the site: each
	 * one leads to a page that answers, an in-page fragment, or an `/examples/` address that
	 * returns them to where they were.
	 */
	test("every link and form inside a preview leads somewhere that answers", async () => {
		let broken: string[] = [];

		for (let src of previewSources()) {
			let html = await (await fetchApp(src)).text();

			for (let { method, url } of destinations(html)) {
				if (/^(#|data:|https?:|mailto:|tel:)/.test(url)) continue;
				let component = src.split("/")[3] ?? "";
				let target = new URL(url, `${ORIGIN}/api/ui/${component}`);
				let response =
					target.origin === ORIGIN
						? await fetchApp(`${target.pathname}${target.search}`, { method, redirect: "manual" })
						: undefined;
				if (response === undefined || response.status >= 400) {
					broken.push(`${src}: ${method} ${url} → ${response?.status ?? "unreachable"}`);
				}
			}
		}

		expect(broken).toEqual([]);
	}, 120_000);
});

describe("/examples/*path", () => {
	test("returns a reader to the page they pressed a link on", async () => {
		let response = await fetchApp("/examples/settings/billing", {
			headers: { referer: `${ORIGIN}/api/ui/nav-link#examples` },
			redirect: "manual",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/api/ui/nav-link#examples");
	});

	test("returns a reader to the page they submitted a form from", async () => {
		let response = await fetchApp("/examples/workspaces", {
			method: "POST",
			headers: { referer: `${ORIGIN}/docs/content-and-feeds/markdown-frames` },
			redirect: "manual",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/docs/content-and-feeds/markdown-frames");
	});

	/**
	 * A runtime navigation commits the `/examples/` address before it fetches it, so its
	 * `Referer` is that address; answering with it would redirect the request to itself.
	 */
	test("never sends a reader back to an example address", async () => {
		let response = await fetchApp("/examples/dashboard", {
			headers: { referer: `${ORIGIN}/examples/dashboard` },
			redirect: "manual",
		});

		expect(response.headers.get("location")).toBe("/api/ui");
	});

	test("sends a request from another site to the component reference instead", async () => {
		let response = await fetchApp("/examples/settings", {
			headers: { referer: "https://elsewhere.com/page" },
			redirect: "manual",
		});

		expect(response.headers.get("location")).toBe("/api/ui");
	});
});
