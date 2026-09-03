/**
 * Tests the MIME builder by taking its output apart again: the message is parsed
 * back into headers and parts, encoded words and transfer encodings are decoded, and
 * the result is compared with what went in. Structure, folding, encoding choice, and
 * CRLF line endings are all asserted, since a MIME bug surfaces as malformed mail
 * that these assertions catch directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { NormalizedMessage } from "./types.js";

import { buildMimeMessage } from "./mime.js";

/** Sender identity used unless a test needs a different one. */
const SENDER = { email: "no-reply@example.com", name: "Example" };

/** Fixed date, so the `Date` header can be asserted exactly. */
const DATE = new Date("2026-01-01T00:00:00.000Z");

/** A message split into its unfolded headers and its body. */
interface ParsedMessage {
	/** Header names and values in the order they appeared, already unfolded. */
	headers: [string, string][];
	/** Everything after the blank line that ends the headers. */
	body: string;
}

/** An encoded word, with the trailing whitespace a decoder drops between adjacent words. */
const ENCODED_WORD = /=\?UTF-8\?B\?([^?]*)\?=(\s+(?==\?))?/gi;

/** Builds a normalized message, which is the only shape the builder accepts. */
function createMessage(overrides?: Partial<NormalizedMessage>): NormalizedMessage {
	return {
		from: SENDER,
		to: [{ email: "ada@example.com", name: "Ada" }],
		cc: [],
		bcc: [],
		replyTo: [],
		subject: "Hi",
		text: "Hello there",
		headers: {},
		date: DATE,
		messageId: "<one@example.com>",
		...overrides,
	};
}

/** Rewrites plain newlines as CRLF, which is what the builder normalizes them to. */
function withCrlf(value: string): string {
	return value.replaceAll("\n", "\r\n");
}

/**
 * Splits a raw message into unfolded headers and a body. Unfolding removes the CRLF
 * of a folded line and keeps its leading whitespace, which is what makes a folded
 * value comparable with the value that was folded.
 */
function parseMessage(raw: string): ParsedMessage {
	let separator = raw.indexOf("\r\n\r\n");
	if (separator === -1) throw new Error("The message has no header/body separator.");

	let headers = raw
		.slice(0, separator)
		.replace(/\r\n([ \t])/g, "$1")
		.split("\r\n")
		.map((line): [string, string] => {
			let colon = line.indexOf(":");
			return [line.slice(0, colon), line.slice(colon + 1).replace(/^ /, "")];
		});

	return { headers, body: raw.slice(separator + 4) };
}

/** Reads a header value, or `undefined` when the message does not carry that header. */
function optionalHeader(parsed: ParsedMessage, name: string): string | undefined {
	return parsed.headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

/** Reads a header value, failing the test when the header is missing entirely. */
function header(parsed: ParsedMessage, name: string): string {
	let value = optionalHeader(parsed, name);
	if (value === undefined) throw new Error(`The message has no "${name}" header.`);
	return value;
}

/** Decodes base64 back to the text it was made from, ignoring any line wrapping. */
function decodeBase64(value: string): string {
	let binary = atob(value.replaceAll("\r\n", ""));
	return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

/**
 * Decodes quoted-printable: soft breaks are rejoined first, then every escape is
 * turned back into the byte it stood for, so a multi-byte character split across
 * escapes decodes correctly.
 */
function decodeQuotedPrintable(value: string): string {
	let joined = value.replaceAll("=\r\n", "");
	let bytes: number[] = [];

	let index = 0;
	while (index < joined.length) {
		if (joined.startsWith("=", index)) {
			bytes.push(Number.parseInt(joined.slice(index + 1, index + 3), 16));
			index += 3;
			continue;
		}
		bytes.push(joined.charCodeAt(index));
		index += 1;
	}

	return new TextDecoder().decode(Uint8Array.from(bytes));
}

/** Decodes a part's body according to the transfer encoding it declares. */
function decodePart(part: ParsedMessage): string {
	let encoding = header(part, "content-transfer-encoding");
	if (encoding === "base64") return decodeBase64(part.body);
	if (encoding === "quoted-printable") return decodeQuotedPrintable(part.body);
	throw new Error(`Unexpected transfer encoding "${encoding}".`);
}

/** Decodes RFC 2047 encoded words in a header value, dropping the space between adjacent ones. */
function decodeHeader(value: string): string {
	return value.replace(ENCODED_WORD, (_match: string, payload: string) => decodeBase64(payload));
}

/** Reads the boundary a multipart message declared, failing the test when it declared none. */
function boundaryOf(parsed: ParsedMessage): string {
	let boundary = /boundary="([^"]+)"/.exec(header(parsed, "content-type"))?.[1];
	if (!boundary) throw new Error("The message declares no boundary.");
	return boundary;
}

/** Splits a multipart body into its parts, dropping the preamble and the closing delimiter. */
function splitParts(parsed: ParsedMessage): ParsedMessage[] {
	let sections = parsed.body.split(`--${boundaryOf(parsed)}`);
	return sections.slice(1, -1).map((section) => {
		let part = parseMessage(section.replace(/^\r\n/, ""));
		return { headers: part.headers, body: part.body.replace(/\r\n$/, "") };
	});
}

/** Reads one part, failing the test when the message has fewer parts than expected. */
function partAt(parts: ParsedMessage[], index: number): ParsedMessage {
	let part = parts[index];
	if (!part) throw new Error(`The message has no part at index ${index}.`);
	return part;
}

describe("buildMimeMessage", () => {
	test("writes a plain-text message as a single part", () => {
		let raw = buildMimeMessage(createMessage({ text: "Hello there", html: undefined }));
		let parsed = parseMessage(raw);

		expect(header(parsed, "content-type")).toBe("text/plain; charset=utf-8");
		expect(header(parsed, "content-transfer-encoding")).toBe("quoted-printable");
		expect(header(parsed, "content-type")).not.toContain("boundary");
		expect(decodeQuotedPrintable(parsed.body.replace(/\r\n$/, ""))).toBe("Hello there");
	});

	test("writes an HTML-only message as a single part, with no derived text part", () => {
		let raw = buildMimeMessage(
			createMessage({ text: undefined, html: "<p>Hello <b>there</b></p>" }),
		);
		let parsed = parseMessage(raw);

		expect(header(parsed, "content-type")).toBe("text/html; charset=utf-8");
		expect(decodeQuotedPrintable(parsed.body.replace(/\r\n$/, ""))).toBe(
			"<p>Hello <b>there</b></p>",
		);
	});

	test("writes both bodies as multipart/alternative, plain text first", () => {
		let raw = buildMimeMessage(createMessage({ text: "Hello there", html: "<p>Hello there</p>" }));
		let parsed = parseMessage(raw);
		let parts = splitParts(parsed);

		expect(header(parsed, "content-type")).toMatch(/^multipart\/alternative; boundary=/);
		expect(parts).toHaveLength(2);
		expect(header(partAt(parts, 0), "content-type")).toBe("text/plain; charset=utf-8");
		expect(header(partAt(parts, 1), "content-type")).toBe("text/html; charset=utf-8");
		expect(decodePart(partAt(parts, 0))).toBe("Hello there");
		expect(decodePart(partAt(parts, 1))).toBe("<p>Hello there</p>");
	});

	test("closes a multipart body with the terminating delimiter", () => {
		let raw = buildMimeMessage(createMessage({ html: "<p>Hi</p>" }));
		let boundary = boundaryOf(parseMessage(raw));

		expect(raw).toContain(`--${boundary}--\r\n`);
		expect(raw.endsWith(`--${boundary}--\r\n`)).toBe(true);
	});

	test("writes every header a message needs to be accepted", () => {
		let raw = buildMimeMessage(
			createMessage({
				cc: [{ email: "grace@example.com" }],
				replyTo: [{ email: "hello@example.com", name: "Support" }],
				headers: { "X-App": "example" },
			}),
		);
		let parsed = parseMessage(raw);

		expect(header(parsed, "mime-version")).toBe("1.0");
		expect(header(parsed, "date")).toBe("Thu, 01 Jan 2026 00:00:00 +0000");
		expect(header(parsed, "message-id")).toBe("<one@example.com>");
		expect(header(parsed, "from")).toBe("Example <no-reply@example.com>");
		expect(header(parsed, "to")).toBe("Ada <ada@example.com>");
		expect(header(parsed, "cc")).toBe("grace@example.com");
		expect(header(parsed, "reply-to")).toBe("Support <hello@example.com>");
		expect(header(parsed, "subject")).toBe("Hi");
		expect(header(parsed, "x-app")).toBe("example");
	});

	test("keeps blind copies out of the headers, since the envelope addresses them", () => {
		let raw = buildMimeMessage(createMessage({ bcc: [{ email: "audit@example.com" }] }));

		expect(optionalHeader(parseMessage(raw), "bcc")).toBeUndefined();
		expect(raw).not.toContain("audit@example.com");
	});

	test("drops a custom header that would duplicate a derived one", () => {
		let raw = buildMimeMessage(
			createMessage({ headers: { From: "attacker@example.com", "Content-Type": "text/csv" } }),
		);
		let parsed = parseMessage(raw);

		expect(parsed.headers.filter(([name]) => name.toLowerCase() === "from")).toHaveLength(1);
		expect(header(parsed, "from")).toBe("Example <no-reply@example.com>");
		expect(header(parsed, "content-type")).toBe("text/plain; charset=utf-8");
	});

	test("writes several recipients as one comma-separated list", () => {
		let raw = buildMimeMessage(
			createMessage({
				to: [{ email: "ada@example.com" }, { email: "grace@example.com", name: "Grace" }],
			}),
		);

		expect(header(parseMessage(raw), "to")).toBe("ada@example.com, Grace <grace@example.com>");
	});

	test("adds the angle brackets a message identifier needs when the caller omitted them", () => {
		let raw = buildMimeMessage(createMessage({ messageId: "bare@example.com" }));

		expect(header(parseMessage(raw), "message-id")).toBe("<bare@example.com>");
	});

	test("encodes a non-ASCII display name as an unquoted encoded word", () => {
		let raw = buildMimeMessage(
			createMessage({ from: { email: "no-reply@example.com", name: "Sergio Xalambrí" } }),
		);
		let value = header(parseMessage(raw), "from");

		expect(value).toContain("=?UTF-8?B?");
		expect(value).not.toContain('"=?');
		expect(decodeHeader(value)).toBe("Sergio Xalambrí <no-reply@example.com>");
	});

	test("encodes a non-ASCII subject and decodes back to exactly what was written", () => {
		let subject = "Añadido: ¿confirmás tu correo? 📬";
		let raw = buildMimeMessage(createMessage({ subject }));
		let value = header(parseMessage(raw), "subject");

		expect(value).toContain("=?UTF-8?B?");
		expect(decodeHeader(value)).toBe(subject);
	});

	test("splits a long non-ASCII subject into encoded words without cutting a character", () => {
		let subject = "🎉 ".repeat(30).trim();
		let raw = buildMimeMessage(createMessage({ subject }));
		let value = header(parseMessage(raw), "subject");

		expect(value.split("=?UTF-8?B?").length - 1).toBeGreaterThan(1);
		expect(decodeHeader(value)).toBe(subject);
		expect(decodeHeader(value)).not.toContain("�");
	});

	test("leaves an ASCII subject unencoded, so a raw message stays readable", () => {
		let raw = buildMimeMessage(createMessage({ subject: "Your invite is ready" }));

		expect(header(parseMessage(raw), "subject")).toBe("Your invite is ready");
		expect(raw).not.toContain("=?UTF-8?B?");
	});

	test("encodes an ASCII value that would otherwise be read as an encoded word", () => {
		let subject = "=?UTF-8?B?bm90IGVuY29kZWQ=?= is literal";
		let raw = buildMimeMessage(createMessage({ subject }));

		expect(decodeHeader(header(parseMessage(raw), "subject"))).toBe(subject);
	});

	test("folds a long subject onto continuation lines that unfold to the original", () => {
		let subject =
			"This subject is deliberately far longer than the seventy-eight characters a header line is allowed to occupy before it has to be folded";
		let raw = buildMimeMessage(createMessage({ subject }));

		let subjectLines = raw
			.split("\r\n")
			.slice(raw.split("\r\n").findIndex((line) => line.startsWith("Subject:")));

		expect(subjectLines[0]).toMatch(/^Subject: This subject/);
		expect(subjectLines[1]).toMatch(/^ /);
		expect(header(parseMessage(raw), "subject")).toBe(subject);
	});

	test("keeps every folded header line inside the line-length limit", () => {
		let raw = buildMimeMessage(
			createMessage({
				subject: "A subject long enough to fold ".repeat(6),
				to: Array.from({ length: 8 }, (_value, index) => ({
					email: `recipient-number-${index}@long-domain-name.example.com`,
					name: `Recipient Number ${index}`,
				})),
			}),
		);
		let parsed = parseMessage(raw);
		let headerLines = raw.slice(0, raw.indexOf("\r\n\r\n")).split("\r\n");

		for (let line of headerLines) expect(line.length).toBeLessThanOrEqual(78);
		expect(header(parsed, "to").split(", ")).toHaveLength(8);
	});

	test("sizes encoded words so an encoded header also stays inside the line limit", () => {
		let raw = buildMimeMessage(
			createMessage({
				subject: "Tu invitación al equipo ya está lista y este asunto es largo a propósito 📬",
				from: { email: "no-reply@example.com", name: "Ejemplo Señal Nombre Bastante Largo" },
				to: [{ email: "ada@example.com", name: "Ada Lovelace Condesa de Añasco" }],
			}),
		);
		let parsed = parseMessage(raw);
		let headerLines = raw.slice(0, raw.indexOf("\r\n\r\n")).split("\r\n");

		for (let line of headerLines) expect(line.length).toBeLessThanOrEqual(78);
		expect(decodeHeader(header(parsed, "subject"))).toBe(
			"Tu invitación al equipo ya está lista y este asunto es largo a propósito 📬",
		);
		expect(decodeHeader(header(parsed, "from"))).toBe(
			"Ejemplo Señal Nombre Bastante Largo <no-reply@example.com>",
		);
		expect(decodeHeader(header(parsed, "to"))).toBe(
			"Ada Lovelace Condesa de Añasco <ada@example.com>",
		);
	});

	test("leaves a header with no fold point on one line rather than corrupting it", () => {
		let value = `https://example.com/${"a".repeat(120)}`;
		let raw = buildMimeMessage(createMessage({ headers: { "X-Link": value } }));

		expect(raw).toContain(`X-Link: ${value}\r\n`);
		expect(header(parseMessage(raw), "x-link")).toBe(value);
	});

	test("never lets a body line be read as a boundary delimiter", () => {
		let text = ["--=_Part_0000", "----=_Part_looks-real--", "- a single leading dash", "end"].join(
			"\n",
		);
		let raw = buildMimeMessage(createMessage({ text, html: "<p>--=_Part_0000</p>" }));
		let parsed = parseMessage(raw);
		let parts = splitParts(parsed);
		let boundary = boundaryOf(parsed);

		expect(parts).toHaveLength(2);
		expect(decodePart(partAt(parts, 0))).toBe(withCrlf(text));
		expect(decodePart(partAt(parts, 1))).toBe("<p>--=_Part_0000</p>");

		for (let part of parts) {
			for (let line of part.body.split("\r\n")) expect(line).not.toMatch(/^--/);
		}
		expect(raw.split("\r\n").filter((line) => line.startsWith(`--${boundary}`))).toHaveLength(3);
	});

	test("uses CRLF everywhere, whatever the caller's bodies used", () => {
		let raw = buildMimeMessage(
			createMessage({ text: "one\ntwo\r\nthree\rfour", html: "<p>one</p>\n<p>two</p>" }),
		);

		expect(raw.replaceAll("\r\n", "")).not.toContain("\n");
		expect(raw.replaceAll("\r\n", "")).not.toContain("\r");
		expect(raw).toMatch(/\r\n$/);
		expect(decodePart(partAt(splitParts(parseMessage(raw)), 0))).toBe(
			"one\r\ntwo\r\nthree\r\nfour",
		);
	});

	test("keeps blank lines in a body instead of collapsing them", () => {
		let text = "first\n\nsecond\n";
		let raw = buildMimeMessage(createMessage({ text, html: undefined }));
		let parsed = parseMessage(raw);

		expect(decodeQuotedPrintable(parsed.body.replace(/\r\n$/, ""))).toBe(withCrlf(text));
	});

	test("chooses base64 when escaping would cost more than encoding", () => {
		let raw = buildMimeMessage(
			createMessage({ text: "こんにちは、世界。メールをご確認ください。", html: undefined }),
		);
		let parsed = parseMessage(raw);

		expect(header(parsed, "content-transfer-encoding")).toBe("base64");
		expect(decodeBase64(parsed.body)).toBe("こんにちは、世界。メールをご確認ください。");
	});

	test("keeps quoted-printable for text with only a few non-ASCII characters", () => {
		let text = `Hola Sergio, tu invitación está lista. ${"Everything else is plain ASCII. ".repeat(4)}`;
		let raw = buildMimeMessage(createMessage({ text, html: undefined }));
		let parsed = parseMessage(raw);

		expect(header(parsed, "content-transfer-encoding")).toBe("quoted-printable");
		expect(decodeQuotedPrintable(parsed.body.replace(/\r\n$/, ""))).toBe(text);
	});

	test("soft-wraps a long body line and keeps every encoded line inside the limit", () => {
		let text = `A single line with no break in it at all. ${"word ".repeat(60)}`.trim();
		let raw = buildMimeMessage(createMessage({ text, html: undefined }));
		let parsed = parseMessage(raw);

		for (let line of parsed.body.split("\r\n")) expect(line.length).toBeLessThanOrEqual(76);
		expect(decodeQuotedPrintable(parsed.body.replace(/\r\n$/, ""))).toBe(text);
	});

	test("escapes trailing whitespace, which a relay is allowed to strip", () => {
		let text = "trailing spaces here   \nand a tab\t\nend";
		let raw = buildMimeMessage(createMessage({ text, html: undefined }));
		let parsed = parseMessage(raw);

		expect(parsed.body).toContain("=20\r\n");
		expect(parsed.body).toContain("=09\r\n");
		expect(decodeQuotedPrintable(parsed.body.replace(/\r\n$/, ""))).toBe(withCrlf(text));
	});

	test("round-trips a whole message back into the parts it was built from", () => {
		let message = createMessage({
			from: { email: "no-reply@example.com", name: "Ejemplo Señal" },
			to: [{ email: "ada@example.com", name: "Ada Lovelace" }],
			cc: [{ email: "grace@example.com" }],
			replyTo: [{ email: "hello@example.com" }],
			subject: "Tu invitación al equipo ya está lista, y este asunto es largo a propósito 📬",
			text: "Hola Ada\n\nAceptá la invitación: https://example.com/invites/1\n",
			html: '<p>Hola Ada</p><p><a href="https://example.com/invites/1">Aceptá la invitación</a></p>',
			headers: { "X-Entity-Ref-ID": "invite-1" },
		});

		let parsed = parseMessage(buildMimeMessage(message));
		let parts = splitParts(parsed);

		expect(decodeHeader(header(parsed, "from"))).toBe("Ejemplo Señal <no-reply@example.com>");
		expect(decodeHeader(header(parsed, "to"))).toBe("Ada Lovelace <ada@example.com>");
		expect(header(parsed, "cc")).toBe("grace@example.com");
		expect(header(parsed, "reply-to")).toBe("hello@example.com");
		expect(decodeHeader(header(parsed, "subject"))).toBe(message.subject);
		expect(header(parsed, "x-entity-ref-id")).toBe("invite-1");
		expect(parts).toHaveLength(2);
		expect(decodePart(partAt(parts, 0))).toBe(withCrlf(message.text ?? ""));
		expect(decodePart(partAt(parts, 1))).toBe(message.html ?? "");
	});

	test("gives two builds of the same message different boundaries", () => {
		let message = createMessage({ html: "<p>Hi</p>" });

		expect(boundaryOf(parseMessage(buildMimeMessage(message)))).not.toBe(
			boundaryOf(parseMessage(buildMimeMessage(message))),
		);
	});

	test("writes an empty text part for a message with no body at all", () => {
		let raw = buildMimeMessage(createMessage({ text: undefined, html: undefined }));
		let parsed = parseMessage(raw);

		expect(header(parsed, "content-type")).toBe("text/plain; charset=utf-8");
		expect(parsed.body).toBe("\r\n");
	});
});
