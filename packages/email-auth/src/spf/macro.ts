/**
 * SPF macros (RFC 7208 §7): parsing a macro-string into literals and `%{…}` expansions,
 * and expanding it against the message being checked, with the reversal, right-hand part
 * counts, custom delimiters, URL escaping and 253-character truncation the spec defines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The letters a macro may expand. */
type MacroLetter = "s" | "l" | "o" | "d" | "i" | "p" | "h" | "c" | "r" | "t" | "v";

/** Letters only an `exp` explanation may use. */
const EXPLANATION_ONLY = new Set<MacroLetter>(["c", "r", "t"]);

/** RFC 3986's unreserved characters, the ones an uppercase macro leaves unescaped. */
const UNRESERVED = /[A-Za-z0-9\-._~]/;

/** The longest domain name, in its dotted text form. */
const MAX_DOMAIN_LENGTH = 253;

/** One `%{…}` expansion. */
export interface MacroExpand {
	kind: "macro";
	letter: MacroLetter;
	/** An uppercase letter, whose expansion is URL-escaped. */
	escape: boolean;
	/** How many right-hand parts to keep; `null` keeps all. */
	digits: number | null;
	reverse: boolean;
	/** The characters to split on; `.` when none are given. */
	delimiters: string;
}

/** A macro-string as literal text runs and expansions, in order. */
export type MacroToken = string | MacroExpand;

/** The facts about the message that macros expand to. */
export interface MacroContext {
	/** `<sender>`, with `postmaster` as the local-part when it had none. */
	sender: string;
	/** The domain being evaluated, which changes across `include` and `redirect`. */
	domain: string;
	/** The client IP, IPv4 dotted or IPv6 in canonical form. */
	ip: string;
	/** The HELO/EHLO name, `unknown` when not given. */
	helo: string;
	/** The validated domain name of the IP, `unknown` when there is none. */
	validatedName: string;
	/** The checking host's name, for explanations. */
	receiver: string;
	/** Seconds since the epoch, for explanations. */
	timestamp: number;
}

/**
 * Parses a macro-string. A `%` that does not start `%{…}`, `%%`, `%_` or `%-`, an
 * unknown letter, a zero digit count, or a character outside the visible ASCII range
 * makes it invalid.
 *
 * @param text - The macro-string as written.
 * @returns The tokens, or `null` for a syntax error.
 * @example parseMacroString("%{ir}.%{v}._spf.%{d2}")
 */
export function parseMacroString(text: string): MacroToken[] | null {
	let tokens: MacroToken[] = [];
	let literal = "";
	let index = 0;

	while (index < text.length) {
		let char = text[index] ?? "";
		if (char !== "%") {
			if (!/^[\x21-\x7E]$/.test(char)) return null;
			literal += char;
			index += 1;
			continue;
		}

		let next = text[index + 1];
		if (next === "%" || next === "_" || next === "-") {
			literal += { "%": "%", _: " ", "-": "%20" }[next];
			index += 2;
			continue;
		}

		let match = /^%\{([slodiphcrtv])(\d*)(r?)([.\-+,/_=]*)\}/i.exec(text.slice(index));
		if (!match) return null;
		let [whole, letter = "", digits = "", reverse = "", delimiters = ""] = match;
		if (digits !== "" && Number(digits) === 0) return null;

		if (literal !== "") tokens.push(literal);
		literal = "";
		tokens.push({
			kind: "macro",
			letter: letter.toLowerCase() as MacroLetter,
			escape: letter !== letter.toLowerCase(),
			digits: digits === "" ? null : Number(digits),
			reverse: reverse !== "",
			delimiters: delimiters || ".",
		});
		index += whole.length;
	}

	if (literal !== "") tokens.push(literal);
	return tokens;
}

/** Whether a macro-string expands `%{p}`, which costs DNS queries to compute. */
export function usesValidatedName(tokens: readonly MacroToken[]): boolean {
	return tokens.some((token) => typeof token !== "string" && token.letter === "p");
}

/**
 * Expands parsed tokens. Outside an explanation, `c`, `r` and `t` are syntax errors and a
 * result longer than 253 characters loses labels from the left until it fits.
 *
 * @param tokens - The parsed macro-string.
 * @param context - The message's facts.
 * @param explanation - Whether this is `exp` text, where `c`, `r` and `t` are allowed.
 * @returns The expansion, or `null` when it uses a letter the position does not allow.
 * @example expandMacros(parseMacroString("%{d2}") ?? [], context) // "example.com"
 */
export function expandMacros(
	tokens: readonly MacroToken[],
	context: MacroContext,
	explanation = false,
): string | null {
	let output = "";
	for (let token of tokens) {
		if (typeof token === "string") {
			output += token;
			continue;
		}
		if (!explanation && EXPLANATION_ONLY.has(token.letter)) return null;
		let value = transform(letterValue(token.letter, context), token);
		output += token.escape ? escapeValue(value) : value;
	}
	return explanation ? output : truncateDomain(output);
}

/** The raw value a letter stands for. */
function letterValue(letter: MacroLetter, context: MacroContext): string {
	let at = context.sender.lastIndexOf("@");
	switch (letter) {
		case "s":
			return context.sender;
		case "l":
			return context.sender.slice(0, at);
		case "o":
			return context.sender.slice(at + 1);
		case "d":
			return context.domain;
		case "i":
			return dottedAddress(context.ip);
		case "p":
			return context.validatedName;
		case "v":
			return context.ip.includes(":") ? "ip6" : "in-addr";
		case "h":
			return context.helo;
		case "c":
			return context.ip;
		case "r":
			return context.receiver;
		case "t":
			return String(context.timestamp);
	}
}

/**
 * Applies the transformers: split on the delimiters, reverse, keep the right-hand parts,
 * and rejoin with dots.
 */
function transform(value: string, token: MacroExpand): string {
	if (token.digits === null && !token.reverse && token.delimiters === ".") return value;
	let pattern = new RegExp(`[${token.delimiters.replace(/[-\\\]^]/g, "\\$&")}]`);
	let parts = value.split(pattern);
	if (token.reverse) parts.reverse();
	if (token.digits !== null && token.digits < parts.length) parts = parts.slice(-token.digits);
	return parts.join(".");
}

/**
 * An address in the dotted form `%{i}` uses: IPv4 unchanged, IPv6 as 32 nibbles
 * separated by dots, which `%{ir}` reverses into its `ip6.arpa` name.
 */
export function dottedAddress(ip: string): string {
	if (!ip.includes(":")) return ip;
	return expandIPv6(ip).replaceAll(":", "").split("").join(".");
}

/** An IPv6 address written out in full: eight four-digit groups. */
function expandIPv6(ip: string): string {
	let [head = "", tail] = ip.toLowerCase().split("::");
	let left = head === "" ? [] : head.split(":");
	let right = tail === undefined || tail === "" ? [] : tail.split(":");
	let missing = 8 - left.length - right.length;
	let groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
	return groups.map((group) => group.padStart(4, "0")).join(":");
}

/** URL-escapes every character outside RFC 3986's unreserved set. */
function escapeValue(value: string): string {
	let escaped = "";
	for (let char of value) {
		if (UNRESERVED.test(char)) escaped += char;
		else
			for (let byte of new TextEncoder().encode(char)) {
				escaped += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
			}
	}
	return escaped;
}

/** Drops labels from the left until a name fits the 253-character limit. */
function truncateDomain(name: string): string {
	let result = name;
	while (result.length > MAX_DOMAIN_LENGTH && result.includes(".")) {
		result = result.slice(result.indexOf(".") + 1);
	}
	return result;
}
