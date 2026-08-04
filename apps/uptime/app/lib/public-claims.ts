/**
 * Scanner behind the two rules every piece of public-facing copy in this app has to
 * follow: it must not restate a price as a literal, and it must not claim social proof
 * we cannot show. Given a module's source it reports each string literal that breaks
 * either one, with the offending text, so the guard beside it can name the line.
 *
 * Both rules are about a failure that type-checks and renders perfectly. A hardcoded
 * `"$5/mo includes 100,000 pings"` goes stale the day pricing changes and nothing points
 * at it — this app shipped exactly that string in a dead locale namespace for months. And
 * an invented customer count is the kind of copy that costs a monitoring product the only
 * thing it sells, while looking like ordinary marketing in review.
 *
 * The scan is deliberately over string *literals* rather than rendered output, because at
 * runtime an interpolated figure and a hardcoded one are the same characters. Source text
 * is the only place the difference is still visible: copy that reads pricing through
 * `~/app/lib/pricing` or an i18n `{{placeholder}}` cannot go stale, and copy that spells
 * the number out can.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Which rule a violation broke, so the guard can report the two separately. */
export type ClaimRule = "pricing-literal" | "social-proof";

/** One string literal that broke a rule. */
export interface ClaimViolation {
	rule: ClaimRule;
	/** 1-indexed line the literal starts on. */
	line: number;
	/** The literal's contents, truncated for a readable failure message. */
	text: string;
	/** What specifically matched, so the fix is obvious from the message alone. */
	match: string;
}

/** How much of an offending literal a failure message quotes. */
const QUOTE_LIMIT = 120;

/**
 * Vocabulary that makes a number in a string a *pricing* number rather than a timeout, a
 * row count, or a retention window. A figure only trips the rule in this company, which is
 * what keeps `timeout_ms` defaults of `60000` and "tens of thousands of rows" out of it.
 */
const PRICING_CONTEXT = /\b(ping|pings|month|months|\/mo\b|included|block|blocks|billed|bill)\b/i;

/**
 * Figures the pricing model owns. Any of these inside a string that also carries
 * {@link PRICING_CONTEXT} is a restatement of something `~/app/lib/pricing` already knows.
 *
 * Written as digit-grouped and bare alternatives rather than one loose `\d` pattern so the
 * rule stays specific to *our* numbers: a page may say "every 5 minutes" freely.
 */
const PRICING_FIGURES = /\b(100[,.]?000|10[,.]?000|100000|10000)\b/;

/** A currency amount spelled out, which is never correct in copy regardless of context. */
const CURRENCY_LITERAL = /\$\s?\d/;

/**
 * Claims we cannot substantiate, as the phrasings they actually get written in.
 *
 * `guaranteed`/`SLA` are here rather than under a separate rule because the Terms decline
 * to offer one in as many words, so any marketing surface promising it contradicts the
 * contract. The Terms' own disclosure is exempted by the guard, not by this list — the
 * scanner has no idea which file it is reading.
 */
const SOCIAL_PROOF = [
	/\bthousands of\b/i,
	/\bhundreds of\b/i,
	/\bmillions of\b/i,
	/\bteams are switching\b/i,
	/\bjoin \d/i,
	/\bjoin (?:thousands|hundreds|millions|teams)\b/i,
	/\btrusted by\b/i,
	/\d[\d,]*\+?\s+(?:teams|customers|users|companies|agencies|developers)\s+(?:trust|use|rely|choose)/i,
	/\bloved by\b/i,
	/\bsla guaranteed\b/i,
	/\bguaranteed uptime\b/i,
	/\bindustry[- ]leading\b/i,
];

/**
 * Every string literal in `source`, with the line it starts on.
 *
 * A hand-rolled walk rather than a regex, because the alternative has to decide whether a
 * quote inside a literal opens a new one, and it always gets that wrong on a possessive in
 * a template string. Comments are skipped: the rules are about copy a visitor can read,
 * and a docblock quoting `"$5/mo"` to explain the rule is not a violation of it.
 */
function stringLiterals(source: string): Array<{ line: number; text: string }> {
	let literals: Array<{ line: number; text: string }> = [];
	let line = 1;

	for (let i = 0; i < source.length; i++) {
		let char = source[i];

		if (char === "\n") {
			line++;
			continue;
		}

		// Skip comments wholesale, both flavours.
		if (char === "/" && source[i + 1] === "/") {
			while (i < source.length && source[i] !== "\n") i++;
			line++;
			continue;
		}

		if (char === "/" && source[i + 1] === "*") {
			i += 2;
			while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
				if (source[i] === "\n") line++;
				i++;
			}
			i++;
			continue;
		}

		if (char !== '"' && char !== "'" && char !== "`") continue;

		// Collect to the matching close, honouring escapes and counting newlines so the
		// reported line stays right for multi-line template literals.
		let quote = char;
		let startLine = line;
		let text = "";

		for (i++; i < source.length; i++) {
			if (source[i] === "\\") {
				text += source[i + 1] ?? "";
				i++;
				continue;
			}

			if (source[i] === quote) break;
			if (source[i] === "\n") line++;

			text += source[i];
		}

		literals.push({ line: startLine, text });
	}

	return literals;
}

/**
 * Reports every string literal in `source` that restates a price or claims social proof.
 *
 * A literal carrying an i18n placeholder or a template expression for the figure is not a
 * restatement, so `"{{price}}/month includes {{included}} pings"` passes: the numbers
 * arrive from the pricing module at render time and cannot drift.
 *
 * @param source - A module's full text.
 * @returns Violations in source order; empty when the module is clean.
 * @example findClaimViolations('let a = "$5/mo includes 100,000 pings";')
 */
export function findClaimViolations(source: string): ClaimViolation[] {
	let violations: ClaimViolation[] = [];

	for (let { line, text } of stringLiterals(source)) {
		let quoted = text.length > QUOTE_LIMIT ? `${text.slice(0, QUOTE_LIMIT)}…` : text;

		for (let pattern of SOCIAL_PROOF) {
			let hit = pattern.exec(text);
			if (hit) violations.push({ rule: "social-proof", line, text: quoted, match: hit[0] });
		}

		let currency = CURRENCY_LITERAL.exec(text);
		if (currency) {
			violations.push({ rule: "pricing-literal", line, text: quoted, match: currency[0] });
			continue;
		}

		if (!PRICING_CONTEXT.test(text)) continue;

		let figure = PRICING_FIGURES.exec(text);
		if (figure) {
			violations.push({ rule: "pricing-literal", line, text: quoted, match: figure[0] });
		}
	}

	return violations;
}
