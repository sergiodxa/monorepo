/**
 * Delivery contracts shared by the mailer and every transport: the message a
 * caller writes, the normalized message a transport receives, the authoring
 * interface an email class implements, and the transport adapter itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { RemixElement } from "remix/ui";

import type { MailError } from "./errors";

/** A single mailbox, optionally with the display name clients show instead of it. */
export interface Address {
	/** Addr-spec of the mailbox, e.g. `no-reply@example.com`. */
	email: string;
	/** Display name shown by mail clients in place of the bare address. */
	name?: string;
}

/**
 * A message as callers write it. Everything the mailer can supply a default for
 * is optional, so a caller only states what is specific to this message.
 */
export interface Message {
	/** Sender mailbox; omitted means the mailer's configured sender. */
	from?: Address;
	/** Primary recipients; at least one is required. */
	to: Address | Address[];
	/** Carbon-copy recipients. */
	cc?: Address | Address[];
	/** Blind carbon-copy recipients, kept hidden from the other recipients. */
	bcc?: Address | Address[];
	/** Where replies go; omitted means the mailer's configured reply-to. */
	replyTo?: Address | Address[];
	/** Subject line, already in the recipient's language. */
	subject: string;
	/** HTML body; when it is the only body part the mailer derives the text one. */
	html?: string;
	/** Plain-text body; supply it to override the mailer's derived version. */
	text?: string;
	/** Extra headers merged over the mailer's configured headers. */
	headers?: Record<string, string>;
	/** Explicit `Date` header value; omitted means "now". Set it to keep tests deterministic. */
	date?: Date;
	/** Explicit `Message-ID` value; omitted means generated. Set it to keep tests deterministic. */
	messageId?: string;
}

/**
 * A message after normalization: defaults applied, every address list coerced to
 * an array, and a plain-text part derived when only HTML was authored. Transports
 * receive this shape fully resolved, with defaults applied and validation done.
 */
export interface NormalizedMessage {
	/** Sender mailbox, resolved from the message or the mailer configuration. */
	from: Address;
	/** Primary recipients, guaranteed to hold at least one address. */
	to: Address[];
	/** Carbon-copy recipients; empty when none were given. */
	cc: Address[];
	/** Blind carbon-copy recipients; empty when none were given. */
	bcc: Address[];
	/** Reply-to mailboxes; empty when neither the message nor the mailer set one. */
	replyTo: Address[];
	/** Subject line, already in the recipient's language. */
	subject: string;
	/** HTML body; at least one of `html` and `text` is a non-empty string. */
	html?: string;
	/** Plain-text body; derived from `html` unless the caller supplied one. */
	text?: string;
	/** Headers to add, with per-message values winning over configured ones. */
	headers: Record<string, string>;
	/** Value for the `Date` header, defaulted to the moment of normalization. */
	date: Date;
	/** Value for the `Message-ID` header, generated when the caller omitted it. */
	messageId: string;
	/**
	 * The email object this message was produced from, when it came from one.
	 * It exists so tests can identify a sent message by its type.
	 */
	email?: Email;
}

/** Identifier a provider assigns to an accepted message. */
export interface SentMessage {
	/** Provider identifier when it returns one, otherwise the message's `Message-ID`. */
	messageId: string;
}

/**
 * Adapter that puts a normalized message on the wire for one provider. Delivery
 * outcome is a value: a transport reports provider rejections through the
 * returned `Result`.
 */
export interface Transport {
	/**
	 * Delivers an already normalized message.
	 *
	 * @param message - The message to deliver, with defaults applied.
	 * @returns The provider's identifier on success, a `MailError` on rejection.
	 */
	send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>>;
}

/**
 * An email authored as a class: who it goes to, what it says, and what it looks
 * like. Sender identity lives on the mailer, and a subject arrives already
 * translated from the caller's locale handling.
 */
export interface Email {
	/** Recipient this email is addressed to, derived from the data it was constructed with. */
	readonly to: Address | Address[];
	/** Subject line, already translated. */
	readonly subject: string;
	/** Body tree, rendered by the mailer into HTML and plain text. */
	body(): RemixElement;
	/** Per-email reply-to override; the mailer's configuration supplies the default. */
	readonly replyTo?: Address | Address[];
	/** Per-email headers, merged over the mailer's configured headers. */
	readonly headers?: Record<string, string>;
}
