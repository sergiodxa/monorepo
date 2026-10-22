/**
 * Tests the print transport as a developer reads it: the summary lists the envelope and the
 * plain-text body, optional headers appear only when set, MIME mode prints the wire form, and
 * every send reports the message's own id so callers proceed as if it was delivered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { PrintTransport } from "./print.js";

import { Mailer } from "./index.js";

/** Sender identity every test mailer is configured with. */
const SENDER = { email: "no-reply@example.com", name: "Example" };

/** A fixed date and id, so the printed summary compares exactly. */
const FIXED = { date: new Date("2026-10-15T12:00:00Z"), messageId: "<fixed@example.com>" };

/** A mailer whose transport collects everything it prints. */
function printing(mime = false) {
	let printed: string[] = [];
	let transport = new PrintTransport({ write: (text) => printed.push(text), mime });
	return { printed, mailer: new Mailer({ transport, from: SENDER }) };
}

describe("PrintTransport", () => {
	test("prints the envelope, subject and text body", async () => {
		let { printed, mailer } = printing();

		let sent = await mailer.send({
			to: { email: "ada@example.com", name: "Ada" },
			subject: "Your invitation",
			text: "Join the team.",
			...FIXED,
		});

		expect(isSuccess(sent) && sent.data.messageId).toBe("<fixed@example.com>");
		expect(printed).toEqual([
			[
				"From: Example <no-reply@example.com>",
				"To: Ada <ada@example.com>",
				"Subject: Your invitation",
				"Date: Thu, 15 Oct 2026 12:00:00 GMT",
				"Message-ID: <fixed@example.com>",
				"",
				"Join the team.",
				"",
			].join("\n"),
		]);
	});

	test("lists cc, bcc, reply-to and extra headers only when set", async () => {
		let { printed, mailer } = printing();

		await mailer.send({
			to: [{ email: "ada@example.com" }, { email: "grace@example.com" }],
			cc: { email: "team@example.com" },
			bcc: { email: "audit@example.com" },
			replyTo: { email: "support@example.com", name: "Support" },
			headers: { "X-Campaign": "launch" },
			subject: "Launch",
			text: "We are live.",
			...FIXED,
		});

		let lines = printed[0]?.split("\n") ?? [];
		expect(lines).toContain("To: ada@example.com, grace@example.com");
		expect(lines).toContain("Cc: team@example.com");
		expect(lines).toContain("Bcc: audit@example.com");
		expect(lines).toContain("Reply-To: Support <support@example.com>");
		expect(lines).toContain("X-Campaign: launch");
	});

	test("prints the text the mailer derived from an HTML body", async () => {
		let { printed, mailer } = printing();

		await mailer.send({
			to: { email: "ada@example.com" },
			subject: "Hi",
			html: "<p>Hello <strong>Ada</strong></p>",
			...FIXED,
		});

		expect(printed[0]).toContain("Hello");
		expect(printed[0]).not.toContain("<p>");
	});

	test("prints the raw MIME message in MIME mode", async () => {
		let { printed, mailer } = printing(true);

		await mailer.send({ to: { email: "ada@example.com" }, subject: "Hi", text: "Hello", ...FIXED });

		expect(printed[0]).toContain("Message-ID: <fixed@example.com>");
		expect(printed[0]).toContain("Content-Type: text/plain");
		expect(printed[0]?.endsWith("\n")).toBe(true);
	});
});
