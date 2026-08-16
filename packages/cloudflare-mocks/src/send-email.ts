/**
 * Recording `SendEmail` binding. It accepts both shapes the platform accepts — a raw MIME
 * `EmailMessage` and the field-based builder — normalizes them into one record, and
 * enforces destination verification so an unverified recipient fails in a test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** One captured outbound email, with recipients flattened to plain addresses. */
export interface SentEmailRecord {
	/** Message id returned to the caller. */
	messageId: string;
	/** Envelope sender address. */
	from: string;
	/** Primary recipients. */
	to: string[];
	/** Carbon-copy recipients. */
	cc: string[];
	/** Blind carbon-copy recipients. */
	bcc: string[];
	/** Subject, absent when the message was sent as raw MIME. */
	subject?: string;
	/** Reply-to address when the builder set one. */
	replyTo?: string;
	/** Extra headers the builder set. */
	headers?: Record<string, string>;
	/** Plain-text body when the builder set one. */
	text?: string;
	/** HTML body when the builder set one. */
	html?: string;
	/** Attachments the builder set. */
	attachments?: EmailAttachment[];
	/** Raw MIME content when the message was sent as a raw `EmailMessage`. */
	raw?: string;
}

/** Options for {@link createSendEmail}. */
export interface SendEmailMockOptions {
	/**
	 * Addresses the account has verified. When set, sending to anything else throws, the
	 * way the platform rejects unverified destinations; when omitted, any address is
	 * accepted.
	 */
	verifiedDestinations?: string[];
}

/** A `SendEmail` binding that records every message instead of delivering it. */
export interface SendEmailMock extends SendEmail {
	/** Messages sent so far, oldest first. */
	readonly messages: SentEmailRecord[];

	/**
	 * Discards every recorded message, as if nothing had been sent.
	 *
	 * A binding installed once at module scope outlives the test that used it, so this is
	 * how a `beforeEach` gets an empty outbox without re-creating the `env` the code under
	 * test already captured.
	 */
	reset(): void;
}

/**
 * Creates a recording email binding.
 *
 * Nothing is delivered: each `send` is normalized into a {@link SentEmailRecord} a test
 * can assert on, which is what makes it usable as the destination for a mail transport.
 * @param options Verified destination allowlist.
 * @returns A `SendEmail` binding that records messages.
 * @example let mailer = createSendEmail(); await mailer.send({ from: "a@b.c", to: "d@e.f", subject: "Hi" });
 */
export function createSendEmail(options?: SendEmailMockOptions): SendEmailMock {
	let messages: SentEmailRecord[] = [];
	let verified = options?.verifiedDestinations;

	/** Rejects recipients outside the verified allowlist, when one is configured. */
	function assertVerified(recipients: string[]): void {
		if (!verified) return;

		for (let recipient of recipients) {
			if (!verified.includes(recipient)) {
				throw new Error(`send_email binding: destination address ${recipient} is not verified`);
			}
		}
	}

	/**
	 * Records one message.
	 * @param message A raw MIME `EmailMessage`, or a builder with subject and bodies.
	 * @returns The generated message id.
	 */
	async function send(message: EmailMessage | EmailMessageBuilder): Promise<EmailSendResult> {
		let record = isBuilder(message) ? fromBuilder(message) : await fromEmailMessage(message);

		if (record.from === "") throw new Error("send_email binding: a sender address is required");

		let recipients = [...record.to, ...record.cc, ...record.bcc];

		if (recipients.length === 0) {
			throw new Error("send_email binding: at least one recipient is required");
		}

		assertVerified(recipients);
		messages.push(record);

		return { messageId: record.messageId };
	}

	return {
		get messages(): SentEmailRecord[] {
			return messages.map((message) => ({ ...message }));
		},

		reset(): void {
			messages.length = 0;
		},

		send,
	};
}

/** Distinguishes the field-based builder from a raw MIME message by its `subject`. */
function isBuilder(message: EmailMessage | EmailMessageBuilder): message is EmailMessageBuilder {
	return "subject" in message;
}

/** Normalizes a builder into a record, flattening every recipient list. */
function fromBuilder(builder: EmailMessageBuilder): SentEmailRecord {
	let record: SentEmailRecord = {
		messageId: createMessageId(),
		from: toAddress(builder.from),
		to: toAddresses(builder.to),
		cc: toAddresses(builder.cc),
		bcc: toAddresses(builder.bcc),
		subject: builder.subject,
	};

	if (builder.replyTo !== undefined) record.replyTo = toAddress(builder.replyTo);
	if (builder.headers !== undefined) record.headers = { ...builder.headers };
	if (builder.text !== undefined) record.text = builder.text;
	if (builder.html !== undefined) record.html = builder.html;
	if (builder.attachments !== undefined) record.attachments = [...builder.attachments];

	return record;
}

/**
 * Normalizes a raw MIME message into a record, draining its `raw` body when present.
 * The declared `EmailMessage` type exposes only the envelope, so the body is read
 * defensively off the concrete object the runtime constructor produces.
 */
async function fromEmailMessage(message: EmailMessage): Promise<SentEmailRecord> {
	let raw = (message as { raw?: unknown }).raw;
	let record: SentEmailRecord = {
		messageId: createMessageId(),
		from: message.from,
		to: message.to === "" ? [] : [message.to],
		cc: [],
		bcc: [],
	};

	if (typeof raw === "string") record.raw = raw;
	else if (raw !== undefined && raw !== null) {
		record.raw = await new Response(raw as BodyInit).text();
	}

	return record;
}

/** Flattens one recipient field into plain addresses. */
function toAddresses(
	value: string | EmailAddress | (string | EmailAddress)[] | undefined,
): string[] {
	if (value === undefined) return [];
	if (Array.isArray(value)) return value.map(toAddress);
	return [toAddress(value)];
}

/** Reduces an address, named or bare, to its email. */
function toAddress(value: string | EmailAddress): string {
	return typeof value === "string" ? value : value.email;
}

/** Generates an opaque message id shaped like the platform's. */
function createMessageId(): string {
	return `${crypto.randomUUID()}@mock.cloudflare-mocks`;
}
