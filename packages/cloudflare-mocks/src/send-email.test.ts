/**
 * Tests for the send-email mock: both send shapes normalize into one record, recipients
 * flatten to plain addresses, and messages missing a sender, a recipient, or a verified
 * destination are rejected.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createSendEmail } from "./send-email.js";

describe("createSendEmail", () => {
	test("records a message built from fields", async () => {
		let mailer = createSendEmail();

		let result = await mailer.send({
			from: "noreply@example.com",
			to: "user@example.com",
			subject: "Welcome",
			text: "Hello",
		});

		expect(result.messageId).toBeTypeOf("string");
		expect(mailer.messages).toHaveLength(1);
		expect(mailer.messages[0]?.from).toBe("noreply@example.com");
		expect(mailer.messages[0]?.to).toEqual(["user@example.com"]);
		expect(mailer.messages[0]?.subject).toBe("Welcome");
		expect(mailer.messages[0]?.text).toBe("Hello");
	});

	test("flattens named addresses and recipient lists", async () => {
		let mailer = createSendEmail();

		await mailer.send({
			from: { name: "App", email: "noreply@example.com" },
			to: ["a@example.com", { name: "B", email: "b@example.com" }],
			cc: "c@example.com",
			bcc: ["d@example.com"],
			subject: "Hi",
		});

		expect(mailer.messages[0]?.from).toBe("noreply@example.com");
		expect(mailer.messages[0]?.to).toEqual(["a@example.com", "b@example.com"]);
		expect(mailer.messages[0]?.cc).toEqual(["c@example.com"]);
		expect(mailer.messages[0]?.bcc).toEqual(["d@example.com"]);
	});

	test("records reply-to, headers, html, and attachments", async () => {
		let mailer = createSendEmail();

		await mailer.send({
			from: "noreply@example.com",
			to: "user@example.com",
			subject: "Hi",
			replyTo: { name: "Support", email: "support@example.com" },
			headers: { "X-Trace": "abc" },
			html: "<p>Hi</p>",
			attachments: [
				{ disposition: "attachment", filename: "a.txt", type: "text/plain", content: "a" },
			],
		});

		expect(mailer.messages[0]?.replyTo).toBe("support@example.com");
		expect(mailer.messages[0]?.headers).toEqual({ "X-Trace": "abc" });
		expect(mailer.messages[0]?.html).toBe("<p>Hi</p>");
		expect(mailer.messages[0]?.attachments).toHaveLength(1);
	});

	test("records a raw MIME message, draining its body", async () => {
		let mailer = createSendEmail();

		await mailer.send({
			from: "noreply@example.com",
			to: "user@example.com",
			raw: "Subject: Raw\r\n\r\nBody",
		} as EmailMessage);

		expect(mailer.messages[0]?.raw).toBe("Subject: Raw\r\n\r\nBody");
		expect(mailer.messages[0]?.subject).toBeUndefined();
	});

	test("rejects a message with no recipient", async () => {
		let mailer = createSendEmail();

		await expect(
			mailer.send({ from: "noreply@example.com", to: [], subject: "Hi" }),
		).rejects.toThrow(/at least one recipient/);
	});

	test("rejects a message with no sender", async () => {
		let mailer = createSendEmail();

		await expect(mailer.send({ from: "", to: "user@example.com", subject: "Hi" })).rejects.toThrow(
			/sender address/,
		);
	});

	test("rejects an unverified destination when an allowlist is configured", async () => {
		let mailer = createSendEmail({ verifiedDestinations: ["allowed@example.com"] });

		await expect(
			mailer.send({ from: "noreply@example.com", to: "blocked@example.com", subject: "Hi" }),
		).rejects.toThrow(/not verified/);

		expect(mailer.messages).toHaveLength(0);
	});

	test("accepts a verified destination", async () => {
		let mailer = createSendEmail({ verifiedDestinations: ["allowed@example.com"] });

		await mailer.send({ from: "noreply@example.com", to: "allowed@example.com", subject: "Hi" });

		expect(mailer.messages).toHaveLength(1);
	});

	test("gives every binding its own isolated outbox", async () => {
		let first = createSendEmail();
		let second = createSendEmail();

		await first.send({ from: "a@example.com", to: "b@example.com", subject: "Hi" });

		expect(second.messages).toHaveLength(0);
	});
	test("clears its outbox on reset", async () => {
		let mailer = createSendEmail();
		await mailer.send({ from: "a@example.com", to: "b@example.com", subject: "Hi" });

		mailer.reset();

		expect(mailer.messages).toHaveLength(0);
	});
});
