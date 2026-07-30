/**
 * Tests the mailer through the in-memory transport rather than a mocked SDK: what
 * normalization fills in, how the plain-text part is derived, that a failed send is
 * a value instead of an exception, and that an email object is discriminated from a
 * plain message and recorded on the delivery.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Result } from "@pkg/result";
import type { Handle } from "remix/ui";

import { isFailure, isSuccess } from "@pkg/result";

import { MemoryTransport } from "./memory";

import type { Email, NormalizedMessage, SentMessage, Transport } from "./index";

import { MailError, Mailer, isEmail } from "./index";

/** Sender identity every test mailer is configured with. */
const SENDER = { email: "no-reply@example.com", name: "Example" };

/** Reply-to identity used to check that configuration reaches the message. */
const REPLY_TO = { email: "hello@example.com" };

namespace InviteBody {
	export interface Props {
		team: string;
		url: string;
	}
}

/** Body of the email class used to exercise the `Email` path. */
function InviteBody(handle: Handle<InviteBody.Props>) {
	return () => {
		let { team, url } = handle.props;

		return (
			<div>
				<p>You have been invited to join {team}.</p>
				<p>
					<a href={url}>Accept invite</a>
				</p>
			</div>
		);
	};
}

/** Email class standing in for a real app's email, addressed from its own data. */
class TeamInviteEmail implements Email {
	constructor(private invite: { team: string; email: string; url: string }) {}

	/** Recipient derived from the invite, so the address cannot disagree with the copy. */
	get to() {
		return { email: this.invite.email };
	}

	/** Subject, already translated by the time it reaches the mailer. */
	get subject() {
		return `You have been invited to join ${this.invite.team}`;
	}

	/** Body tree rendered by the mailer into both parts. */
	body() {
		return <InviteBody team={this.invite.team} url={this.invite.url} />;
	}
}

/** Email class used to prove that assertions by type distinguish two similar emails. */
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

	/** Body tree rendered by the mailer into both parts. */
	body() {
		return <InviteBody team="Acme" url="https://example.com/start" />;
	}
}

/** Transport that throws instead of returning a failure, which callers must not see. */
class ThrowingTransport implements Transport {
	/** Always throws, standing in for a provider client that rejects unexpectedly. */
	async send(): Promise<Result<SentMessage, MailError>> {
		throw new Error("socket closed");
	}
}

/** Builds a mailer over a fresh in-memory transport, returning both for assertions. */
function createMailer(options?: { replyTo?: typeof REPLY_TO; headers?: Record<string, string> }) {
	let transport = new MemoryTransport();
	let mailer = new Mailer({ transport, from: SENDER, ...options });
	return { mailer, transport };
}

/** Reads the message a test just sent, failing loudly when nothing was recorded. */
function lastMessage(transport: MemoryTransport): NormalizedMessage {
	let message = transport.last;
	if (!message) throw new Error("expected a message to have been recorded");
	return message;
}

describe("isEmail", () => {
	test("treats a callable body as the discriminator", () => {
		expect(isEmail(new TeamInviteEmail({ team: "Acme", email: "a@example.com", url: "u" }))).toBe(
			true,
		);
		expect(isEmail({ to: { email: "a@example.com" }, subject: "Hi", text: "Hi" })).toBe(false);
	});
});

describe("Mailer normalization", () => {
	test("applies the configured sender and reply-to when the message omits them", async () => {
		let { mailer, transport } = createMailer({ replyTo: REPLY_TO });

		await mailer.send({ to: { email: "a@example.com" }, subject: "Hi", text: "Hi" });

		let message = lastMessage(transport);
		expect(message.from).toEqual(SENDER);
		expect(message.replyTo).toEqual([REPLY_TO]);
	});

	test("lets a message override the configured sender and reply-to", async () => {
		let { mailer, transport } = createMailer({ replyTo: REPLY_TO });

		await mailer.send({
			from: { email: "alerts@example.com" },
			replyTo: { email: "support@example.com" },
			to: { email: "a@example.com" },
			subject: "Hi",
			text: "Hi",
		});

		let message = lastMessage(transport);
		expect(message.from).toEqual({ email: "alerts@example.com" });
		expect(message.replyTo).toEqual([{ email: "support@example.com" }]);
	});

	test("coerces every address field to a list, using an empty list for absent ones", async () => {
		let { mailer, transport } = createMailer();

		await mailer.send({
			to: { email: "a@example.com" },
			cc: [{ email: "b@example.com" }, { email: "c@example.com" }],
			subject: "Hi",
			text: "Hi",
		});

		let message = lastMessage(transport);
		expect(message.to).toEqual([{ email: "a@example.com" }]);
		expect(message.cc).toHaveLength(2);
		expect(message.bcc).toEqual([]);
		expect(message.replyTo).toEqual([]);
	});

	test("generates a date and a Message-ID inside the sender's domain", async () => {
		let { mailer, transport } = createMailer();

		await mailer.send({ to: { email: "a@example.com" }, subject: "Hi", text: "Hi" });

		let message = lastMessage(transport);
		expect(message.date).toBeInstanceOf(Date);
		expect(message.messageId).toEndWith("@example.com>");
	});

	test("keeps an explicit date and Message-ID so a test can stay deterministic", async () => {
		let { mailer, transport } = createMailer();
		let date = new Date("2026-01-01T00:00:00.000Z");

		await mailer.send({
			to: { email: "a@example.com" },
			subject: "Hi",
			text: "Hi",
			date,
			messageId: "<fixed@example.com>",
		});

		let message = lastMessage(transport);
		expect(message.date).toEqual(date);
		expect(message.messageId).toBe("<fixed@example.com>");
	});

	test("merges configured headers under per-message ones", async () => {
		let { mailer, transport } = createMailer({ headers: { "X-App": "example", "X-Env": "test" } });

		await mailer.send({
			to: { email: "a@example.com" },
			subject: "Hi",
			text: "Hi",
			headers: { "X-Env": "production" },
		});

		expect(lastMessage(transport).headers).toEqual({ "X-App": "example", "X-Env": "production" });
	});

	test("derives the plain-text part from an HTML-only message", async () => {
		let { mailer, transport } = createMailer();

		await mailer.send({
			to: { email: "a@example.com" },
			subject: "Hi",
			html: '<p>Open <a href="https://example.com/x">the invite</a></p>',
		});

		expect(lastMessage(transport).text).toBe("Open the invite (https://example.com/x)");
	});

	test("keeps an explicit plain-text part instead of deriving one", async () => {
		let { mailer, transport } = createMailer();

		await mailer.send({
			to: { email: "a@example.com" },
			subject: "Hi",
			html: "<p>Rich copy</p>",
			text: "Hand-written copy",
		});

		expect(lastMessage(transport).text).toBe("Hand-written copy");
	});

	test("leaves a text-only message without an HTML part", async () => {
		let { mailer, transport } = createMailer();

		await mailer.send({ to: { email: "a@example.com" }, subject: "Hi", text: "Plain copy" });

		let message = lastMessage(transport);
		expect(message.html).toBeUndefined();
		expect(message.text).toBe("Plain copy");
	});
});

describe("Mailer validation", () => {
	test("fails when a message has no recipient", async () => {
		let { mailer, transport } = createMailer();

		let result = await mailer.send({ to: [], subject: "Hi", text: "Hi" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MailError);
		expect(transport.messages).toHaveLength(0);
	});

	test("fails when an address cannot be routed", async () => {
		let { mailer, transport } = createMailer();

		let result = await mailer.send({ to: { email: "not-an-address" }, subject: "Hi", text: "Hi" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("not-an-address");
		expect(transport.messages).toHaveLength(0);
	});

	test("fails when a message has no body at all", async () => {
		let { mailer, transport } = createMailer();

		let result = await mailer.send({ to: { email: "a@example.com" }, subject: "Hi" });

		expect(isFailure(result)).toBe(true);
		expect(transport.messages).toHaveLength(0);
	});
});

describe("Mailer.send", () => {
	test("reports the identifier the transport returned", async () => {
		let { mailer } = createMailer();

		let result = await mailer.send({
			to: { email: "a@example.com" },
			subject: "Hi",
			text: "Hi",
			messageId: "<fixed@example.com>",
		});

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.messageId).toBe("<fixed@example.com>");
	});

	test("turns a transport that throws into a failure instead of an exception", async () => {
		let mailer = new Mailer({ transport: new ThrowingTransport(), from: SENDER });

		let result = await mailer.send({ to: { email: "a@example.com" }, subject: "Hi", text: "Hi" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(MailError);
			expect(result.error.cause).toBeInstanceOf(Error);
		}
	});

	test("applies send-time overrides over what the input provided", async () => {
		let { mailer, transport } = createMailer();
		let invite = { team: "Acme", email: "a@example.com", url: "https://example.com/invite/1" };

		await mailer.send(new TeamInviteEmail(invite), { to: { email: "forwarded@example.com" } });

		expect(lastMessage(transport).to).toEqual([{ email: "forwarded@example.com" }]);
	});
});

describe("Mailer with an Email", () => {
	test("reads addressing and subject off the email and renders both body parts", async () => {
		let { mailer, transport } = createMailer({ replyTo: REPLY_TO });
		let invite = { team: "Acme", email: "a@example.com", url: "https://example.com/invite/1" };

		await mailer.send(new TeamInviteEmail(invite));

		let message = lastMessage(transport);
		expect(message.to).toEqual([{ email: "a@example.com" }]);
		expect(message.subject).toBe("You have been invited to join Acme");
		expect(message.replyTo).toEqual([REPLY_TO]);
		expect(message.html).toContain("Acme");
		expect(message.text).toContain("https://example.com/invite/1");
	});

	test("records the source email so a send is identified by type, not by copy", async () => {
		let { mailer, transport } = createMailer();
		let invite = { team: "Acme", email: "a@example.com", url: "https://example.com/invite/1" };

		await mailer.send(new WelcomeEmail({ email: "b@example.com" }));
		await mailer.send(new TeamInviteEmail(invite));

		expect(transport.find((message) => message.email instanceof TeamInviteEmail)).toBeDefined();
		expect(transport.find((message) => message.email instanceof WelcomeEmail)).toBeDefined();
	});

	test("leaves a plain message without a source email", async () => {
		let { mailer, transport } = createMailer();

		await mailer.send({ to: { email: "a@example.com" }, subject: "Hi", text: "Hi" });

		expect(lastMessage(transport).email).toBeUndefined();
	});
});

describe("Mailer.later", () => {
	test("sends nothing until the queue is flushed", async () => {
		let { mailer, transport } = createMailer();

		mailer.later({ to: { email: "a@example.com" }, subject: "Hi", text: "Hi" });

		expect(mailer.pending).toBe(1);
		expect(transport.messages).toHaveLength(0);

		await mailer.flush();

		expect(mailer.pending).toBe(0);
		expect(transport.messages).toHaveLength(1);
	});

	test("flushes queued messages in order and reports one result each", async () => {
		let { mailer, transport } = createMailer();

		mailer.later({ to: { email: "a@example.com" }, subject: "First", text: "Hi" });
		mailer.later({ to: { email: "b@example.com" }, subject: "Second", text: "Hi" });

		let results = await mailer.flush();

		expect(results).toHaveLength(2);
		expect(results.every(isSuccess)).toBe(true);
		expect(transport.messages.map((message) => message.subject)).toEqual(["First", "Second"]);
	});

	test("reports a queued failure as a value, leaving the rest delivered", async () => {
		let { mailer, transport } = createMailer();

		mailer.later({ to: [], subject: "Invalid", text: "Hi" });
		mailer.later({ to: { email: "a@example.com" }, subject: "Valid", text: "Hi" });

		let results = await mailer.flush();

		expect(results.filter(isFailure)).toHaveLength(1);
		expect(transport.messages).toHaveLength(1);
	});

	test("accepts an email object just like send does", async () => {
		let { mailer, transport } = createMailer();

		mailer.later(new WelcomeEmail({ email: "a@example.com" }));
		await mailer.flush();

		expect(transport.find((message) => message.email instanceof WelcomeEmail)).toBeDefined();
	});
});
