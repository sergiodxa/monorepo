/**
 * Named and numeric character references, resolved to the characters they stand
 * for. The table is the three XHTML 1.0 entity sets packed into one string and
 * expanded on first use, so a bundle carries bytes rather than an object literal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every XHTML 1.0 name followed by its codepoint in base 36, space separated.
 * Base 36 keeps the longest codepoint to three characters, which is what holds
 * the whole set to roughly two kilobytes of source.
 */
const PACKED =
	"nbsp 4g iexcl 4h cent 4i pound 4j curren 4k yen 4l brvbar 4m sect 4n uml 4o copy 4p ordf 4q laquo 4r not 4s shy 4t reg 4u macr 4v deg 4w plusmn 4x sup2 4y sup3 4z acute 50 micro 51 para 52 middot 53 cedil 54 sup1 55 ordm 56 raquo 57 frac14 58 frac12 59 frac34 5a iquest 5b Agrave 5c Aacute 5d Acirc 5e Atilde 5f Auml 5g Aring 5h AElig 5i Ccedil 5j Egrave 5k Eacute 5l Ecirc 5m Euml 5n Igrave 5o Iacute 5p Icirc 5q Iuml 5r ETH 5s Ntilde 5t Ograve 5u Oacute 5v Ocirc 5w Otilde 5x Ouml 5y times 5z Oslash 60 Ugrave 61 Uacute 62 Ucirc 63 Uuml 64 Yacute 65 THORN 66 szlig 67 agrave 68 aacute 69 acirc 6a atilde 6b auml 6c aring 6d aelig 6e ccedil 6f egrave 6g eacute 6h ecirc 6i euml 6j igrave 6k iacute 6l icirc 6m iuml 6n eth 6o ntilde 6p ograve 6q oacute 6r ocirc 6s otilde 6t ouml 6u divide 6v oslash 6w ugrave 6x uacute 6y ucirc 6z uuml 70 yacute 71 thorn 72 yuml 73 OElig 9e oelig 9f Scaron 9s scaron 9t Yuml ag circ jq tilde kc ensp 6bm emsp 6bn thinsp 6bt zwnj 6bw zwj 6bx lrm 6by rlm 6bz ndash 6c3 mdash 6c4 lsquo 6c8 rsquo 6c9 sbquo 6ca ldquo 6cc rdquo 6cd bdquo 6ce dagger 6cg Dagger 6ch permil 6cw lsaquo 6d5 rsaquo 6d6 euro 6gc fnof b6 Alpha pd Beta pe Gamma pf Delta pg Epsilon ph Zeta pi Eta pj Theta pk Iota pl Kappa pm Lambda pn Mu po Nu pp Xi pq Omicron pr Pi ps Rho pt Sigma pv Tau pw Upsilon px Phi py Chi pz Psi q0 Omega q1 alpha q9 beta qa gamma qb delta qc epsilon qd zeta qe eta qf theta qg iota qh kappa qi lambda qj mu qk nu ql xi qm omicron qn pi qo rho qp sigmaf qq sigma qr tau qs upsilon qt phi qu chi qv psi qw omega qx thetasym r5 upsih r6 piv ra bull 6ci hellip 6cm prime 6cy Prime 6cz oline 6da frasl 6dg weierp 6jc image 6j5 real 6jg trade 6jm alefsym 6k5 larr 6mo uarr 6mp rarr 6mq darr 6mr harr 6ms crarr 6np lArr 6og uArr 6oh rArr 6oi dArr 6oj hArr 6ok forall 6ps part 6pu exist 6pv empty 6px nabla 6pz isin 6q0 notin 6q1 ni 6q3 prod 6q7 sum 6q9 minus 6qa lowast 6qf radic 6qi prop 6ql infin 6qm ang 6qo and 6qv or 6qw cap 6qx cup 6qy int 6qz there4 6r8 sim 6rg cong 6rp asymp 6rs ne 6sg equiv 6sh le 6sk ge 6sl sub 6te sup 6tf nsub 6tg sube 6ti supe 6tj oplus 6tx otimes 6tz perp 6ud sdot 6v9 lceil 6x4 rceil 6x5 lfloor 6x6 rfloor 6x7 lang 6y1 rang 6y2 loz 7gq spades 7kw clubs 7kz hearts 7l1 diams 7l2 amp 12 lt 1o gt 1q quot y apos 13";

/** What CommonMark renders for a reference naming no character. */
const REPLACEMENT = "\uFFFD";

/** The highest codepoint Unicode assigns, above which a numeric reference names nothing. */
const MAX_CODEPOINT = 0x10ffff;

/** A hexadecimal numeric reference, which CommonMark caps at six digits. */
const HEX = /^#[Xx]([0-9A-Fa-f]{1,6});/;

/** A decimal numeric reference, which CommonMark caps at seven digits. */
const DECIMAL = /^#([0-9]{1,7});/;

/** A named reference, whose name is alphanumeric and always closed by a semicolon. */
const NAMED = /^([A-Za-z][A-Za-z0-9]{1,31});/;

/** Expanded on the first decode, because a document writing no reference never pays for it. */
let table: Map<string, string> | null = null;

/** One resolved reference and where the text after it resumes. */
export interface DecodedEntity {
	value: string;
	/** Index one past the closing semicolon. */
	end: number;
}

/**
 * Expands {@link PACKED} once and keeps it, so repeated references across a
 * document share one map.
 *
 * @returns Every named entity, keyed by the name written between the delimiters
 */
function entities(): Map<string, string> {
	if (table) return table;

	table = new Map();

	let parts = PACKED.split(" ");
	for (let index = 0; index < parts.length; index += 2) {
		let name = parts[index];
		let code = parts[index + 1];
		if (name === undefined || code === undefined) continue;
		table.set(name, String.fromCodePoint(Number.parseInt(code, 36)));
	}

	return table;
}

/**
 * Applies the substitutions CommonMark requires of a numeric reference, so a
 * document naming NUL, a surrogate, or a codepoint past the last plane still
 * produces text a renderer can write.
 *
 * @param code - The codepoint the reference named
 * @returns The character it stands for
 */
function fromCodePoint(code: number): string {
	if (code === 0 || code > MAX_CODEPOINT) return REPLACEMENT;
	if (code >= 0xd800 && code <= 0xdfff) return REPLACEMENT;
	return String.fromCodePoint(code);
}

/**
 * Reads the character reference opening at `start`, which is where an ampersand
 * sits.
 *
 * @param text - The text to read
 * @param start - Index of the `&`
 * @returns The character the reference stands for and where the text resumes, or `null` when it names nothing
 * @example decodeEntity("a &amp; b", 2)
 */
export function decodeEntity(text: string, start: number): DecodedEntity | null {
	if (text[start] !== "&") return null;

	let rest = text.slice(start + 1, start + 1 + 34);

	let hex = HEX.exec(rest);
	if (hex?.[1]) {
		return { value: fromCodePoint(Number.parseInt(hex[1], 16)), end: start + 1 + hex[0].length };
	}

	let decimal = DECIMAL.exec(rest);
	if (decimal?.[1]) {
		return {
			value: fromCodePoint(Number.parseInt(decimal[1], 10)),
			end: start + 1 + decimal[0].length,
		};
	}

	let named = NAMED.exec(rest);
	if (!named?.[1]) return null;

	let value = entities().get(named[1]);
	if (value === undefined) return null;

	return { value, end: start + 1 + named[0].length };
}
