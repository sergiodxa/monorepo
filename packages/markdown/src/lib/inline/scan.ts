/**
 * The character-level readers the inline phase asks before it builds a node:
 * delimiter flanking, link destinations and titles, raw HTML, autolinks, and
 * the label normalization a reference is looked up by.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { decodeEntity } from "../entities.js";

/** The characters a backslash may escape, which CommonMark limits to ASCII punctuation. */
const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/** CommonMark's Unicode whitespace, which decides a delimiter run's flanking. */
const WHITESPACE = /\s/u;

/** CommonMark's Unicode punctuation, which since 0.31 includes the symbol categories. */
const PUNCTUATION = /[\p{P}\p{S}]/u;

/** An attribute value as raw HTML allows it: unquoted, single quoted, or double quoted. */
const ATTRIBUTE =
	"(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^\"'=<>`\\x00-\\x20]+|'[^']*'|\"[^\"]*\"))?)";

/** Every form of raw inline HTML: a tag, a comment, an instruction, a declaration, or a CDATA section. */
const HTML_TAG = new RegExp(
	`(?:<[A-Za-z][A-Za-z0-9-]*${ATTRIBUTE}*\\s*/?>` +
		"|</[A-Za-z][A-Za-z0-9-]*\\s*>" +
		"|<!-->|<!--->|<!--[\\s\\S]*?-->" +
		"|<[?][\\s\\S]*?[?]>" +
		"|<![A-Za-z][^>]*>" +
		"|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)",
	"y",
);

/** An absolute-URI autolink, whose scheme and body CommonMark spells out exactly. */
// oxlint-disable-next-line no-control-regex -- CommonMark defines the body as every character above the ASCII control range
const URI_AUTOLINK = /<[A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\u0000-\u0020]*>/y;

/** An email autolink, whose address CommonMark takes from the HTML5 email input rule. */
const EMAIL_AUTOLINK =
	/<[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*>/y;

/** A pointy-bracket link destination, which runs to the first unescaped closing bracket. */
const BRACKETED_DESTINATION = /<(?:[^<>\n\\]|\\.)*>/y;

/** The three title forms, whose capture groups are the quoted, apostrophed, and parenthesized bodies. */
const LINK_TITLE = /(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|\((((?:\\.|[^()])*))\))/y;

/** A bracketed label, capped at the thousand characters CommonMark allows inside one. */
const LINK_LABEL = /\[(?:[^\\[\]]|\\[\s\S]){0,1000}\]/y;

/** Spaces and tabs, optionally crossing one line ending, which is what separates a destination from its title. */
const SPACE_NEWLINE = /[ \t]*(?:\n[ \t]*)?/y;

/** The characters GFM drops from the end of a literal autolink, since prose puts them there. */
const TRAILING_PUNCTUATION = /[?!.,:*_~]$/;

/** A character reference GFM drops whole when a literal autolink ends in one. */
const TRAILING_ENTITY = /&[A-Za-z][A-Za-z0-9]{1,31};$/;

/** What may precede a literal autolink: GFM allows only these beside a line start and whitespace. */
const AUTOLINK_BOUNDARY = /[*_~(]/;

/** The three schemes GFM turns into a literal autolink, plus the bare `www.` host form. */
const LITERAL_URL = /(?:https?:\/\/|ftp:\/\/|www\.)/iy;

/** The characters a literal autolink's host and path may use before GFM trims the tail. */
const LITERAL_URL_BODY = /[^\s<]*/y;

/** The characters GFM allows in the part of an email address before the at sign. */
const EMAIL_LOCAL = /[A-Za-z0-9._+-]/;

/** The characters GFM allows in a literal email autolink's domain. */
const EMAIL_DOMAIN = /[A-Za-z0-9._-]+/y;

/**
 * How deep a bare destination may nest its parentheses. Text that opens more
 * than this closes none of them, so the scan gives up instead of reading the
 * rest of the paragraph once for every `](` written in it.
 */
const DESTINATION_DEPTH = 32;

/**
 * @param char - The character a bare link destination reached
 * @returns Whether CommonMark ends the destination there, which it does at every ASCII space and control character
 */
function endsDestination(char: string): boolean {
	let code = char.charCodeAt(0);

	return code <= 0x20 || code === 0x7f;
}

/**
 * @param char - The character to test, which may run past the end of the text
 * @returns Whether a backslash before it produces the character itself
 */
export function isEscapable(char: string | undefined): boolean {
	return char !== undefined && ESCAPABLE.test(char);
}

/**
 * Resolves the backslash escapes and character references a destination or a
 * title may carry, so the AST holds the value rather than the way it was typed.
 *
 * @param raw - The text as the source wrote it
 * @returns The text the source meant
 */
export function unescapeString(raw: string): string {
	let out = "";
	let index = 0;

	while (index < raw.length) {
		let char = raw[index];

		if (char === "\\" && isEscapable(raw[index + 1])) {
			out += raw[index + 1];
			index += 2;
			continue;
		}

		if (char === "&") {
			let entity = decodeEntity(raw, index);
			if (entity) {
				out += entity.value;
				index = entity.end;
				continue;
			}
		}

		out += char;
		index += 1;
	}

	return out;
}

/**
 * Folds a bracketed label the way CommonMark matches one, so `[Foo Bar]` and
 * `[foo   bar]` name the same definition.
 *
 * @param raw - The label's text, without its brackets
 * @returns The key a reference definition is stored under
 */
export function normalizeLabel(raw: string): string {
	return raw
		.trim()
		.replace(/[ \t\r\n]+/g, " ")
		.toLowerCase()
		.toUpperCase();
}

/**
 * Folds a footnote label into the identifier both halves of a footnote carry,
 * keeping it readable so a renderer can build an anchor out of it.
 *
 * @param raw - The label's text, without its brackets or caret
 * @returns The identifier a definition and a reference agree on
 */
export function normalizeIdentifier(raw: string): string {
	return raw
		.trim()
		.replace(/[ \t\r\n]+/g, " ")
		.toLowerCase();
}

/** A run of one delimiter character, and what CommonMark's flanking rules let it do. */
export interface DelimiterRun {
	length: number;
	canOpen: boolean;
	canClose: boolean;
}

/**
 * Measures the delimiter run starting at `start` and applies the flanking rules,
 * including the intraword restriction that keeps `snake_case_words` whole.
 *
 * @param subject - The leaf's text
 * @param start - Index of the run's first character
 * @param end - Index one past the range being parsed
 * @returns How long the run is and which ends of a span it may take
 */
export function scanDelimiterRun(subject: string, start: number, end: number): DelimiterRun {
	let char = subject[start];
	let index = start;

	while (index < end && subject[index] === char) index += 1;

	let before = start === 0 ? "\n" : (subject[start - 1] ?? "\n");
	let after = index >= end ? "\n" : (subject[index] ?? "\n");

	let beforeIsWhitespace = WHITESPACE.test(before);
	let beforeIsPunctuation = PUNCTUATION.test(before);
	let afterIsWhitespace = WHITESPACE.test(after);
	let afterIsPunctuation = PUNCTUATION.test(after);

	let leftFlanking =
		!afterIsWhitespace && (!afterIsPunctuation || beforeIsWhitespace || beforeIsPunctuation);
	let rightFlanking =
		!beforeIsWhitespace && (!beforeIsPunctuation || afterIsWhitespace || afterIsPunctuation);

	if (char === "_") {
		return {
			length: index - start,
			canOpen: leftFlanking && (!rightFlanking || beforeIsPunctuation),
			canClose: rightFlanking && (!leftFlanking || afterIsPunctuation),
		};
	}

	return { length: index - start, canOpen: leftFlanking, canClose: rightFlanking };
}

/**
 * @param subject - The leaf's text
 * @param start - Index of the `<`
 * @param end - Index one past the range being parsed
 * @returns Index one past the raw HTML, or `-1` when the text holds none
 */
export function matchHtmlTag(subject: string, start: number, end: number): number {
	HTML_TAG.lastIndex = start;
	let match = HTML_TAG.exec(subject);

	if (!match || HTML_TAG.lastIndex > end) return -1;

	return HTML_TAG.lastIndex;
}

/** A link the source wrote without brackets, whose text a renderer shows as typed. */
export interface Autolink {
	href: string;
	label: string;
	/** Index one past the link's last character. */
	end: number;
}

/**
 * @param subject - The leaf's text
 * @param start - Index of the `<`
 * @param end - Index one past the range being parsed
 * @returns The link the angle brackets hold, or `null` when they hold something else
 */
export function matchAutolink(subject: string, start: number, end: number): Autolink | null {
	URI_AUTOLINK.lastIndex = start;
	let uri = URI_AUTOLINK.exec(subject);

	if (uri && URI_AUTOLINK.lastIndex <= end) {
		let label = uri[0].slice(1, -1);
		return { href: label, label, end: URI_AUTOLINK.lastIndex };
	}

	EMAIL_AUTOLINK.lastIndex = start;
	let email = EMAIL_AUTOLINK.exec(subject);

	if (email && EMAIL_AUTOLINK.lastIndex <= end) {
		let label = email[0].slice(1, -1);
		return { href: `mailto:${label}`, label, end: EMAIL_AUTOLINK.lastIndex };
	}

	return null;
}

/** A link destination as the source wrote it, already unescaped. */
export interface Destination {
	href: string;
	/** Index one past the destination's last character. */
	end: number;
}

/**
 * Reads a link destination in either form CommonMark allows: inside pointy
 * brackets, or bare with its parentheses balanced.
 *
 * @param subject - The leaf's text
 * @param start - Index the destination begins at
 * @param end - Index one past the range being parsed
 * @returns The destination and where it ends, or `null` when the text holds none
 */
export function matchDestination(subject: string, start: number, end: number): Destination | null {
	BRACKETED_DESTINATION.lastIndex = start;
	let bracketed = BRACKETED_DESTINATION.exec(subject);

	if (bracketed && BRACKETED_DESTINATION.lastIndex <= end) {
		return {
			href: unescapeString(bracketed[0].slice(1, -1)),
			end: BRACKETED_DESTINATION.lastIndex,
		};
	}

	if (subject[start] === "<") return null;

	let index = start;
	let depth = 0;

	while (index < end) {
		let char = subject[index] ?? "";

		if (char === "\\" && isEscapable(subject[index + 1])) {
			index += 2;
			continue;
		}

		if (char === "(") {
			depth += 1;
			if (depth > DESTINATION_DEPTH) return null;
			index += 1;
			continue;
		}

		if (char === ")") {
			if (depth === 0) break;
			depth -= 1;
			index += 1;
			continue;
		}

		if (endsDestination(char)) break;

		index += 1;
	}

	if (depth !== 0) return null;
	if (index === start && subject[index] !== ")") return null;

	return { href: unescapeString(subject.slice(start, index)), end: index };
}

/** A link title as the source wrote it, already unescaped. */
export interface Title {
	title: string;
	/** Index one past the title's last character. */
	end: number;
}

/**
 * @param subject - The leaf's text
 * @param start - Index the title begins at
 * @param end - Index one past the range being parsed
 * @returns The title and where it ends, or `null` when the text holds none
 */
export function matchTitle(subject: string, start: number, end: number): Title | null {
	LINK_TITLE.lastIndex = start;
	let match = LINK_TITLE.exec(subject);

	if (!match || LINK_TITLE.lastIndex > end) return null;

	let body = match[1] ?? match[2] ?? match[3] ?? "";

	return { title: unescapeString(body), end: LINK_TITLE.lastIndex };
}

/**
 * @param subject - The leaf's text
 * @param start - Index of the `[`
 * @param end - Index one past the range being parsed
 * @returns How many characters the label spans, brackets included, or `0` when the text holds none
 */
export function matchLabel(subject: string, start: number, end: number): number {
	LINK_LABEL.lastIndex = start;
	let match = LINK_LABEL.exec(subject);

	if (!match || LINK_LABEL.lastIndex > end) return 0;

	return match[0].length;
}

/**
 * @param subject - The leaf's text
 * @param start - Index to skip from
 * @param end - Index one past the range being parsed
 * @returns The first index holding something other than the run of spaces and at most one line ending
 */
export function skipSpaceAndNewline(subject: string, start: number, end: number): number {
	SPACE_NEWLINE.lastIndex = start;
	SPACE_NEWLINE.exec(subject);

	return Math.min(SPACE_NEWLINE.lastIndex, end);
}

/**
 * @param subject - The leaf's text
 * @param start - Index a literal autolink would begin at
 * @param rangeStart - Index the range being parsed begins at
 * @returns Whether GFM lets an autolink start there
 */
function startsAtBoundary(subject: string, start: number, rangeStart: number): boolean {
	if (start <= rangeStart) return true;

	let before = subject[start - 1] ?? "\n";

	return WHITESPACE.test(before) || AUTOLINK_BOUNDARY.test(before);
}

/**
 * Drops the trailing characters GFM reads as prose rather than as part of a
 * link: sentence punctuation, a closing parenthesis the link never opened, and
 * a whole character reference.
 *
 * @param raw - The run of non-whitespace characters that followed the scheme
 * @returns The link text, which may be shorter than what was scanned
 */
function trimAutolinkTail(raw: string): string {
	let text = raw;
	let trimming = true;

	while (trimming && text.length > 0) {
		trimming = false;

		if (TRAILING_PUNCTUATION.test(text)) {
			text = text.slice(0, -1);
			trimming = true;
			continue;
		}

		if (text.endsWith(")")) {
			let opens = text.split("(").length - 1;
			let closes = text.split(")").length - 1;
			if (closes > opens) {
				text = text.slice(0, -1);
				trimming = true;
				continue;
			}
		}

		if (text.endsWith(";")) {
			let entity = TRAILING_ENTITY.exec(text);
			if (entity) {
				text = text.slice(0, -entity[0].length);
				trimming = true;
			}
		}
	}

	return text;
}

/**
 * @param host - The text between the scheme and the first slash
 * @returns Whether GFM accepts it as a domain, which requires a dot and keeps underscores out of the last two labels
 */
function isValidHost(host: string): boolean {
	let labels = host.split(".");
	if (labels.length < 2) return false;
	if (labels.some((label) => label.length === 0)) return false;

	return labels.slice(-2).every((label) => !label.includes("_"));
}

/**
 * Reads the literal autolink GFM finds at a bare `www.`, `http://`, or
 * `https://`, which is the form authors write in prose without any brackets.
 *
 * @param subject - The leaf's text
 * @param start - Index the scheme or host begins at
 * @param rangeStart - Index the range being parsed begins at
 * @param end - Index one past the range being parsed
 * @returns The link and where it ends, or `null` when the text holds none
 */
export function matchLiteralUrl(
	subject: string,
	start: number,
	rangeStart: number,
	end: number,
): Autolink | null {
	if (!startsAtBoundary(subject, start, rangeStart)) return null;

	LITERAL_URL.lastIndex = start;
	let scheme = LITERAL_URL.exec(subject);
	if (!scheme || LITERAL_URL.lastIndex > end) return null;

	LITERAL_URL_BODY.lastIndex = start;
	LITERAL_URL_BODY.exec(subject);

	let raw = subject.slice(start, Math.min(LITERAL_URL_BODY.lastIndex, end));
	let label = trimAutolinkTail(raw);
	if (label.length <= scheme[0].length) return null;

	let rest = label.slice(scheme[0].length);
	let host = rest.split(/[/?#]/)[0] ?? "";

	if (scheme[0].toLowerCase() === "www.") {
		if (!isValidHost(`www.${host}`)) return null;
		return { href: `http://${label}`, label, end: start + label.length };
	}

	if (!isValidHost(host)) return null;

	return { href: label, label, end: start + label.length };
}

/** A literal email autolink, whose local part sits before the position the scanner reached. */
export interface LiteralEmail extends Autolink {
	/** Index the address begins at, which is earlier than the at sign the scan started from. */
	start: number;
}

/**
 * Reads the literal email autolink GFM finds around an at sign, scanning back
 * through the local part and forward through the domain.
 *
 * @param subject - The leaf's text
 * @param at - Index of the `@`
 * @param rangeStart - Index the range being parsed begins at
 * @param end - Index one past the range being parsed
 * @returns The address, where it begins and where it ends, or `null` when the text holds none
 */
export function matchLiteralEmail(
	subject: string,
	at: number,
	rangeStart: number,
	end: number,
): LiteralEmail | null {
	let start = at;

	while (start > rangeStart && EMAIL_LOCAL.test(subject[start - 1] ?? "")) start -= 1;

	if (start === at) return null;
	if (!startsAtBoundary(subject, start, rangeStart)) return null;

	EMAIL_DOMAIN.lastIndex = at + 1;
	let domain = EMAIL_DOMAIN.exec(subject);
	if (!domain || EMAIL_DOMAIN.lastIndex > end) return null;

	let host = domain[0];
	while (host.endsWith(".")) host = host.slice(0, -1);

	if (host.endsWith("-") || host.endsWith("_")) return null;
	if (!isValidHost(host)) return null;

	let label = `${subject.slice(start, at + 1)}${host}`;

	return { href: `mailto:${label}`, label, start, end: at + 1 + host.length };
}
