/**
 * Scanner behind the two rules public-facing copy must follow: no price restated
 * as a literal, and no unsubstantiated social-proof claim. Given a module's
 * source, it reports each offending string literal so the guard can name the line.
 *
 * Both catch a failure that type-checks and renders perfectly: a hardcoded price
 * goes stale the moment pricing changes, and an invented customer count costs a
 * monitoring product the credibility it sells.
 *
 * The scan reads string literals directly: an interpolated figure and a
 * hardcoded one render identically, so only source text still tells them apart.
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
 * Figures the pricing model owns. Paired with {@link PRICING_CONTEXT}, a match
 * flags a restatement of what `~/app/lib/pricing` already knows — written as
 * digit-grouped and bare alternatives so the rule stays specific to *our* numbers.
 */
const PRICING_FIGURES = /\b(100[,.]?000|10[,.]?000|100000|10000)\b/;

/** A currency amount spelled out, which is never correct in copy regardless of context. */
const CURRENCY_LITERAL = /\$\s?\d/;

/**
 * Unsubstantiated claims, as the phrasings they actually get written in.
 * `guaranteed`/`SLA` sit here because the Terms decline to offer either, so any
 * surface promising one contradicts the contract regardless of which page it's on.
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
 * Every string literal in `source`, with the line it starts on. Walks the
 * source by hand, since a regex misreads a possessive quote inside a template
 * string as a closing one; comments are skipped as out of scope.
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
 * Reports every string literal in `source` that restates a price or claims
 * social proof. A literal carrying an i18n placeholder for the figure passes,
 * since the pricing module supplies that number fresh at render time.
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
