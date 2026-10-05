/**
 * Exercises the body readers on messages built in memory: the cap counted off the
 * stream, a `Content-Length` that lies in either direction, a stream that breaks off,
 * requests as well as responses, and `limitBody` erroring mid-stream.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { OutboundError } from "./error.js";
import { limitBody, readBytes, readText, release } from "./read.js";

/** A stream handing out each chunk in turn, recording whether it was cancelled. */
function chunked(chunks: string[]) {
	let state = { cancelled: false, pulled: 0 };
	let encoder = new TextEncoder();
	let stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			let next = chunks[state.pulled++];
			if (next === undefined) controller.close();
			else controller.enqueue(encoder.encode(next));
		},
		cancel() {
			state.cancelled = true;
		},
	});
	return { stream, state };
}

describe("readText", () => {
	test("reads a body under the cap and counts its bytes", async () => {
		let result = await readText(new Response("héllo"), { maxBytes: 100 });
		expect(isSuccess(result) && result.data).toEqual({ text: "héllo", bytes: 6 });
	});

	test("decodes a character split across chunks", async () => {
		let bytes = new TextEncoder().encode("é");
		let stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes.slice(0, 1));
				controller.enqueue(bytes.slice(1));
				controller.close();
			},
		});

		let result = await readText(new Response(stream), { maxBytes: 10 });

		expect(isSuccess(result) && result.data.text).toBe("é");
	});

	test("reads an empty body as empty text", async () => {
		let result = await readText(new Response(null), { maxBytes: 10 });
		expect(isSuccess(result) && result.data).toEqual({ text: "", bytes: 0 });
	});

	test("refuses a declared length over the cap before reading", async () => {
		let { stream, state } = chunked(["x"]);
		let response = new Response(stream, { headers: { "content-length": "4096" } });

		let result = await readText(response, { maxBytes: 16 });

		expect(isFailure(result) && result.error.code).toBe("too-large");
		expect(state.pulled).toBeLessThanOrEqual(1);
		await Promise.resolve();
		expect(state.cancelled).toBe(true);
	});

	test("refuses a body that lies about its length at the byte past the cap", async () => {
		let { stream, state } = chunked(["0123456789", "0123456789", "0123456789"]);
		let response = new Response(stream, { headers: { "content-length": "10" } });

		let result = await readText(response, { maxBytes: 15 });

		expect(isFailure(result) && result.error.code).toBe("too-large");
		expect(state.pulled).toBeLessThan(4);
		await Promise.resolve();
		expect(state.cancelled).toBe(true);
	});

	test("reports a stream that breaks off as a network failure", async () => {
		let stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.error(new Error("connection reset"));
			},
		});

		let result = await readText(new Response(stream), { maxBytes: 100 });

		expect(isFailure(result) && result.error.code).toBe("network");
		expect(isFailure(result) && result.error.retryable).toBe(true);
	});

	test("names the URL a request carries", async () => {
		let request = new Request("https://example.com/hook", { method: "POST", body: "x".repeat(32) });

		let result = await readText(request, { maxBytes: 8 });

		expect(isFailure(result) && result.error.url).toBe("https://example.com/hook");
	});
});

describe("readBytes", () => {
	test("keeps the bytes exactly as they arrived", async () => {
		let request = new Request("https://example.com/", {
			method: "POST",
			body: new Uint8Array([0, 255, 1, 254]),
		});

		let result = await readBytes(request, { maxBytes: 4 });

		expect(isSuccess(result) && [...result.data.data]).toEqual([0, 255, 1, 254]);
		expect(isSuccess(result) && result.data.bytes).toBe(4);
	});

	test("refuses a body one byte past the cap", async () => {
		let result = await readBytes(new Response(new Uint8Array(5)), { maxBytes: 4 });
		expect(isFailure(result) && result.error.code).toBe("too-large");
	});
});

describe("limitBody", () => {
	test("keeps the status and headers and passes a body under the cap", async () => {
		let response = new Response("hello", {
			status: 203,
			headers: { "content-type": "image/png" },
		});

		let limited = limitBody(response, { maxBytes: 10 });

		expect(limited.status).toBe(203);
		expect(limited.headers.get("content-type")).toBe("image/png");
		expect(limited.url).toBe(response.url);
		expect(await limited.text()).toBe("hello");
	});

	test("errors mid-stream at the chunk past the cap", async () => {
		let { stream } = chunked(["aaaa", "bbbb", "cccc"]);
		let limited = limitBody(new Response(stream), { maxBytes: 6 });

		let reader = limited.body!.getReader();
		let first = await reader.read();
		let error = await reader.read().then(
			() => null,
			(reason: unknown) => reason,
		);

		expect(new TextDecoder().decode(first.value)).toBe("aaaa");
		expect(error).toBeInstanceOf(OutboundError);
		expect((error as OutboundError).code).toBe("too-large");
	});

	test("errors before forwarding a body that declares more than the cap", async () => {
		let response = new Response("x".repeat(64), { headers: { "content-length": "64" } });

		let limited = limitBody(response, { maxBytes: 16 });
		let result = await readText(limited, { maxBytes: 1024 });

		expect(isFailure(result) && result.error.code).toBe("too-large");
	});

	test("answers a response without a body as it is", () => {
		let response = new Response(null, { status: 204 });
		expect(limitBody(response, { maxBytes: 1 })).toBe(response);
	});
});

describe("release", () => {
	test("cancels a body and ignores a missing one", async () => {
		let { stream, state } = chunked(["x"]);

		release(stream);
		release(null);
		await Promise.resolve();

		expect(state.cancelled).toBe(true);
	});
});
