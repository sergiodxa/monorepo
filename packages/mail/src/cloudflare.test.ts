/**
 * Tests the binding transport against a double standing in for the platform, so the
 * mapping from a normalized message onto the binding's send payload is asserted
 * directly: formatted addresses, omitted empty fields, the identifier the platform
 * assigns, and a refusal reported as a failure rather than thrown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SendEmailMessage, SendEmailResult } from "./cloudflare";
import type { NormalizedMessage } from "./types";

import { CloudflareTransport } from "./cloudflare";
import { MailError } from "./errors";

/** Sender identity, with a display name so formatting is observable in the payload. */
const SENDER = { email: "no-reply@example.com", name: "Example" };

/** Builds a normalized message, which is the only shape a transport ever receives. */
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
		headers: { "X-App": "example" },
		date: new Date("2026-01-01T00:00:00.000Z"),
		messageId: "<one@example.com>",
		...overrides,
	};
}

/**
 * Builds a binding double that records every payload. `respond` decides what the
 * platform reports back, including the throw a refused message produces.
 */
function createBinding(respond: () => SendEmailResult) {
	let payloads: SendEmailMessage[] = [];

	let binding = {
		async send(message: SendEmailMessage): Promise<SendEmailResult> {
			payloads.push(message);
			return respond();
		},
	};

	return { binding, payloads };
}

/** A binding that accepts every message and assigns it an identifier. */
function createAcceptingBinding(messageId = "platform-id") {
	return createBinding(() => ({ messageId }));
}

describe("CloudflareTransport", () => {
	test("maps every field of a normalized message onto the binding payload", async () => {
		let { binding, payloads } = createAcceptingBinding();

		await new CloudflareTransport(binding).send(
			createMessage({
				cc: [{ email: "cc@example.com" }],
				bcc: [{ email: "audit@example.com" }],
				replyTo: [{ email: "hello@example.com" }],
			}),
		);

		expect(payloads).toHaveLength(1);
		expect(payloads[0]).toEqual({
			from: "Example <no-reply@example.com>",
			to: ["Ada <ada@example.com>"],
			cc: ["cc@example.com"],
			bcc: ["audit@example.com"],
			replyTo: "hello@example.com",
			subject: "Hi",
			html: "<p>Hi</p>",
			text: "Hi",
			headers: { "X-App": "example" },
		});
	});

	test("sends one message for every recipient at once instead of one per address", async () => {
		let { binding, payloads } = createAcceptingBinding();

		await new CloudflareTransport(binding).send(
			createMessage({
				to: [{ email: "ada@example.com" }, { email: "grace@example.com" }],
				bcc: [{ email: "audit@example.com" }],
			}),
		);

		expect(payloads).toHaveLength(1);
		expect(payloads[0]?.to).toEqual(["ada@example.com", "grace@example.com"]);
	});

	test("omits the copy and reply-to fields when the message has none", async () => {
		let { binding, payloads } = createAcceptingBinding();

		await new CloudflareTransport(binding).send(createMessage());

		expect(payloads[0]?.cc).toBeUndefined();
		expect(payloads[0]?.bcc).toBeUndefined();
		expect(payloads[0]?.replyTo).toBeUndefined();
	});

	test("keeps only the first reply-to, since the platform's field holds one mailbox", async () => {
		let { binding, payloads } = createAcceptingBinding();

		await new CloudflareTransport(binding).send(
			createMessage({
				replyTo: [{ email: "hello@example.com", name: "Support" }, { email: "second@example.com" }],
			}),
		);

		expect(payloads[0]?.replyTo).toBe("Support <hello@example.com>");
	});

	test("sends a text-only message without an HTML part", async () => {
		let { binding, payloads } = createAcceptingBinding();

		await new CloudflareTransport(binding).send(createMessage({ html: undefined }));

		expect(payloads[0]?.html).toBeUndefined();
		expect(payloads[0]?.text).toBe("Hi");
	});

	test("reports the identifier the platform assigned, not the message's own", async () => {
		let { binding } = createAcceptingBinding("cf-123");

		let result = await new CloudflareTransport(binding).send(createMessage());

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.messageId).toBe("cf-123");
	});

	test("turns a refused message into a failure instead of an exception", async () => {
		let { binding } = createBinding(() => {
			throw new Error('Destination "ada@example.com" not verified');
		});

		let result = await new CloudflareTransport(binding).send(createMessage());

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(MailError);
			expect(result.error.cause).toBeInstanceOf(Error);
		}
	});
});
