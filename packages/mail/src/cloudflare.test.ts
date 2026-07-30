/**
 * Tests the binding transport against a double standing in for the platform, so the
 * envelope it builds is asserted directly: a bare sender, one message per recipient,
 * the same assembled body for all of them, and a rejection reported as a failure
 * rather than thrown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";

import type { NormalizedMessage } from "./types";

import { CloudflareTransport } from "./cloudflare";
import { MailError } from "./errors";

/** Sender identity, with a display name so the envelope's bare address is observable. */
const SENDER = { email: "no-reply@example.com", name: "Example" };

/**
 * Stand-in for the platform's `EmailMessage`, recording what it was constructed
 * with. A real class is used rather than a plain object so the injected constructor
 * is exercised the way an app's import of it would be.
 */
class FakeEmailMessage {
	/**
	 * Records the envelope and body handed to the platform.
	 *
	 * @param from - Envelope sender.
	 * @param to - Envelope recipient.
	 * @param raw - The complete RFC 5322 message.
	 */
	constructor(
		readonly from: string,
		readonly to: string,
		readonly raw: string,
	) {}
}

/** Builds a normalized message, which is the only shape a transport receives. */
function createMessage(overrides?: Partial<NormalizedMessage>): NormalizedMessage {
	return {
		from: SENDER,
		to: [{ email: "ada@example.com", name: "Ada" }],
		cc: [],
		bcc: [],
		replyTo: [],
		subject: "Hi",
		html: "<p>Hi</p>",
		text: "Hi",
		headers: {},
		date: new Date("2026-01-01T00:00:00.000Z"),
		messageId: "<one@example.com>",
		...overrides,
	};
}

/**
 * Builds a binding double that records every message. `rejectFor` makes it refuse one
 * recipient, which is how the platform reports a destination it will not deliver to.
 */
function createBinding(rejectFor?: string) {
	let messages: FakeEmailMessage[] = [];

	let binding = {
		/** Records the message, or rejects when the recipient is the refused one. */
		async send(message: FakeEmailMessage): Promise<void> {
			if (message.to === rejectFor) throw new Error(`Destination "${message.to}" not verified`);
			messages.push(message);
		},
	};

	return { binding, messages };
}

/** Builds the transport around a double, with the fake constructor standing in for the platform's. */
function createTransport(rejectFor?: string) {
	let { binding, messages } = createBinding(rejectFor);
	let transport = new CloudflareTransport({ binding, EmailMessage: FakeEmailMessage });
	return { transport, messages };
}

describe("CloudflareTransport", () => {
	test("sends the assembled message with a bare sender and recipient envelope", async () => {
		let { transport, messages } = createTransport();

		let result = await transport.send(createMessage());

		expect(isSuccess(result)).toBe(true);
		expect(messages).toHaveLength(1);
		expect(messages[0]?.from).toBe("no-reply@example.com");
		expect(messages[0]?.to).toBe("ada@example.com");
	});

	test("hands over a raw MIME message carrying the headers and both body parts", async () => {
		let { transport, messages } = createTransport();

		await transport.send(createMessage({ subject: "Your invite", text: "Hi", html: "<p>Hi</p>" }));
		let raw = messages[0]?.raw ?? "";

		expect(raw).toContain("From: Example <no-reply@example.com>\r\n");
		expect(raw).toContain("To: Ada <ada@example.com>\r\n");
		expect(raw).toContain("Subject: Your invite\r\n");
		expect(raw).toContain("Message-ID: <one@example.com>\r\n");
		expect(raw).toContain("MIME-Version: 1.0\r\n");
		expect(raw).toContain("Content-Type: multipart/alternative;");
		expect(raw).toContain("Content-Type: text/plain; charset=utf-8\r\n");
		expect(raw).toContain("Content-Type: text/html; charset=utf-8\r\n");
	});

	test("reports the message's own identifier, since the binding assigns none", async () => {
		let { transport } = createTransport();

		let result = await transport.send(createMessage({ messageId: "<generated@example.com>" }));

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.messageId).toBe("<generated@example.com>");
	});

	test("sends once per envelope recipient, blind copies included, with one assembled body", async () => {
		let { transport, messages } = createTransport();

		await transport.send(
			createMessage({
				to: [{ email: "ada@example.com" }, { email: "grace@example.com" }],
				cc: [{ email: "cc@example.com" }],
				bcc: [{ email: "audit@example.com" }],
			}),
		);

		expect(messages.map((message) => message.to)).toEqual([
			"ada@example.com",
			"grace@example.com",
			"cc@example.com",
			"audit@example.com",
		]);
		expect(new Set(messages.map((message) => message.raw)).size).toBe(1);
		expect(messages[0]?.raw).not.toContain("audit@example.com");
	});

	test("delivers once to an address listed in more than one field", async () => {
		let { transport, messages } = createTransport();

		await transport.send(
			createMessage({ to: [{ email: "ada@example.com" }], cc: [{ email: "ada@example.com" }] }),
		);

		expect(messages).toHaveLength(1);
	});

	test("turns a rejected message into a failure naming the recipient", async () => {
		let { transport } = createTransport("ada@example.com");

		let result = await transport.send(createMessage());

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(MailError);
			expect(result.error.message).toContain("ada@example.com");
			expect(result.error.cause).toBeInstanceOf(Error);
		}
	});

	test("stops at the first rejection instead of continuing down the recipient list", async () => {
		let { transport, messages } = createTransport("grace@example.com");

		let result = await transport.send(
			createMessage({
				to: [
					{ email: "ada@example.com" },
					{ email: "grace@example.com" },
					{ email: "hopper@example.com" },
				],
			}),
		);

		expect(isFailure(result)).toBe(true);
		expect(messages.map((message) => message.to)).toEqual(["ada@example.com"]);
	});

	test("fails a message with no recipient at all instead of calling the binding", async () => {
		let { transport, messages } = createTransport();

		let result = await transport.send(createMessage({ to: [] }));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MailError);
		expect(messages).toHaveLength(0);
	});
});
