/**
 * The job that delivers queued email: it sends what `ctx.email.queue()` handed the queue, gives
 * up on a delivery no retry can send, and asks for another try when the provider fails.
 */

import type { NormalizedMessage, QueuedEmail, SentMessage, Transport } from "@sdxc/mail";
import type { Result } from "@sdxc/result";

import { createJobContext } from "@sdxc/jobs";
import { NonRetriable, Retry } from "@sdxc/jobs/errors";
import { createEmail, createMail, email, emails, Mailer, MailError } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { CurrentMailer } from "@sdxc/mail/middleware/jobs";
import { failure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import jobs from "~/app/jobs";
import handler from "~/app/jobs/email";
import { MAIL_FROM } from "~/config/constants";

/** An email declared for these tests alone. */
const EMAILS = emails({ greeting: email({ props: s.object({ name: s.string() }) }) });

/** A transport whose provider is down. */
class FailingTransport implements Transport {
	async send(_message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		return failure(new MailError("The provider is down."));
	}
}

/** Runs the job for `input` with a mailer over `transport` that sends the test email. */
async function run(input: QueuedEmail, transport: Transport) {
	let mail = createMail();
	mail.map(
		EMAILS.greeting,
		createEmail(EMAILS.greeting, {
			subject: ({ name }) => `Hello, ${name}`,
			body: (handle) => () => <p>Hello {handle.props.name}</p>,
		}),
	);
	let ctx = createJobContext(jobs.email, { id: "message-1", attempts: 1, input });
	ctx.set(CurrentMailer, new Mailer({ transport, from: MAIL_FROM, mail }), { property: "email" });
	await handler(ctx);
}

describe("email", () => {
	test("sends the queued email", async () => {
		let transport = new MemoryTransport();

		await run({ email: "greeting", to: "ada@example.com", props: { name: "Ada" } }, transport);

		expect(transport.last?.subject).toBe("Hello, Ada");
	});

	test("gives up on an email nothing maps", async () => {
		let sent = run({ email: "missing", to: "ada@example.com", props: {} }, new MemoryTransport());

		await expect(sent).rejects.toBeInstanceOf(NonRetriable);
	});

	test("retries when the provider fails", async () => {
		let sent = run(
			{ email: "greeting", to: "ada@example.com", props: { name: "Ada" } },
			new FailingTransport(),
		);

		await expect(sent).rejects.toBeInstanceOf(Retry);
	});
});
