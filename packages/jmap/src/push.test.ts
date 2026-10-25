/**
 * Reads the RFC 8620 push examples: a StateChange and a PushVerification as a push
 * service delivers them, and both as events in a `text/event-stream`, however the
 * stream is split into chunks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ServerSentEvent } from "./event-stream.js";
import type { PushEvent, StateChange } from "./push.js";

import { readEventStream } from "./event-stream.js";
import { PUSH_VERIFICATION, STATE_CHANGE } from "./fixtures/rfc8620.js";
import { parsePush, readPushEvents } from "./push.js";

/** A byte stream that delivers `chunks` one read at a time. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
	let encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (let chunk of chunks) controller.enqueue(encoder.encode(chunk));
			controller.close();
		},
	});
}

/** Every value an async iterable yields. */
async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
	let values: T[] = [];
	for await (let value of iterable) values.push(value);
	return values;
}

describe("parsePush", () => {
	test("reads the RFC 8620 StateChange", async () => {
		expect(await parsePush(STATE_CHANGE)).toEqual({ status: "success", data: STATE_CHANGE });
	});

	test("reads the RFC 8620 PushVerification", async () => {
		expect(await parsePush(PUSH_VERIFICATION)).toEqual({
			status: "success",
			data: PUSH_VERIFICATION,
		});
	});

	test("rejects another @type", async () => {
		let result = await parsePush({ "@type": "Other", changed: {} });

		expect(isFailure(result)).toBe(true);
	});

	test("rejects a StateChange whose states are not strings", async () => {
		let result = await parsePush({ "@type": "StateChange", changed: { a: { Email: 1 } } });

		expect(isFailure(result)).toBe(true);
	});
});

describe("readEventStream", () => {
	test("joins data lines and carries the last id across events", async () => {
		let events = await collect(
			readEventStream(streamOf([": comment\nid: 1\ndata: a\ndata: b\n\nevent: ping\ndata: c\n\n"])),
		);

		expect(events).toEqual<ServerSentEvent[]>([
			{ event: "message", data: "a\nb", id: "1" },
			{ event: "ping", data: "c", id: "1" },
		]);
	});

	test("treats a CRLF split across chunks as one line break", async () => {
		let events = await collect(readEventStream(streamOf(["data: a\r", "\n\r", "\n"])));

		expect(events).toEqual([{ event: "message", data: "a", id: null }]);
	});

	test("reads lone CRs as line breaks and drops an event the stream never ends", async () => {
		let events = await collect(readEventStream(streamOf(["data:a\r\rdata: b"])));

		expect(events).toEqual([{ event: "message", data: "a", id: null }]);
	});

	test("decodes a multi-byte character split across chunks", async () => {
		let bytes = new TextEncoder().encode("data: ñ\n\n");
		let stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes.slice(0, 7));
				controller.enqueue(bytes.slice(7));
				controller.close();
			},
		});

		expect(await collect(readEventStream(stream))).toEqual([
			{ event: "message", data: "ñ", id: null },
		]);
	});
});

describe("readPushEvents", () => {
	test("yields state and ping events and skips the rest", async () => {
		let stream = streamOf([
			`event: state\nid: s1\ndata: ${JSON.stringify(STATE_CHANGE)}\n\n`,
			"event: state\ndata: not json\n\n",
			"event: other\ndata: {}\n\n",
			'event: ping\ndata: {"interval":60}\n\n',
		]);

		expect(await collect(readPushEvents(stream))).toEqual<PushEvent[]>([
			{ type: "state", id: "s1", change: STATE_CHANGE as StateChange },
			{ type: "ping", interval: 60 },
		]);
	});
});
