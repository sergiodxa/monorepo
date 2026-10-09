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

describe("GET /frames/previews/:component", () => {
	test("answers with the component's live preview as a fragment", async () => {
		let response = await fetchApp("/frames/previews/color-picker");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toMatch(/^text\/html/);
		expect(body).not.toContain("<html");
		expect(body).toContain(`aria-label="Open the color picker"`);
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
