/**
 * The shaper for joining scripts (Arabic, Syriac, Mongolian, N'Ko, Phags-pa, Mandaic,
 * Manichaean, Psalter Pahlavi): a joining state machine picks each letter's positional form
 * (`isol`, `init`, `medi`, `fina` and the Syriac `fin2`/`fin3`/`med2`), one stage per form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GlyphInfo } from "../glyph-info.js";
import type { NormalizationCharacter } from "../normalize.js";
import type { ShapingPlan } from "../plan.js";
import type { JoiningType } from "../unicode/properties.js";

import { joiningType } from "../unicode/properties.js";

import { DefaultShaper } from "./default.js";

/** The positional form features, each applied in a stage of its own in this order. */
const FORM_FEATURES = ["isol", "fina", "fin2", "fin3", "medi", "med2", "init"];

/**
 * Hamza above and below and the small high letters, which UTR #53 moves to the start of
 * their mark run so they combine with the letter before the vowels do.
 */
const MODIFIER_COMBINING_MARKS = new Set([
	0x0654, 0x0655, 0x0658, 0x06dc, 0x06e3, 0x06e7, 0x06e8, 0x08ca, 0x08cb, 0x08cd, 0x08ce, 0x08cf,
	0x08d3, 0x08f3,
]);

/** The state machine's input class for each joining type; join-causing joins like dual-joining. */
const JOINING_CLASSES: Readonly<Record<JoiningType, number>> = {
	U: 0,
	L: 1,
	R: 2,
	D: 3,
	C: 3,
	ALAPH: 4,
	DALATH_RISH: 5,
	T: 6,
};

/** The input class of transparent characters, which the state machine skips. */
const TRANSPARENT = 6;

/** One transition: the form for the previous joining letter, the current one's form, the next state. */
type Transition = readonly [string | null, string | null, number];

/**
 * The joining state machine, by state then input class (non-joining, left, right, dual,
 * alaph, dalath-rish). States: 0 after a non-joining character; 1 after a right-joining
 * letter or alaph; 2 after an isolated dual or left letter; 3 after a final dual letter;
 * 4 after a final alaph; 5 after a `fin2`/`fin3` alaph; 6 after dalath or rish.
 */
const STATE_TABLE: readonly (readonly Transition[])[] = [
	[
		[null, null, 0],
		[null, "isol", 2],
		[null, "isol", 1],
		[null, "isol", 2],
		[null, "isol", 1],
		[null, "isol", 6],
	],
	[
		[null, null, 0],
		[null, "isol", 2],
		[null, "isol", 1],
		[null, "isol", 2],
		[null, "fin2", 5],
		[null, "isol", 6],
	],
	[
		[null, null, 0],
		[null, "isol", 2],
		["init", "fina", 1],
		["init", "fina", 3],
		["init", "fina", 4],
		["init", "fina", 6],
	],
	[
		[null, null, 0],
		[null, "isol", 2],
		["medi", "fina", 1],
		["medi", "fina", 3],
		["medi", "fina", 4],
		["medi", "fina", 6],
	],
	[
		[null, null, 0],
		[null, "isol", 2],
		["med2", "isol", 1],
		["med2", "isol", 2],
		["med2", "fin2", 5],
		["med2", "isol", 6],
	],
	[
		[null, null, 0],
		[null, "isol", 2],
		["isol", "isol", 1],
		["isol", "isol", 2],
		["isol", "fin2", 5],
		["isol", "isol", 6],
	],
	[
		[null, null, 0],
		[null, "isol", 2],
		[null, "isol", 1],
		[null, "isol", 2],
		[null, "fin3", 5],
		[null, "isol", 6],
	],
];

/**
 * Shapes cursive joining scripts: letters get the positional form their neighbours call
 * for, with marks and other transparent characters skipped when deciding who joins whom.
 */
export class ArabicShaper extends DefaultShaper {
	/**
	 * Composition and localized forms first, then each positional form in its own stage so a
	 * form's lookups see the forms before it, then `mset` for mark placement.
	 *
	 * @param plan - The plan.
	 */
	override planFeatures(plan: ShapingPlan) {
		plan.add(["ccmp", "locl"]);
		for (let tag of FORM_FEATURES) plan.addStage(tag, false);
		plan.addStage("mset");
	}

	/**
	 * Moves modifier combining marks to the start of their run of class 220 or 230 marks and
	 * gives them a class below every Arabic mark, so the run stays sorted.
	 *
	 * @param characters - The cluster's characters, marks sorted by combining class.
	 * @param start - Index of the run's first mark.
	 * @param end - One past its last mark.
	 */
	override reorderMarks(characters: NormalizationCharacter[], start: number, end: number) {
		let index = start;
		let insertAt = start;
		for (let combiningClass of [220, 230]) {
			while (index < end && (characters[index]?.combiningClass ?? 0) < combiningClass) index++;
			if (index === end) break;
			if (characters[index]?.combiningClass !== combiningClass) continue;
			let last = index;
			while (last < end && isModifierMark(characters[last], combiningClass)) last++;
			let marks = characters.splice(index, last - index);
			for (let mark of marks) mark.combiningClass = combiningClass === 220 ? 22 : 26;
			characters.splice(insertAt, 0, ...marks);
			insertAt += marks.length;
			index = last;
		}
	}

	/**
	 * Normalizes, then runs the joining state machine and enables each letter's positional
	 * form; a letter's form is settled once the next joining letter is seen.
	 *
	 * @param plan - The plan.
	 * @param glyphs - The buffer.
	 */
	override assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]) {
		super.assignFeatures(plan, glyphs);
		let actions: (string | null)[] = Array.from({ length: glyphs.length }, () => null);
		let previous = -1;
		let state = 0;
		for (let index = 0; index < glyphs.length; index++) {
			let type = joiningClass(glyphs[index]?.codePoints[0] ?? 0);
			if (type === TRANSPARENT) continue;
			let transition = STATE_TABLE[state]?.[type];
			if (transition === undefined) continue;
			let [previousAction, currentAction, next] = transition;
			if (previousAction !== null && previous !== -1) actions[previous] = previousAction;
			actions[index] = currentAction;
			state = next;
			previous = index;
		}
		for (let index = 0; index < glyphs.length; index++) {
			let action = actions[index];
			if (action !== null && action !== undefined) glyphs[index]?.features.add(action);
		}
	}
}

/**
 * Whether a character is a modifier combining mark still in the given combining class.
 *
 * @param character - A character of the mark run, `undefined` past its end.
 * @param combiningClass - The class being moved, 220 or 230.
 */
function isModifierMark(
	character: NormalizationCharacter | undefined,
	combiningClass: number,
): boolean {
	return (
		character !== undefined &&
		character.combiningClass === combiningClass &&
		MODIFIER_COMBINING_MARKS.has(character.codePoint)
	);
}

/**
 * The state machine's input class of a character.
 *
 * @param codePoint - A code point.
 */
function joiningClass(codePoint: number): number {
	return JOINING_CLASSES[joiningType(codePoint)];
}
