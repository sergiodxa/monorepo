/**
 * Tests the in-memory transport as the recording fake it exists to be: what it
 * exposes for assertions, that clearing lets one instance serve several tests, and
 * that the source email travels with a delivery so a send is identified by type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { RemixElement } from "remix/ui";

import { isSuccess } from "@pkg/result";

import { MemoryTransport } from "./memory";

import type { Email, NormalizedMessage } from "./index";

import { Mailer } from "./index";

/** Sender identity every test mailer is configured with. */
const SENDER = { email: "no-reply@example.com", name: "Example" };

/** Email class used to check that `instanceof` assertions reach a recorded delivery. */
class WelcomeEmail implements Email {
	constructor(private user: { email: string }) {}

	/** Recipient derived from the user record. */
	get to() {
		return { email: this.user.email };
	}

	/** Subject, already translated by the time it reaches the mailer. */
	get subject() {
		return "Welcome";
	}

	/** Body tree; the element is built directly because the copy is a single string. */
	body(): RemixElement {
		return { type: "p", props: { children: "Welcome aboard" }, $rmx: true };
	}
}

/** Builds a normalized message so the transport can be exercised on its own. */
function createMessage(overrides?: Partial<NormalizedMessage>): NormalizedMessage {
	return {
		from: SENDER,
		to: [{ email: "a@example.com" }],
		cc: [],
		bcc: [],
		replyTo: [],
		subject: "Hi",
		text: "Hi",
		headers: {},
		date: new Date("2026-01-01T00:00:00.000Z"),
		messageId: "<one@example.com>",
		...overrides,
	};
}

describe("MemoryTransport", () => {
	test("records deliveries in order and reports the message's own identifier", async () => {
		let transport = new MemoryTransport();

		let result = await transport.send(createMessage({ subject: "First" }));
		await transport.send(createMessage({ subject: "Second", messageId: "<two@example.com>" }));

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.messageId).toBe("<one@example.com>");
		expect(transport.messages.map((message) => message.subject)).toEqual(["First", "Second"]);
	});

	test("exposes the most recent delivery, and nothing before the first one", async () => {
		let transport = new MemoryTransport();

		expect(transport.last).toBeUndefined();

		await transport.send(createMessage({ subject: "First" }));
		await transport.send(createMessage({ subject: "Second" }));

		expect(transport.last?.subject).toBe("Second");
	});

	test("finds the first delivery matching a predicate", async () => {
		let transport = new MemoryTransport();

		await transport.send(createMessage({ to: [{ email: "a@example.com" }] }));
		await transport.send(createMessage({ to: [{ email: "b@example.com" }] }));

		let found = transport.find((message) => message.to[0]?.email === "b@example.com");

		expect(found?.to[0]?.email).toBe("b@example.com");
		expect(transport.find((message) => message.subject === "Missing")).toBeUndefined();
	});

	test("forgets every delivery when cleared, so one instance serves several tests", async () => {
		let transport = new MemoryTransport();

		await transport.send(createMessage());
		transport.clear();

		expect(transport.messages).toHaveLength(0);
		expect(transport.last).toBeUndefined();
	});

	test("records the source email, so an assertion survives a copy change", async () => {
		let transport = new MemoryTransport();
		let mailer = new Mailer({ transport, from: SENDER });

		await mailer.send(new WelcomeEmail({ email: "a@example.com" }));

		expect(transport.find((message) => message.email instanceof WelcomeEmail)).toBeDefined();
		expect(transport.last?.email).toBeInstanceOf(WelcomeEmail);
	});

	test("leaves a plain message without a source email, so a type assertion stays honest", async () => {
		let transport = new MemoryTransport();
		let mailer = new Mailer({ transport, from: SENDER });

		await mailer.send(new WelcomeEmail({ email: "a@example.com" }));
		await mailer.send({ to: { email: "b@example.com" }, subject: "Hi", text: "Hi" });

		expect(transport.messages).toHaveLength(2);
		expect(transport.last?.email).toBeUndefined();
	});

	test("assembles no MIME unless it was asked to, since most tests never read it", async () => {
		let transport = new MemoryTransport();

		await transport.send(createMessage());

		expect(transport.lastMime).toBeUndefined();
		expect(transport.deliveries[0]?.mime).toBeUndefined();
		expect(transport.deliveries[0]?.message.subject).toBe("Hi");
	});

	test("records the assembled MIME message when MIME recording is on", async () => {
		let transport = new MemoryTransport({ mime: true });

		await transport.send(createMessage({ text: "Hi", html: "<p>Hi</p>" }));

		expect(transport.lastMime).toContain("Content-Type: multipart/alternative;");
		expect(transport.lastMime).toContain("Message-ID: <one@example.com>\r\n");
		expect(transport.lastMime).toContain("Content-Type: text/html; charset=utf-8\r\n");
		expect(transport.deliveries[0]?.mime).toBe(transport.lastMime);
	});

	test("keeps one MIME message per delivery, so a regression is traced to its send", async () => {
		let transport = new MemoryTransport({ mime: true });

		await transport.send(createMessage({ subject: "First" }));
		await transport.send(createMessage({ subject: "Second" }));

		expect(transport.deliveries[0]?.mime).toContain("Subject: First\r\n");
		expect(transport.deliveries[1]?.mime).toContain("Subject: Second\r\n");
		expect(transport.lastMime).toContain("Subject: Second\r\n");
	});

	test("forgets recorded MIME along with the deliveries it belonged to", async () => {
		let transport = new MemoryTransport({ mime: true });

		await transport.send(createMessage());
		transport.clear();

		expect(transport.deliveries).toHaveLength(0);
		expect(transport.lastMime).toBeUndefined();
	});
});
