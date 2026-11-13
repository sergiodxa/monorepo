/**
 * Tests the demo apps' stream route: a live part answers as uncached plain text, read as it
 * is written, and an app or part with nothing live answers `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoAppStreamHref } from "~/resources/views/demo-apps";

describe("a demo app's stream", () => {
	test("names the part under the app's own path, keeping its query", () => {
		expect(demoAppStreamHref("delta")("runs/815/job/4?after=14")).toBe(
			"/demo/apps/delta/streams/runs/815/job/4?after=14",
		);
	});

	test("answers 404 for an app that streams nothing", async () => {
		let response = await fetchApp("/demo/apps/pulse/streams/anything");

		expect(response.status).toBe(404);
	});

	test("answers 404 for an app that doesn't exist", async () => {
		let response = await fetchApp("/demo/apps/no-such-app/streams/anything");

		expect(response.status).toBe(404);
	});
});
