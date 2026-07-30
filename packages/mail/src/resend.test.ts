/**
 * Tests the provider transport against an injected fake client, so the mapping from
 * a normalized message onto the provider's structured payload is asserted directly:
 * formatted addresses, omitted empty fields, and both failure shapes the SDK has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { CreateEmailOptions, CreateEmailResponse, Resend } from "resend";

import { isFailure, isSuccess } from "@pkg/result";

import { ResendTransport } from "./resend";

import type { NormalizedMessage } from "./index";

import { MailError } from "./index";

/** Sender identity, with a display name so formatting is observable in the payload. */
const SENDER = { email: "no-reply@example.com", name: "Example" };

/** Builds a normalized message, which is the only shape a transport ever receives. */
function createMessage(overrides?: Partial<NormalizedMessage>): NormalizedMessage {
	return {
		from: SENDER,
		to: [{ email: "a@example.com", name: "Ada" }],
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
 * Builds a fake client that records the payload it was given. `respond` decides what
 * the SDK reports back, including the throw an unreachable provider produces.
 */
function createClient(respond: () => CreateEmailResponse) {
	let payloads: CreateEmailOptions[] = [];

	let client = {
		emails: {
			send: async (payload: CreateEmailOptions) => {
				payloads.push(payload);
				return respond();
			},
		},
	} as unknown as Resend;

	return { client, payloads };
}

/** A client that accepts every message and assigns it a provider identifier. */
function createAcceptingClient(id = "provider-id") {
	return createClient(() => ({ data: { id }, error: null, headers: null }));
}

describe("ResendTransport", () => {
	test("maps every field of a normalized message onto the provider payload", async () => {
		let { client, payloads } = createAcceptingClient();

		await new ResendTransport(client).send(
			createMessage({
				cc: [{ email: "b@example.com" }],
				bcc: [{ email: "c@example.com" }],
				replyTo: [{ email: "hello@example.com" }],
			}),
		);

		expect(payloads).toHaveLength(1);
		expect(payloads[0]).toEqual({
			from: "Example <no-reply@example.com>",
			to: ["Ada <a@example.com>"],
			cc: ["b@example.com"],
			bcc: ["c@example.com"],
			replyTo: ["hello@example.com"],
			subject: "Hi",
			html: "<p>Hi</p>",
			text: "Hi",
			headers: { "X-App": "example" },
		});
	});

	test("omits the copy and reply-to fields when the message has none", async () => {
		let { client, payloads } = createAcceptingClient();

		await new ResendTransport(client).send(createMessage());

		expect(payloads[0]?.cc).toBeUndefined();
		expect(payloads[0]?.bcc).toBeUndefined();
		expect(payloads[0]?.replyTo).toBeUndefined();
	});

	test("sends a text-only message without an HTML part", async () => {
		let { client, payloads } = createAcceptingClient();

		await new ResendTransport(client).send(createMessage({ html: undefined }));

		expect(payloads[0]?.html).toBeUndefined();
		expect(payloads[0]?.text).toBe("Hi");
	});

	test("reports the identifier the provider assigned", async () => {
		let { client } = createAcceptingClient("re_123");

		let result = await new ResendTransport(client).send(createMessage());

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.messageId).toBe("re_123");
	});

	test("falls back to the message's own identifier when the provider returns none", async () => {
		let { client } = createClient(() => ({ data: null, error: null, headers: null }) as never);

		let result = await new ResendTransport(client).send(createMessage());

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.messageId).toBe("<one@example.com>");
	});

	test("turns a rejection reported in the response into a failure", async () => {
		let { client } = createClient(() => ({
			data: null,
			error: { message: "Domain is not verified", name: "validation_error", statusCode: 403 },
			headers: null,
		}));

		let result = await new ResendTransport(client).send(createMessage());

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(MailError);
			expect(result.error.message).toBe("Domain is not verified");
		}
	});

	test("turns a client that throws into a failure instead of an exception", async () => {
		let { client } = createClient(() => {
			throw new Error("fetch failed");
		});

		let result = await new ResendTransport(client).send(createMessage());

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(MailError);
			expect(result.error.cause).toBeInstanceOf(Error);
		}
	});
});
