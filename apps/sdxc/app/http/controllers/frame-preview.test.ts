/**
 * Tests for the fragments a guide's `frame` tag loads. A guide's region is only as live
 * as the route behind it, so these assertions keep a preview that stopped resolving, or
 * a page that stopped resolving its frames, from reaching a reader as a blank region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/lib/test/router";
import { readComponent } from "~/app/services/components";
import {
	exampleComponents,
	findPreview,
	listExamples,
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
