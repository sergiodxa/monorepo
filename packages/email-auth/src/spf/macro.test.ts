/**
 * Covers SPF macro parsing and expansion with RFC 7208 §7.4's expansion table as the
 * fixture, plus the escaping, explanation-only letters and syntax errors §7 defines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { MacroContext } from "./macro.js";

import { expandMacros, parseMacroString } from "./macro.js";

/** §7.4's message: the sender, the IPv4 client, and its PTR name. */
const CONTEXT: MacroContext = {
	sender: "strong-bad@email.example.com",
	domain: "email.example.com",
	ip: "192.0.2.3",
	helo: "mx.example.org",
	validatedName: "mx.example.org",
	receiver: "receiver.example.net",
	timestamp: 1_700_000_000,
};

/** Expands a macro-string the test knows parses. */
function expand(text: string, context: MacroContext = CONTEXT, explanation = false): string | null {
	let tokens = parseMacroString(text);
	if (tokens === null) throw new Error(`${text} does not parse`);
	return expandMacros(tokens, context, explanation);
}

describe("expandMacros", () => {
	test.each([
		["%{s}", "strong-bad@email.example.com"],
		["%{o}", "email.example.com"],
		["%{d}", "email.example.com"],
		["%{d4}", "email.example.com"],
		["%{d3}", "email.example.com"],
		["%{d2}", "example.com"],
		["%{d1}", "com"],
		["%{dr}", "com.example.email"],
		["%{d2r}", "example.email"],
		["%{l}", "strong-bad"],
		["%{l-}", "strong.bad"],
		["%{lr}", "strong-bad"],
		["%{lr-}", "bad.strong"],
		["%{l1r-}", "strong"],
		["%{ir}.%{v}._spf.%{d2}", "3.2.0.192.in-addr._spf.example.com"],
		["%{lr-}.lp._spf.%{d2}", "bad.strong.lp._spf.example.com"],
		["%{lr-}.lp.%{ir}.%{v}._spf.%{d2}", "bad.strong.lp.3.2.0.192.in-addr._spf.example.com"],
		["%{ir}.%{v}.%{l1r-}.lp._spf.%{d2}", "3.2.0.192.in-addr.strong.lp._spf.example.com"],
		["%{d2}.trusted-domains.example.net", "example.com.trusted-domains.example.net"],
	])("expands §7.4's %s", (macro, expected) => {
		expect(expand(macro)).toBe(expected);
	});

	test("expands §7.4's IPv6 example into nibbles", () => {
		expect(expand("%{ir}.%{v}._spf.%{d2}", { ...CONTEXT, ip: "2001:db8::cb01" })).toBe(
			"1.0.b.c.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6._spf.example.com",
		);
	});

	test("expands the escapes", () => {
		expect(expand("a%%b%_c%-d", CONTEXT, true)).toBe("a%b c%20d");
	});

	test("URL-escapes an uppercase macro", () => {
		expect(expand("%{S}", { ...CONTEXT, sender: "a b@example.com" })).toBe("a%20b%40example.com");
	});

	test("allows c, r and t only in explanations", () => {
		expect(expand("%{c} %{r} %{t}".replaceAll(" ", "%_"), CONTEXT, true)).toBe(
			"192.0.2.3 receiver.example.net 1700000000",
		);
		expect(expand("%{c}.example.com")).toBeNull();
	});

	test("truncates a name over 253 characters from the left", () => {
		let expanded = expand("%{s}.example.com", { ...CONTEXT, sender: `${"a.".repeat(140)}x@y` });
		expect(expanded?.length).toBeLessThanOrEqual(253);
		expect(expanded?.endsWith(".example.com")).toBe(true);
	});
});

describe("parseMacroString", () => {
	test.each(["%(ir).sbl.example.org", "%{x}", "%{d0}", "%", "a b"])("rejects %j", (text) => {
		expect(parseMacroString(text)).toBeNull();
	});
});
