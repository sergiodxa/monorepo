/**
 * Tests the job that delivers queued email against the app's real registry and templates:
 * a delivery is sent from the server's sender identity, an email nothing maps is given up on,
 * and a provider failure asks the queue for another attempt.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NormalizedMessage, QueuedEmail, SentMessage, Transport } from "@sdxc/mail";
import type { Result } from "@sdxc/result";

import { createJobContext } from "@sdxc/jobs";
import { NonRetriable, Retry } from "@sdxc/jobs/errors";
import { isComposedEmail, Mailer, MailError } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { CurrentMailer } from "@sdxc/mail/middleware/jobs";
import { failure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { mail } from "~/app/initializers/mail";
import jobs from "~/app/jobs";
import handler from "~/app/jobs/email";

/** A transport whose provider is down. */
class FailingTransport implements Transport {
	async send(_message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		return failure(new MailError("The provider is down."));
	}
}

/** A password-reset delivery, as `ctx.email.queue()` hands it to the queue. */
const RESET_DELIVERY: QueuedEmail = {
	email: emails.resetPassword.name,
	to: "jane@example.com",
	props: { url: "https://auth.sergiodxa.com/password/reset?token=abc", minutes: 60 },
};

/** Runs the job for `input` with the server's mailer over `transport`. */
async function run(input: QueuedEmail, transport: Transport) {
	let ctx = createJobContext(jobs.email, { id: "message-1", attempts: 1, input });
	let mailer = new Mailer({ transport, from: MAIL_FROM, replyTo: MAIL_REPLY_TO, mail });
	ctx.set(CurrentMailer, mailer, { property: "email" });
	await handler(ctx);
}

describe("email", () => {
	test("sends the queued email from the server's sender", async () => {
		let transport = new MemoryTransport();

		await run(RESET_DELIVERY, transport);

		let message = transport.last!;
		expect(isComposedEmail(message.email, emails.resetPassword)).toBe(true);
		expect(message.to).toEqual([{ email: "jane@example.com" }]);
		expect(message.from).toEqual(MAIL_FROM);
		expect(message.html).toContain("token=abc");
	});

	test("gives up on an email nothing maps", async () => {
		let sent = run({ email: "missing", to: "jane@example.com", props: {} }, new MemoryTransport());

		await expect(sent).rejects.toBeInstanceOf(NonRetriable);
	});

	test("gives up on props the email's schema refuses", async () => {
		let sent = run({ ...RESET_DELIVERY, props: { url: 42 } }, new MemoryTransport());

		await expect(sent).rejects.toBeInstanceOf(NonRetriable);
	});

	test("retries when the provider fails", async () => {
		let sent = run(RESET_DELIVERY, new FailingTransport());

		await expect(sent).rejects.toBeInstanceOf(Retry);
	});
});
