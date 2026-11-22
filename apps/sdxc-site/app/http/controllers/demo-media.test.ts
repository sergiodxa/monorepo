/**
 * Holds the demo media route to what a browser's video element needs to seek: the whole clip
 * with `Accept-Ranges`, any byte range as `206` with its `Content-Range`, `416` past the end,
 * and `404` for a file no clip has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { readRange } from "~/app/http/controllers/demo-media";
import { fetchApp } from "~/app/test/router";

/** A clip the Vesper demo plays. */
const CLIP = "/showcase/media/video/vesper/50.webm";

describe("GET /showcase/media/*file", () => {
	test("answers the whole clip and says it takes ranges", async () => {
		let response = await fetchApp(CLIP);
		let body = new Uint8Array(await response.arrayBuffer());
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("video/webm");
		expect(response.headers.get("Accept-Ranges")).toBe("bytes");
		expect(Number(response.headers.get("Content-Length"))).toBe(body.length);
		expect(body.length).toBeGreaterThan(100);
	});

	test("answers a range as 206 with exactly those bytes", async () => {
		let whole = new Uint8Array(await (await fetchApp(CLIP)).arrayBuffer());
		let response = await fetchApp(CLIP, { headers: { Range: "bytes=10-29" } });
		let part = new Uint8Array(await response.arrayBuffer());
		expect(response.status).toBe(206);
		expect(response.headers.get("Content-Range")).toBe(`bytes 10-29/${whole.length}`);
		expect(Array.from(part)).toEqual(Array.from(whole.subarray(10, 30)));
	});

	test("answers a range past the end as 416, and an unknown file as 404", async () => {
		let past = await fetchApp(CLIP, { headers: { Range: "bytes=999999-" } });
		expect(past.status).toBe(416);
		expect((await fetchApp("/showcase/media/video/nope.webm")).status).toBe(404);
		expect((await fetchApp("/showcase/media/video/../../routes/web.ts")).status).toBe(404);
	});

	test("serves the course lesson's clip too", async () => {
		let response = await fetchApp("/showcase/media/video/lesson.mp4", {
			headers: { Range: "bytes=0-" },
		});
		expect(response.status).toBe(206);
		expect(response.headers.get("Content-Type")).toBe("video/mp4");
	});
});

describe("readRange", () => {
	test("reads open, closed and suffix ranges within the size", () => {
		expect(readRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
		expect(readRange("bytes=10-200", 100)).toEqual({ start: 10, end: 99 });
		expect(readRange("bytes=-20", 100)).toEqual({ start: 80, end: 99 });
		expect(readRange("bytes=100-", 100)).toBe("unsatisfiable");
		expect(readRange("bytes=5-1", 100)).toBe("unsatisfiable");
		expect(readRange(null, 100)).toBeNull();
		expect(readRange("items=0-1", 100)).toBeNull();
	});
});
