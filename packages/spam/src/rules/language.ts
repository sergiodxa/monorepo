/**
 * The language rule: a site written in one language rarely receives genuine comments in a
 * writing system none of its languages use, and SEO spam is often posted everywhere unchanged.
 * It compares scripts rather than detecting languages, which needs no model or word list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

/** The Unicode scripts each ISO 15924 code `Intl.Locale#maximize` reports is written in. */
const SCRIPTS_BY_CODE: Record<string, string[]> = {
	Latn: ["Latin"],
	Cyrl: ["Cyrillic"],
	Grek: ["Greek"],
	Arab: ["Arabic"],
	Hebr: ["Hebrew"],
	Hans: ["Han"],
	Hant: ["Han"],
	Jpan: ["Han", "Hiragana", "Katakana"],
	Kore: ["Hangul", "Han"],
	Thai: ["Thai"],
	Deva: ["Devanagari"],
	Beng: ["Bengali"],
	Taml: ["Tamil"],
	Armn: ["Armenian"],
	Geor: ["Georgian"],
	Ethi: ["Ethiopic"],
};

/** Every script this rule can attribute letters to, each with the pattern matching its letters. */
const SCRIPT_PATTERNS: Array<[string, RegExp]> = [
	...new Set(Object.values(SCRIPTS_BY_CODE).flat()),
].map((script) => [script, new RegExp(`\\p{Script=${script}}`, "u")]);

/**
 * Scores content whose letters are mostly (over `ratio` of at least `minLetters`) in scripts none
 * of {@link Submission.languages} is written in. A submission without `languages`, or with a tag
 * whose script is unknown, draws nothing.
 *
 * @example language({ ratio: 0.8 })
 */
export function language(options: language.Options = {}): SpamCheck {
	let ratio = options.ratio ?? 0.5;
	let minLetters = options.minLetters ?? 20;
	let score = options.score ?? 5;

	return {
		name: "language",
		stage: "local",
		check(submission): Signal[] {
			let expected = expectedScripts(submission.languages ?? []);
			if (expected === null) return [];

			let letters = 0;
			let foreign = 0;
			for (let character of submission.content) {
				if (!/\p{L}/u.test(character)) continue;
				letters++;
				let script = SCRIPT_PATTERNS.find(([, pattern]) => pattern.test(character))?.[0];
				if (script !== undefined && !expected.has(script)) foreign++;
			}
			if (letters < minLetters || foreign / letters <= ratio) return [];
			return [
				{
					check: "language.script",
					score,
					detail: `${Math.round((foreign / letters) * 100)}% of letters in a script the site does not use`,
				},
			];
		},
	};
}

/** The scripts `tags` are written in, or `null` when there are none or one is unknown. */
function expectedScripts(tags: string[]): Set<string> | null {
	if (tags.length === 0) return null;
	let scripts = new Set<string>();
	for (let tag of tags) {
		let code: string | undefined;
		try {
			code = new Intl.Locale(tag).maximize().script;
		} catch {
			return null;
		}
		let known = code === undefined ? undefined : SCRIPTS_BY_CODE[code];
		if (known === undefined) return null;
		for (let script of known) scripts.add(script);
	}
	return scripts;
}

/** The options {@link language} takes. */
export namespace language {
	/** Limits and weight for the language rule. */
	export interface Options {
		/** @default 0.5 */
		ratio?: number;
		/** @default 20 */
		minLetters?: number;
		/** @default 5 */
		score?: number;
	}
}
