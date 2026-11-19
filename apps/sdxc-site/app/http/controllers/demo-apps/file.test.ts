/**
 * Holds the demo file route to its contract: an app's file comes back with the app's content
 * type and is never stored, and an app without that file, or with no files at all, answers `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

describe("GET /demo/apps/:app/files/*part", () => {
	test("answers an app's file with its own content type, never stored", async () => {
		let response = await fetchApp("/demo/apps/sundial/files/calendars/work.ics");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toMatch(/^text\/calendar/);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(await response.text()).toMatch(/^BEGIN:VCALENDAR\r\n/);
	});

	test("answers 404 for a part the app lacks and for an app without files", async () => {
		expect((await fetchApp("/demo/apps/sundial/files/nothing.txt")).status).toBe(404);
		expect((await fetchApp("/demo/apps/cairn/files/anything.ics")).status).toBe(404);
	});
});
