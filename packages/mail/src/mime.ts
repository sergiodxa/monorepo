/**
 * Assembles a normalized message into the raw RFC 5322 message a transport whose
 * provider takes MIME has to hand over: folded headers, encoded words for
 * non-ASCII text, a `multipart/alternative` body when both parts exist, and CRLF
 * line endings throughout. It lives at the package root so any raw-MIME transport
 * can reuse it and so its tests need no runtime-specific import.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address, NormalizedMessage } from "./types";

import { formatAddress } from "./lib/address";

/** Line ending every part of a MIME message uses, regardless of the host platform. */
const CRLF = "\r\n";

/** Length a header line should not exceed before it is folded, per RFC 5322. */
const MAX_HEADER_LINE_LENGTH = 78;

/** Length an encoded body line may reach, counting the soft break a wrap adds. */
const MAX_ENCODED_LINE_LENGTH = 76;

/** Opening of a base64 encoded word; UTF-8 because that is what the bodies are. */
const ENCODED_WORD_PREFIX = "=?UTF-8?B?";

/** Closing of an encoded word. */
const ENCODED_WORD_SUFFIX = "?=";

/** Longest an encoded word may be, delimiters included, per RFC 2047. */
const MAX_ENCODED_WORD_LENGTH = 75;

/** Characters an encoded word spends on its own delimiters rather than on content. */
const ENCODED_WORD_OVERHEAD = ENCODED_WORD_PREFIX.length + ENCODED_WORD_SUFFIX.length;

/** Smallest chunk a word may carry, so an unusually cramped line still makes progress. */
const MIN_ENCODED_WORD_BYTES = 6;

/** Printable ASCII, the only range a header value may hold without encoding. */
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

/** Any of the three line endings a caller's body might arrive with. */
const NEWLINE = /\r\n|\r|\n/g;

/**
 * Share of bytes that may need escaping before base64 becomes the cheaper
 * encoding. Quoted-printable spends 3 characters per escaped byte and 1 per
 * literal one, base64 spends 4 for every 3 bytes, so the two break even at one
 * escaped byte in six.
 */
const QUOTED_PRINTABLE_ESCAPE_BUDGET = 1 / 6;

/** Token a generated boundary is built on, using only characters RFC 2046 allows. */
const BOUNDARY_PREFIX = "=_Part_";

/** Day names in `Date#getUTCDay()` order; the header requires the English abbreviations. */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Month names in `Date#getUTCMonth()` order, for the same reason as the day names. */
const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

/**
 * Headers this builder derives from the message itself. A custom header repeating
 * one of these names is dropped rather than emitted twice, because a duplicate
 * `From` or `Content-Type` is what makes a message get filed as spam.
 */
const RESERVED_HEADERS: ReadonlySet<string> = new Set([
	"bcc",
	"cc",
	"content-transfer-encoding",
	"content-type",
	"date",
	"from",
	"message-id",
	"mime-version",
	"reply-to",
	"subject",
	"to",
]);

/** Byte value of the horizontal tab, which may travel literally except at the end of a line. */
const TAB = 9;

/** Byte value of the line feed, which is message structure rather than part content. */
const LINE_FEED = 10;

/** Byte value of the carriage return, paired with the line feed in every break. */
const CARRIAGE_RETURN = 13;

/** Byte value of the space character, under the same end-of-line rule as the tab. */
const SPACE = 32;

/** Byte value of `-`, escaped at the start of a line so no body line can look like a boundary. */
const HYPHEN = 45;

/** Byte value of `=`, which quoted-printable always escapes because it is the escape character. */
const EQUALS = 61;

/** Highest byte quoted-printable may pass through literally. */
const LAST_PRINTABLE = 126;

/** One part of the message: its type, the encoding its body is in, and that body. */
interface EncodedPart {
	/** Media type of the part, such as `text/plain`. */
	contentType: string;
	/** Value for the part's `Content-Transfer-Encoding` header. */
	encoding: string;
	/** The encoded body, already wrapped to the line limit with CRLF breaks. */
	body: string;
}

/** Pads a number to the two digits the date header's fields are written with. */
function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/**
 * Formats a date as an RFC 5322 `date-time`, always in UTC. The numeric `+0000`
 * zone is used rather than the obsolete `GMT` spelling, which some filters treat
 * as a sign of a hand-rolled sender.
 */
function formatDate(date: Date): string {
	let day = DAY_NAMES[date.getUTCDay()] ?? DAY_NAMES[0];
	let month = MONTH_NAMES[date.getUTCMonth()] ?? MONTH_NAMES[0];
	let time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
	return `${day}, ${pad(date.getUTCDate())} ${month} ${date.getUTCFullYear()} ${time} +0000`;
}

/** Base64-encodes bytes without wrapping, which the callers below apply themselves. */
function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/** Wraps a chunk of bytes in the encoded-word delimiters RFC 2047 defines. */
function toEncodedWord(bytes: number[]): string {
	return `${ENCODED_WORD_PREFIX}${toBase64(Uint8Array.from(bytes))}${ENCODED_WORD_SUFFIX}`;
}

/**
 * Bytes one encoded word may carry on a line that already holds `reserved`
 * characters. An encoded word cannot be folded, so its size — not the folder — is
 * what keeps a header line short: base64 turns 3 bytes into 4 characters, and the
 * result is the largest multiple of 3 that fits under whichever limit is tighter.
 */
function encodedWordBytes(reserved: number): number {
	let available = Math.min(MAX_ENCODED_WORD_LENGTH, MAX_HEADER_LINE_LENGTH - reserved);
	return Math.max(MIN_ENCODED_WORD_BYTES, Math.floor((available - ENCODED_WORD_OVERHEAD) / 4) * 3);
}

/**
 * Encodes a header value as one or more RFC 2047 encoded words.
 *
 * Chunking happens on character boundaries, never inside a multi-byte sequence,
 * because each word is decoded on its own and a split character would decode to
 * replacement bytes. Whitespace between adjacent words is dropped by decoders, so
 * the original spaces travel inside the base64 rather than between the words.
 *
 * @param value - The text to encode.
 * @param reserved - Characters the words must share their line with, such as `Subject: `.
 */
function encodeWords(value: string, reserved: number): string {
	let encoder = new TextEncoder();
	let limit = encodedWordBytes(reserved);
	let words: string[] = [];
	let chunk: number[] = [];

	for (let character of value) {
		let bytes = encoder.encode(character);
		if (chunk.length > 0 && chunk.length + bytes.length > limit) {
			words.push(toEncodedWord(chunk));
			chunk = [];
		}
		for (let byte of bytes) chunk.push(byte);
	}

	if (chunk.length > 0 || words.length === 0) words.push(toEncodedWord(chunk));
	return words.join(" ");
}

/**
 * Reports whether a header value can travel as written. A value that already looks
 * like an encoded word is encoded anyway, so text a person typed as `=?x?=` is not
 * decoded into something else by the receiving client.
 */
function isHeaderSafe(value: string): boolean {
	return PRINTABLE_ASCII.test(value) && !value.includes("=?");
}

/**
 * Encodes unstructured header text, such as a subject, only when it has to be.
 *
 * @param name - Header name, whose length is what the first line has to give up.
 * @param value - The value a caller wrote.
 * @returns The value unchanged when it is plain ASCII, encoded words otherwise.
 */
function encodeHeaderText(name: string, value: string): string {
	if (isHeaderSafe(value)) return value;
	return encodeWords(value, name.length + 2);
}

/**
 * Formats a mailbox for a header, encoding a non-ASCII display name. The encoded
 * word replaces quoting rather than sitting inside it, because a quoted encoded
 * word is delivered to the reader literally. The address itself, a fold indent, and
 * a list separator are all reserved, since the last word shares its line with them.
 */
function encodeAddressHeader(address: Address): string {
	let name = address.name?.trim();
	if (!name || isHeaderSafe(name)) return formatAddress(address);
	return `${encodeWords(name, address.email.length + 5)} <${address.email}>`;
}

/**
 * Folds one header onto as many lines as it needs. The break replaces an existing
 * space and the continuation line begins with it, so unfolding restores the value
 * character for character. A run longer than the limit with no space in it is left
 * long, since folding inside a token would corrupt it.
 */
function foldHeader(name: string, value: string): string {
	let lines: string[] = [];
	let rest = `${name}: ${value}`;
	// The space after the colon is a legal fold point but leaves a bare `Name:`
	// line, so the first line looks past it; later lines only skip their indent.
	let earliest = name.length + 1;

	while (rest.length > MAX_HEADER_LINE_LENGTH) {
		let breakAt = rest.lastIndexOf(" ", MAX_HEADER_LINE_LENGTH);
		if (breakAt <= earliest) breakAt = rest.indexOf(" ", MAX_HEADER_LINE_LENGTH);
		if (breakAt === -1) break;
		lines.push(rest.slice(0, breakAt));
		rest = rest.slice(breakAt);
		earliest = 1;
	}

	lines.push(rest);
	return lines.join(CRLF);
}

/** Rewrites every line ending as CRLF, which is the only one MIME allows. */
function normalizeNewlines(value: string): string {
	return value.replace(NEWLINE, CRLF);
}

/**
 * Reports whether quoted-printable has to escape a byte instead of passing it
 * through. Line breaks are excluded: both encodings carry them structurally, so
 * counting them would push short-lined plain text toward base64 for no gain.
 */
function requiresEscape(byte: number): boolean {
	if (byte === EQUALS) return true;
	if (byte > LAST_PRINTABLE) return true;
	if (byte === TAB || byte === LINE_FEED || byte === CARRIAGE_RETURN) return false;
	return byte < SPACE;
}

/** Escapes a byte as the `=XX` form quoted-printable uses, with the uppercase hex it prescribes. */
function escapeByte(byte: number): string {
	return `=${byte.toString(16).toUpperCase().padStart(2, "0")}`;
}

/**
 * Encodes one byte for quoted-printable output.
 *
 * A leading `-` is escaped even though it is printable: that is what guarantees no
 * encoded line can begin with the `--` a boundary delimiter starts with. Trailing
 * whitespace is escaped because a relaying server is allowed to strip it, which
 * would otherwise change the body.
 */
function quotedPrintableToken(byte: number, atLineStart: boolean, atLineEnd: boolean): string {
	if (byte === HYPHEN && atLineStart) return escapeByte(byte);
	if ((byte === SPACE || byte === TAB) && atLineEnd) return escapeByte(byte);
	if (requiresEscape(byte)) return escapeByte(byte);
	return String.fromCharCode(byte);
}

/**
 * Encodes a single source line, soft-wrapping it as often as the length limit
 * needs. A soft break is the decoder's signal to rejoin the line, so wrapping
 * never changes the content it carries.
 */
function encodeQuotedPrintableLine(line: string): string {
	let bytes = new TextEncoder().encode(line);
	let lines: string[] = [];
	let current = "";
	let lastIndex = bytes.length - 1;

	for (let [index, byte] of bytes.entries()) {
		let token = quotedPrintableToken(byte, current.length === 0, index === lastIndex);
		if (current.length + token.length > MAX_ENCODED_LINE_LENGTH - 1) {
			lines.push(`${current}=`);
			current = "";
			token = quotedPrintableToken(byte, true, index === lastIndex);
		}
		current += token;
	}

	lines.push(current);
	return lines.join(CRLF);
}

/** Encodes a whole body as quoted-printable, keeping its hard line breaks intact. */
function toQuotedPrintable(content: string): string {
	return normalizeNewlines(content).split(CRLF).map(encodeQuotedPrintableLine).join(CRLF);
}

/** Encodes a whole body as base64, wrapped to the line limit. */
function toBase64Body(content: string): string {
	let base64 = toBase64(new TextEncoder().encode(normalizeNewlines(content)));
	let lines: string[] = [];
	for (let index = 0; index < base64.length; index += MAX_ENCODED_LINE_LENGTH) {
		lines.push(base64.slice(index, index + MAX_ENCODED_LINE_LENGTH));
	}
	return lines.join(CRLF);
}

/**
 * Encodes a body part with whichever transfer encoding costs less. Quoted-printable
 * wins for ordinary text because the result stays readable in a raw message, and
 * base64 takes over once escaping would inflate the body more than base64 does.
 */
function encodePart(contentType: string, content: string): EncodedPart {
	let normalized = normalizeNewlines(content);
	let bytes = new TextEncoder().encode(normalized);
	let escaped = 0;
	for (let byte of bytes) if (requiresEscape(byte)) escaped++;

	if (escaped > bytes.length * QUOTED_PRINTABLE_ESCAPE_BUDGET) {
		return { contentType, encoding: "base64", body: toBase64Body(normalized) };
	}

	return { contentType, encoding: "quoted-printable", body: toQuotedPrintable(normalized) };
}

/**
 * Picks a boundary no part can be confused with. Two things make that hold: the
 * token carries a random UUID, and neither transfer encoding can emit a line
 * starting with `--` (base64's alphabet has no `-`, and quoted-printable escapes a
 * leading one). The token is still checked against the encoded bodies, so the
 * guarantee does not rest on the encoders alone.
 */
function selectBoundary(parts: EncodedPart[]): string {
	let boundary = `${BOUNDARY_PREFIX}${crypto.randomUUID()}`;
	while (parts.some((part) => part.body.includes(boundary))) {
		boundary = `${BOUNDARY_PREFIX}${crypto.randomUUID()}`;
	}
	return boundary;
}

/** Wraps a message identifier in the angle brackets the header requires. */
function toMessageIdHeader(messageId: string): string {
	let value = messageId.trim();
	if (value.startsWith("<") && value.endsWith(">")) return value;
	return `<${value.replace(/^<|>$/g, "")}>`;
}

/**
 * Builds the headers every message carries, in the order a reader of a raw message
 * expects them. `Bcc` is deliberately absent: those recipients are addressed by the
 * envelope, and writing them into the message would expose them to everyone else.
 */
function buildHeaders(message: NormalizedMessage): string[] {
	let headers = [
		foldHeader("From", encodeAddressHeader(message.from)),
		foldHeader("To", message.to.map(encodeAddressHeader).join(", ")),
	];

	if (message.cc.length > 0) {
		headers.push(foldHeader("Cc", message.cc.map(encodeAddressHeader).join(", ")));
	}

	if (message.replyTo.length > 0) {
		headers.push(foldHeader("Reply-To", message.replyTo.map(encodeAddressHeader).join(", ")));
	}

	headers.push(
		foldHeader("Subject", encodeHeaderText("Subject", message.subject)),
		foldHeader("Date", formatDate(message.date)),
		foldHeader("Message-ID", toMessageIdHeader(message.messageId)),
		foldHeader("MIME-Version", "1.0"),
	);

	for (let [name, value] of Object.entries(message.headers)) {
		if (RESERVED_HEADERS.has(name.toLowerCase())) continue;
		headers.push(foldHeader(name, encodeHeaderText(name, value)));
	}

	return headers;
}

/** Writes the `Content-*` headers that describe one part's type and encoding. */
function buildContentHeaders(part: EncodedPart): string[] {
	return [
		foldHeader("Content-Type", `${part.contentType}; charset=utf-8`),
		foldHeader("Content-Transfer-Encoding", part.encoding),
	];
}

/**
 * Assembles a normalized message into a raw RFC 5322 message.
 *
 * Both body parts produce a `multipart/alternative` message with the plain-text
 * part first, which is the order RFC 2046 reads as least to most preferred; a
 * single body produces a single-part message with no boundary at all. Headers are
 * folded, non-ASCII display names and subjects become encoded words, and every
 * line ends with CRLF, including the last one.
 *
 * A message with neither body part yields an empty text part rather than failing,
 * because the mailer's validation already rejects that message before a transport
 * ever sees it.
 *
 * @param message - The normalized message a transport received.
 * @returns The complete message, ready to hand to a provider that takes raw MIME.
 * @example let raw = buildMimeMessage(message); // "From: ...\r\n\r\n..."
 */
export function buildMimeMessage(message: NormalizedMessage): string {
	let text = message.text ? encodePart("text/plain", message.text) : undefined;
	let html = message.html ? encodePart("text/html", message.html) : undefined;
	let headers = buildHeaders(message);

	if (text && html) {
		let boundary = selectBoundary([text, html]);
		return [
			...headers,
			foldHeader("Content-Type", `multipart/alternative; boundary="${boundary}"`),
			"",
			`--${boundary}`,
			...buildContentHeaders(text),
			"",
			text.body,
			`--${boundary}`,
			...buildContentHeaders(html),
			"",
			html.body,
			`--${boundary}--`,
			"",
		].join(CRLF);
	}

	let part = text ?? html ?? encodePart("text/plain", "");
	return [...headers, ...buildContentHeaders(part), "", part.body, ""].join(CRLF);
}
