/**
 * Scripts as shaping needs them: detecting a run's script from its text, turning an
 * ISO 15924 script into the OpenType tags a font may list it under (new Indic `dev2` tags
 * before old `deva` ones), and the direction each script is written in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { script as scriptOf } from "./unicode/properties.js";

/** Scripts whose OpenType tag is not their lowercased ISO 15924 code, tags in order of preference. */
const OPENTYPE_TAGS: Readonly<Record<string, readonly string[]>> = {
	Beng: ["bng2", "beng"],
	Deva: ["dev2", "deva"],
	Gujr: ["gjr2", "gujr"],
	Guru: ["gur2", "guru"],
	Knda: ["knd2", "knda"],
	Mlym: ["mlm2", "mlym"],
	Orya: ["ory2", "orya"],
	Taml: ["tml2", "taml"],
	Telu: ["tel2", "telu"],
	Mymr: ["mym2", "mymr"],
	Hira: ["kana"],
	Kana: ["kana"],
	Hrkt: ["kana"],
	Laoo: ["lao "],
	Yiii: ["yi  "],
	Nkoo: ["nko "],
	Vaii: ["vai "],
	Zyyy: ["DFLT"],
	Zinh: ["DFLT"],
	Zzzz: ["DFLT"],
};

/** ISO 15924 codes of the scripts written right to left. */
const RIGHT_TO_LEFT = new Set([
	"Adlm",
	"Arab",
	"Armi",
	"Avst",
	"Chrs",
	"Cprt",
	"Elym",
	"Gara",
	"Hatr",
	"Hebr",
	"Hung",
	"Khar",
	"Lydi",
	"Mand",
	"Mani",
	"Mend",
	"Merc",
	"Mero",
	"Narb",
	"Nbat",
	"Nkoo",
	"Orkh",
	"Ougr",
	"Palm",
	"Phli",
	"Phlp",
	"Phnx",
	"Prti",
	"Rohg",
	"Samr",
	"Sarb",
	"Sogd",
	"Sogo",
	"Syrc",
	"Thaa",
	"Yezi",
]);

/** An ISO 15924 code: one capital and three lowercase letters. */
const ISO_CODE = /^[A-Z][a-z]{3}$/;

/** Each OpenType tag mapped back to its ISO 15924 script, built on first use. */
const BY_TAG = new Map<string, string>();

/**
 * The script of the first character that has one: common and inherited characters (spaces,
 * digits, punctuation, combining marks) take the script of the text around them.
 *
 * @param text - The run.
 * @returns An ISO 15924 code, `"Zyyy"` when no character has a script of its own.
 */
export function detectScript(text: string): string {
	for (let character of text) {
		let found = scriptOf(character.codePointAt(0) ?? 0);
		if (found !== "Zyyy" && found !== "Zinh" && found !== "Zzzz") return found;
	}
	return "Zyyy";
}

/**
 * The OpenType script tags a font may list an ISO 15924 script under, preferred first.
 *
 * @param iso - An ISO 15924 code.
 */
export function openTypeTags(iso: string): readonly string[] {
	return OPENTYPE_TAGS[iso] ?? [iso.toLowerCase()];
}

/**
 * The ISO 15924 script an OpenType script tag stands for, `null` for `DFLT` or a tag no
 * script uses.
 *
 * @param tag - An OpenType script tag.
 */
export function isoScript(tag: string): string | null {
	if (BY_TAG.size === 0) {
		for (let [iso, tags] of Object.entries(OPENTYPE_TAGS)) {
			for (let item of tags) if (!BY_TAG.has(item)) BY_TAG.set(item, iso);
		}
	}
	if (tag === "DFLT") return null;
	let known = BY_TAG.get(tag);
	if (known !== undefined) return known;
	if (!/^[a-z]{4}$/.test(tag)) return null;
	return tag.charAt(0).toUpperCase() + tag.slice(1);
}

/**
 * The candidate OpenType tags for a script given as either an OpenType tag (tried first,
 * then its script's other tags) or an ISO 15924 code.
 *
 * @param script - `"arab"`, `"deva"`, `"Deva"`.
 */
export function scriptCandidates(script: string): string[] {
	if (ISO_CODE.test(script)) return [...openTypeTags(script)];
	let iso = isoScript(script);
	let others = iso === null ? [] : openTypeTags(iso).filter((tag) => tag !== script);
	return [script, ...others];
}

/**
 * The direction a script is written in.
 *
 * @param iso - An ISO 15924 code, or `null`.
 */
export function scriptDirection(iso: string | null): "ltr" | "rtl" {
	return iso !== null && RIGHT_TO_LEFT.has(iso) ? "rtl" : "ltr";
}
