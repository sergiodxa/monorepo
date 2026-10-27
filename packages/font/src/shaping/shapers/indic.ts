/**
 * The Indic shaper, for Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu,
 * Kannada, Malayalam, Sinhala and Khmer: it splits the run into syllables, finds each
 * syllable's base consonant, reorders matras, reph and pre-base forms around it, and enables
 * the conjunct-forming features on the glyphs each one belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GsubProcessor } from "../gsub.js";
import type { ShapingPlan, StageContext } from "../plan.js";

import { GlyphInfo } from "../glyph-info.js";
import { isoScript } from "../scripts.js";
import { generalCategory, script } from "../unicode/properties.js";

import type { IndicConfig } from "./indic-data.js";

import { DefaultShaper } from "./default.js";
import {
	CATEGORIES,
	CONSONANT_FLAGS,
	HALANT_OR_COENG_FLAGS,
	INDIC_DECOMPOSITIONS,
	JOINER_FLAGS,
	POSITIONS,
	indicCategory,
	indicConfig,
	indicPosition,
	vowelDecomposition,
} from "./indic-data.js";
import { indicSyllables } from "./indic-machine.js";

/** The dotted circle, which stands in for the missing base of a broken syllable. */
const DOTTED_CIRCLE = 0x25cc;

/** Features applied after final reordering, to the whole syllable. */
const PRESENTATION_FEATURES = [
	"pres",
	"abvs",
	"blws",
	"psts",
	"haln",
	"dist",
	"abvm",
	"blwm",
	"calt",
	"clig",
];

/** What the shaper records on each glyph between its stages. */
export class IndicInfo {
	/** A flag of `CATEGORIES`. */
	category: number;
	/** A flag of `POSITIONS`. */
	position: number;
	/** The syllable machine rule that matched, `"non_indic_cluster"` outside any syllable. */
	syllableType: string;
	/** A serial number shared by the glyphs of one syllable. */
	syllable: number;

	/**
	 * @param category - The shaping category flag.
	 * @param position - The position flag.
	 * @param syllableType - The syllable's type.
	 * @param syllable - The syllable's serial number.
	 */
	constructor(category: number, position: number, syllableType: string, syllable: number) {
		this.category = category;
		this.position = position;
		this.syllableType = syllableType;
		this.syllable = syllable;
	}
}

/** The script settings a run is reordered by. */
interface IndicPlan {
	config: IndicConfig;
	/** The ISO 15924 code of the run's script. */
	iso: string | null;
	/** Whether the font's tables are under an old Indic script tag (`deva`, not `dev2`). */
	isOldSpec: boolean;
}

/**
 * Shapes the Indic scripts and Khmer. Marks keep the advances the font gives them, since
 * Indic fonts position their marks with zero-width glyphs already.
 */
export class IndicShaper extends DefaultShaper {
	override zeroMarkWidths = "none" as const;

	/**
	 * Syllables, then localized forms, initial reordering, the basic forms one stage each so
	 * each sees the last one's output, final reordering, then the presentation forms.
	 *
	 * @param plan - The plan.
	 */
	override planFeatures(plan: ShapingPlan) {
		plan.addStage(setupSyllables);
		plan.addStage(["locl", "ccmp"]);
		plan.addStage(initialReordering);
		plan.addStage("nukt");
		plan.addStage("akhn");
		plan.addStage("rphf", false);
		plan.addStage("rkrf");
		plan.addStage("pref", false);
		plan.addStage("blwf", false);
		plan.addStage("abvf", false);
		plan.addStage("half", false);
		plan.addStage("pstf", false);
		plan.addStage("vatu");
		plan.addStage("cjct");
		plan.addStage("cfar", false);
		plan.addStage(finalReordering);
		plan.addStage({ local: ["init"], global: PRESENTATION_FEATURES });
	}

	/**
	 * Splits multi-part vowel signs into their parts, which reorder independently.
	 *
	 * @param plan - The plan, for the font.
	 * @param glyphs - The buffer.
	 */
	override assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]) {
		splitVowels(plan, glyphs, (codePoint) => INDIC_DECOMPOSITIONS.get(codePoint));
	}
}

/**
 * Replaces each character the decomposer splits with one glyph per part, keeping its cluster
 * and features; the parts never split again.
 *
 * @param plan - The plan, for the font.
 * @param glyphs - The buffer.
 * @param extra - Splits beyond the canonical decompositions of dependent vowels.
 */
export function splitVowels(
	plan: ShapingPlan,
	glyphs: GlyphInfo[],
	extra: (codePoint: number) => readonly number[] | undefined = () => undefined,
) {
	let font = plan.font;
	for (let index = glyphs.length - 1; index >= 0; index--) {
		let glyph = glyphs[index];
		let codePoint = glyph?.codePoints[0];
		if (glyph === undefined || codePoint === undefined) continue;
		let parts = extra(codePoint) ?? vowelDecomposition(codePoint);
		if (parts === null) continue;
		let replacement = parts.map(
			(part) => new GlyphInfo(font, font.glyphIndex(part), [part], glyph.cluster, glyph.features),
		);
		glyphs.splice(index, 1, ...replacement);
	}
}

/**
 * The glyph's Indic state, created as outside any syllable when a stage before syllable
 * setup made the glyph; an index past the buffer reads a detached placeholder.
 *
 * @param glyph - A buffer glyph, or `undefined`.
 */
function info(glyph: GlyphInfo | undefined): IndicInfo {
	if (glyph === undefined) return new IndicInfo(CATEGORIES.X, POSITIONS.End, "", -1);
	if (glyph.shaperInfo instanceof IndicInfo) return glyph.shaperInfo;
	let created = new IndicInfo(CATEGORIES.X, POSITIONS.End, "non_indic_cluster", -1);
	glyph.shaperInfo = created;
	return created;
}

/**
 * Whether a glyph's category is any of the given flags.
 *
 * @param glyph - A buffer glyph.
 * @param flags - Category flags.
 */
function is(glyph: GlyphInfo | undefined, flags: number): boolean {
	return (info(glyph).category & flags) !== 0;
}

/**
 * The script settings for a run: the script the font's tables were selected under, else
 * the script of the run's first Indic character.
 *
 * @param plan - The plan.
 * @param glyphs - The buffer.
 */
function indicPlan(plan: ShapingPlan, glyphs: readonly GlyphInfo[]): IndicPlan {
	let iso = isoScript(plan.script);
	if (indicConfig(iso).virama === 0) {
		for (let glyph of glyphs) {
			let found = script(glyph.codePoints[0] ?? 0);
			if (indicConfig(found).virama !== 0) {
				iso = found;
				break;
			}
		}
	}
	let config = indicConfig(iso);
	return { config, iso, isOldSpec: config.hasOldSpec && !plan.script.endsWith("2") };
}

/**
 * Moves one buffer entry to another index, shifting the ones between.
 *
 * @param glyphs - The buffer.
 * @param from - Where the glyph is.
 * @param to - Where it goes.
 */
export function moveGlyph(glyphs: GlyphInfo[], from: number, to: number) {
	if (from === to || from < 0 || to < 0 || from >= glyphs.length || to >= glyphs.length) return;
	let [moved] = glyphs.splice(from, 1);
	if (moved !== undefined) glyphs.splice(to, 0, moved);
}

/**
 * Gives every glyph of a reordered syllable the syllable's first cluster, so the syllable
 * stays one cluster whatever order its glyphs end in.
 *
 * @param glyphs - The buffer.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 */
export function mergeClusters(glyphs: readonly GlyphInfo[], start: number, end: number) {
	let cluster = Infinity;
	for (let index = start; index < end; index++) {
		cluster = Math.min(cluster, glyphs[index]?.cluster ?? Infinity);
	}
	if (cluster === Infinity) return;
	for (let index = start; index < end; index++) {
		let glyph = glyphs[index];
		if (glyph !== undefined) glyph.cluster = cluster;
	}
}

/**
 * The end of the syllable starting at `start`.
 *
 * @param glyphs - The buffer.
 * @param start - A syllable's first index.
 */
function nextSyllable(glyphs: readonly GlyphInfo[], start: number): number {
	if (start >= glyphs.length) return start;
	let syllable = info(glyphs[start]).syllable;
	let end = start + 1;
	while (end < glyphs.length && info(glyphs[end]).syllable === syllable) end++;
	return end;
}

/**
 * Whether a feature turns the given glyphs into a single glyph, tried on copies that carry
 * only that feature; how the shaper asks which consonants take a reph or subjoined form.
 *
 * @param gsub - The GSUB processor, `null` when the font has none.
 * @param tag - The feature.
 * @param glyphs - The glyphs to try it on, left untouched.
 */
export function wouldLigate(
	gsub: GsubProcessor | null,
	tag: string,
	glyphs: readonly (GlyphInfo | undefined)[],
): boolean {
	if (gsub === null || !gsub.features.has(tag)) return false;
	let copies: GlyphInfo[] = [];
	for (let glyph of glyphs) {
		if (glyph === undefined) return false;
		let copy = glyph.copy();
		copy.features = new Set([tag]);
		copies.push(copy);
	}
	gsub.applyFeatures([tag], copies);
	return copies.length === 1;
}

/**
 * Finds the syllables and records each glyph's category, position and syllable.
 *
 * @param context - The buffer.
 */
function setupSyllables({ glyphs }: StageContext) {
	let categories = glyphs.map((glyph) => indicCategory(glyph.codePoints[0] ?? 0));
	let symbols = categories.map((category) => 31 - Math.clz32(category));
	let serial = 0;
	for (let syllable of indicSyllables(symbols)) {
		serial++;
		for (let index = syllable.start; index < syllable.end; index++) {
			let glyph = glyphs[index];
			if (glyph === undefined) continue;
			if (syllable.type === null) {
				glyph.shaperInfo = new IndicInfo(CATEGORIES.X, POSITIONS.End, "non_indic_cluster", serial);
				continue;
			}
			let category = categories[index] ?? CATEGORIES.X;
			let position = indicPosition(glyph.codePoints[0] ?? 0, category);
			glyph.shaperInfo = new IndicInfo(category, position, syllable.type, serial);
		}
	}
}

/**
 * Where a consonant goes when it follows a virama: below or after the base when the font
 * has a below-base, post-base or pre-base form for it, as the base otherwise.
 *
 * @param gsub - The GSUB processor.
 * @param consonant - The consonant.
 * @param virama - A virama glyph.
 */
function consonantPosition(
	gsub: GsubProcessor | null,
	consonant: GlyphInfo,
	virama: GlyphInfo,
): number {
	let forms: [string, number][] = [
		["blwf", POSITIONS.Below_C],
		["pstf", POSITIONS.Post_C],
		["pref", POSITIONS.Post_C],
	];
	for (let [tag, position] of forms) {
		if (
			wouldLigate(gsub, tag, [virama, consonant]) ||
			wouldLigate(gsub, tag, [consonant, virama])
		) {
			return position;
		}
	}
	return POSITIONS.Base_C;
}

/**
 * Initial reordering: classifies consonants by the forms the font has for them, then
 * reorders each syllable around its base and enables the basic form features.
 *
 * @param context - The buffer and processors.
 */
function initialReordering(context: StageContext) {
	let { font, plan, glyphs, gsub } = context;
	let settings = indicPlan(plan, glyphs);
	let { virama } = settings.config;
	let viramaGlyph = virama === 0 ? 0 : font.glyphIndex(virama);
	if (viramaGlyph !== 0) {
		let viramaInfo = new GlyphInfo(font, viramaGlyph, [virama], 0);
		let known = new Map<number, number>();
		for (let glyph of glyphs) {
			let glyphInfo = info(glyph);
			if (glyphInfo.position !== POSITIONS.Base_C) continue;
			let position = known.get(glyph.glyph);
			if (position === undefined) {
				position = consonantPosition(gsub, glyph, viramaInfo);
				known.set(glyph.glyph, position);
			}
			glyphInfo.position = position;
		}
	}
	let start = 0;
	while (start < glyphs.length) {
		let end = nextSyllable(glyphs, start);
		start = reorderSyllable(context, settings, start, end);
	}
}

/**
 * Initial reordering of one syllable.
 *
 * @param context - The buffer and processors.
 * @param settings - The script settings.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 * @returns One past the syllable's last index after any dotted circle went in.
 */
function reorderSyllable(
	context: StageContext,
	settings: IndicPlan,
	start: number,
	end: number,
): number {
	let { font, glyphs, plan } = context;
	let { syllableType, syllable } = info(glyphs[start]);
	if (syllableType === "symbol_cluster" || syllableType === "non_indic_cluster") return end;
	let syllableEnd = end;
	let dottedCircle = font.glyphIndex(DOTTED_CIRCLE);
	if (syllableType === "broken_cluster" && dottedCircle !== 0) {
		let at = start;
		while (at < syllableEnd && info(glyphs[at]).category === CATEGORIES.Repha) at++;
		let circle = new GlyphInfo(
			font,
			dottedCircle,
			[DOTTED_CIRCLE],
			glyphs[at]?.cluster ?? glyphs[start]?.cluster ?? 0,
			plan.globalFeatures,
		);
		let category = indicCategory(DOTTED_CIRCLE);
		circle.shaperInfo = new IndicInfo(
			category,
			indicPosition(DOTTED_CIRCLE, category),
			syllableType,
			syllable,
		);
		glyphs.splice(at, 0, circle);
		syllableEnd++;
	}
	let base = findBase(context, settings, start, syllableEnd);
	orderCharacters(glyphs, start, syllableEnd, base);
	assignSyllableFeatures(context, settings, start, syllableEnd);
	return syllableEnd;
}

/**
 * Finds a syllable's base consonant and marks a leading Ra that forms reph.
 *
 * @param context - The buffer and processors.
 * @param settings - The script settings.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 * @returns The base's index, `end` when the syllable has none.
 */
function findBase(context: StageContext, settings: IndicPlan, start: number, end: number): number {
	let { glyphs, gsub } = context;
	let { config } = settings;
	let base = end;
	let limit = start;
	let hasReph = false;
	let third = info(glyphs[start + 2]).category;
	if (
		config.rephPosition !== POSITIONS.Ra_To_Become_Reph &&
		gsub?.features.has("rphf") === true &&
		start + 3 <= end &&
		((config.rephMode === "Implicit" && (third & JOINER_FLAGS) === 0) ||
			(config.rephMode === "Explicit" && third === CATEGORIES.ZWJ))
	) {
		let candidates = [glyphs[start], glyphs[start + 1], glyphs[start + 2]];
		if (
			wouldLigate(gsub, "rphf", candidates.slice(0, 2)) ||
			(config.rephMode === "Explicit" && wouldLigate(gsub, "rphf", candidates))
		) {
			limit += 2;
			while (limit < end && is(glyphs[limit], JOINER_FLAGS)) limit++;
			base = start;
			hasReph = true;
		}
	} else if (config.rephMode === "Log_Repha" && info(glyphs[start]).category === CATEGORIES.Repha) {
		limit++;
		while (limit < end && is(glyphs[limit], JOINER_FLAGS)) limit++;
		base = start;
		hasReph = true;
	}
	if (config.basePosition === "Last") base = lastBase(glyphs, start, end, limit, base);
	else {
		base = start;
		for (let index = base + 1; index < end; index++) {
			if (is(glyphs[index], CONSONANT_FLAGS)) info(glyphs[index]).position = POSITIONS.Below_C;
		}
	}
	if (hasReph && base === start && limit - base <= 2) hasReph = false;
	for (let index = start; index < base; index++) {
		let glyphInfo = info(glyphs[index]);
		glyphInfo.position = Math.min(POSITIONS.Pre_C, glyphInfo.position);
	}
	if (base < end) info(glyphs[base]).position = POSITIONS.Base_C;
	markFinalConsonants(glyphs, base, end);
	if (hasReph) info(glyphs[start]).position = POSITIONS.Ra_To_Become_Reph;
	if (settings.isOldSpec) moveOldSpecHalant(glyphs, settings, base, end);
	return base;
}

/**
 * The base when it is the last consonant: walking back from the end, the first consonant
 * without a below-base or post-base form, else the first consonant reached.
 *
 * @param glyphs - The buffer.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 * @param limit - The first index that may be the base.
 * @param initial - The base so far.
 */
function lastBase(
	glyphs: readonly GlyphInfo[],
	start: number,
	end: number,
	limit: number,
	initial: number,
): number {
	let base = initial;
	let index = end;
	let seenBelow = false;
	do {
		index--;
		let glyphInfo = info(glyphs[index]);
		if (is(glyphs[index], CONSONANT_FLAGS)) {
			let { position } = glyphInfo;
			if (position !== POSITIONS.Below_C && (position !== POSITIONS.Post_C || seenBelow)) {
				return index;
			}
			if (position === POSITIONS.Below_C) seenBelow = true;
			base = index;
		} else if (
			start < index &&
			glyphInfo.category === CATEGORIES.ZWJ &&
			info(glyphs[index - 1]).category === CATEGORIES.H
		) {
			return base;
		}
	} while (index > limit);
	return base;
}

/**
 * Marks the first consonant after the first matra after the base as a final consonant, as
 * Khmer spells them.
 *
 * @param glyphs - The buffer.
 * @param base - The base's index.
 * @param end - One past the syllable's last index.
 */
function markFinalConsonants(glyphs: readonly GlyphInfo[], base: number, end: number) {
	for (let index = base + 1; index < end; index++) {
		if (info(glyphs[index]).category !== CATEGORIES.M) continue;
		for (let next = index + 1; next < end; next++) {
			if (is(glyphs[next], CONSONANT_FLAGS)) {
				info(glyphs[next]).position = POSITIONS.Final_C;
				break;
			}
		}
		return;
	}
}

/**
 * Under an old script tag, moves the first halant after the base to after the last
 * consonant; Malayalam moves it even past another halant.
 *
 * @param glyphs - The buffer.
 * @param settings - The script settings.
 * @param base - The base's index.
 * @param end - One past the syllable's last index.
 */
function moveOldSpecHalant(glyphs: GlyphInfo[], settings: IndicPlan, base: number, end: number) {
	let disallowDoubleHalants = settings.iso !== "Mlym";
	for (let index = base + 1; index < end; index++) {
		if (info(glyphs[index]).category !== CATEGORIES.H) continue;
		let last = end - 1;
		while (last > index) {
			let category = info(glyphs[last]).category;
			if ((category & CONSONANT_FLAGS) !== 0) break;
			if (disallowDoubleHalants && category === CATEGORIES.H) break;
			last--;
		}
		if (info(glyphs[last]).category !== CATEGORIES.H && last > index) {
			moveGlyph(glyphs, index, last);
		}
		return;
	}
}

/**
 * Gives joiners, nuktas, register shifters, medials and halants the position of what they
 * follow, lets post-base consonants own the marks before them, and sorts the syllable by
 * position.
 *
 * @param glyphs - The buffer.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 * @param base - The base's index.
 */
function orderCharacters(glyphs: GlyphInfo[], start: number, end: number, base: number) {
	let lastPosition = POSITIONS.Start;
	for (let index = start; index < end; index++) {
		let glyphInfo = info(glyphs[index]);
		let attached =
			JOINER_FLAGS |
			CATEGORIES.N |
			CATEGORIES.RS |
			CATEGORIES.CM |
			(HALANT_OR_COENG_FLAGS & glyphInfo.category);
		if ((glyphInfo.category & attached) !== 0) {
			glyphInfo.position = lastPosition;
			if (glyphInfo.category === CATEGORIES.H && glyphInfo.position === POSITIONS.Pre_M) {
				for (let previous = index; previous > start; previous--) {
					let before = info(glyphs[previous - 1]).position;
					if (before !== POSITIONS.Pre_M) {
						glyphInfo.position = before;
						break;
					}
				}
			}
		} else if (glyphInfo.position !== POSITIONS.SMVD) {
			lastPosition = glyphInfo.position;
		}
	}
	let last = base;
	for (let index = base + 1; index < end; index++) {
		if (is(glyphs[index], CONSONANT_FLAGS)) {
			let position = info(glyphs[index]).position;
			for (let owned = last + 1; owned < index; owned++) {
				let ownedInfo = info(glyphs[owned]);
				if (ownedInfo.position < POSITIONS.SMVD) ownedInfo.position = position;
			}
			last = index;
		} else if (info(glyphs[index]).category === CATEGORIES.M) {
			last = index;
		}
	}
	let sorted = glyphs.slice(start, end);
	sorted.sort((a, b) => info(a).position - info(b).position);
	glyphs.splice(start, sorted.length, ...sorted);
	mergeClusters(glyphs, start, end);
}

/**
 * Enables reph, half, below-base, above-base, post-base and pre-base form features on the
 * glyphs of a sorted syllable, and lets ZWNJ block half forms.
 *
 * @param context - The buffer and processors.
 * @param settings - The script settings.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 */
function assignSyllableFeatures(
	context: StageContext,
	settings: IndicPlan,
	start: number,
	end: number,
) {
	let { glyphs, gsub } = context;
	let base = start;
	while (base < end && info(glyphs[base]).position !== POSITIONS.Base_C) base++;
	for (
		let index = start;
		index < end && info(glyphs[index]).position === POSITIONS.Ra_To_Become_Reph;
		index++
	) {
		glyphs[index]?.features.add("rphf");
	}
	let belowBefore = !settings.isOldSpec && settings.config.belowFormMode === "Pre_And_Post";
	for (let index = start; index < base; index++) {
		glyphs[index]?.features.add("half");
		if (belowBefore) glyphs[index]?.features.add("blwf");
	}
	for (let index = base + 1; index < end; index++) {
		glyphs[index]?.features.add("abvf").add("pstf").add("blwf");
	}
	if (settings.isOldSpec && settings.iso === "Deva") {
		for (let index = start; index + 1 < base; index++) {
			if (
				info(glyphs[index]).category === CATEGORIES.Ra &&
				info(glyphs[index + 1]).category === CATEGORIES.H &&
				(index + 1 === base || info(glyphs[index + 2]).category === CATEGORIES.ZWJ)
			) {
				glyphs[index]?.features.add("blwf");
				glyphs[index + 1]?.features.add("blwf");
			}
		}
	}
	if (gsub?.features.has("pref") === true && base + 2 < end) {
		for (let index = base + 1; index + 1 < end; index++) {
			if (!wouldLigate(gsub, "pref", [glyphs[index], glyphs[index + 1]])) continue;
			glyphs[index]?.features.add("pref");
			glyphs[index + 1]?.features.add("pref");
			if (gsub.features.has("cfar")) {
				for (let after = index + 2; after < end; after++) glyphs[after]?.features.add("cfar");
			}
			break;
		}
	}
	for (let index = start + 1; index < end; index++) {
		if (!is(glyphs[index], JOINER_FLAGS)) continue;
		let nonJoiner = info(glyphs[index]).category === CATEGORIES.ZWNJ;
		let before = index;
		do {
			before--;
			if (nonJoiner) glyphs[before]?.features.delete("half");
		} while (before > start && !is(glyphs[before], CONSONANT_FLAGS));
	}
}

/**
 * Final reordering, after the basic forms: moves pre-base matras, reph and pre-base
 * reordering consonants to where the formed glyphs need them, and enables `init` on a
 * word-initial left matra.
 *
 * @param context - The buffer and processors.
 */
function finalReordering(context: StageContext) {
	let { plan, glyphs } = context;
	let settings = indicPlan(plan, glyphs);
	let start = 0;
	while (start < glyphs.length) {
		let end = nextSyllable(glyphs, start);
		finalReorderSyllable(context, settings, start, end);
		start = end;
	}
}

/**
 * Final reordering of one syllable.
 *
 * @param context - The buffer and processors.
 * @param settings - The script settings.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 */
function finalReorderSyllable(
	context: StageContext,
	settings: IndicPlan,
	start: number,
	end: number,
) {
	let { glyphs, gsub } = context;
	let tryPref = gsub?.features.has("pref") === true;
	let [base, prefFormed] = finalBase(glyphs, settings, start, end, tryPref);
	tryPref = prefFormed;
	base = reorderPreBaseMatras(glyphs, settings, start, end, base);
	base = reorderReph(glyphs, settings, start, end, base);
	if (tryPref && base + 1 < end) reorderPref(glyphs, settings, start, end, base);
	let first = glyphs[start];
	if (first !== undefined && info(first).position === POSITIONS.Pre_M) {
		let previous = glyphs[start - 1]?.codePoints[0];
		let category = previous === undefined ? "" : generalCategory(previous);
		if (start === 0 || (category !== "Cf" && category !== "Mn")) first.features.add("init");
	}
	mergeClusters(glyphs, start, end);
}

/**
 * Finds the base after the basic forms: past a pre-base reordering candidate that formed
 * nothing, past Malayalam's unformed below-base forms, and back over nuktas and halants.
 *
 * @param glyphs - The buffer.
 * @param settings - The script settings.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 * @param tryPref - Whether the font has `pref`.
 * @returns The base, and whether a `pref` candidate is still to be reordered.
 */
function finalBase(
	glyphs: readonly GlyphInfo[],
	settings: IndicPlan,
	start: number,
	end: number,
	tryPref: boolean,
): [base: number, tryPref: boolean] {
	let pending = tryPref;
	let base = start;
	for (; base < end; base++) {
		if (info(glyphs[base]).position < POSITIONS.Base_C) continue;
		if (pending && base + 1 < end) {
			for (let index = base + 1; index < end; index++) {
				let glyph = glyphs[index];
				if (glyph?.features.has("pref") !== true) continue;
				if (!(glyph.substituted && glyph.isLigated && !glyph.isMultiplied)) {
					base = index;
					while (base < end && is(glyphs[base], HALANT_OR_COENG_FLAGS)) base++;
					if (base < end) info(glyphs[base]).position = POSITIONS.Base_C;
					pending = false;
				}
				break;
			}
		}
		if (settings.iso === "Mlym") base = malayalamBase(glyphs, base, end);
		if (start < base && info(glyphs[base]).position > POSITIONS.Base_C) base--;
		break;
	}
	if (base === end && start < base && info(glyphs[base - 1]).category === CATEGORIES.ZWJ) {
		base--;
	}
	if (base < end) {
		while (start < base && is(glyphs[base], CATEGORIES.N | HALANT_OR_COENG_FLAGS)) base--;
	}
	return [base, pending];
}

/**
 * Malayalam's base after its below-base forms that did not form: the last such consonant
 * reached through halants and joiners.
 *
 * @param glyphs - The buffer.
 * @param initial - The base so far.
 * @param end - One past the syllable's last index.
 */
function malayalamBase(glyphs: readonly GlyphInfo[], initial: number, end: number): number {
	let base = initial;
	for (let index = base + 1; index < end; index++) {
		while (index < end && is(glyphs[index], JOINER_FLAGS)) index++;
		if (index === end || !is(glyphs[index], HALANT_OR_COENG_FLAGS)) break;
		index++;
		while (index < end && is(glyphs[index], JOINER_FLAGS)) index++;
		if (
			index < end &&
			is(glyphs[index], CONSONANT_FLAGS) &&
			info(glyphs[index]).position === POSITIONS.Below_C
		) {
			base = index;
			info(glyphs[base]).position = POSITIONS.Base_C;
		}
	}
	return base;
}

/**
 * Moves pre-base matras to after the last halant before the base that did not form a half
 * form, or keeps them first when every consonant before the base formed one.
 *
 * @param glyphs - The buffer.
 * @param settings - The script settings.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 * @param initial - The base's index.
 * @returns The base's index afterwards.
 */
function reorderPreBaseMatras(
	glyphs: GlyphInfo[],
	settings: IndicPlan,
	start: number,
	end: number,
	initial: number,
): number {
	let base = initial;
	if (!(start + 1 < end && start < base)) return base;
	let target = base === end ? base - 2 : base - 1;
	if (settings.iso !== "Mlym" && settings.iso !== "Taml") {
		while (target > start && !is(glyphs[target], CATEGORIES.M | HALANT_OR_COENG_FLAGS)) target--;
		if (
			is(glyphs[target], HALANT_OR_COENG_FLAGS) &&
			info(glyphs[target]).position !== POSITIONS.Pre_M
		) {
			if (target + 1 < end && is(glyphs[target + 1], JOINER_FLAGS)) target++;
		} else target = start;
	}
	if (!(start < target && info(glyphs[target]).position !== POSITIONS.Pre_M)) return base;
	for (let index = target; index > start; index--) {
		if (info(glyphs[index - 1]).position !== POSITIONS.Pre_M) continue;
		let from = index - 1;
		if (from < base && base <= target) base--;
		moveGlyph(glyphs, from, target);
		target--;
	}
	return base;
}

/**
 * The first halant between the reph and the base, past a joiner after it, or `-1`.
 *
 * @param glyphs - The buffer.
 * @param start - The syllable's first index.
 * @param base - The base's index.
 */
function halantBeforeBase(glyphs: readonly GlyphInfo[], start: number, base: number): number {
	let position = start + 1;
	while (position < base && !is(glyphs[position], HALANT_OR_COENG_FLAGS)) position++;
	if (!(position < base && is(glyphs[position], HALANT_OR_COENG_FLAGS))) return -1;
	if (position + 1 < base && is(glyphs[position + 1], JOINER_FLAGS)) position++;
	return position;
}

/**
 * Moves a reph that formed (or a separately encoded repha that did not ligate) from the
 * start of the syllable to where the script's reph position puts it.
 *
 * @param glyphs - The buffer.
 * @param settings - The script settings.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 * @param initial - The base's index.
 * @returns The base's index afterwards.
 */
function reorderReph(
	glyphs: GlyphInfo[],
	settings: IndicPlan,
	start: number,
	end: number,
	initial: number,
): number {
	let base = initial;
	let first = glyphs[start];
	if (first === undefined || !(start + 1 < end)) return base;
	let firstInfo = info(first);
	let ligated = first.isLigated && !first.isMultiplied;
	if (firstInfo.position !== POSITIONS.Ra_To_Become_Reph) return base;
	if ((firstInfo.category === CATEGORIES.Repha) === ligated) return base;
	let rephPosition = settings.config.rephPosition;
	let target = -1;
	if (rephPosition !== POSITIONS.After_Post) {
		target = halantBeforeBase(glyphs, start, base);
		if (target === -1 && rephPosition === POSITIONS.After_Main) {
			target = base;
			while (target + 1 < end && info(glyphs[target + 1]).position <= POSITIONS.After_Main) {
				target++;
			}
			if (target >= end) target = -1;
		}
		if (target === -1 && rephPosition === POSITIONS.After_Sub) {
			target = base;
			let after = POSITIONS.Post_C | POSITIONS.After_Post | POSITIONS.SMVD;
			while (target + 1 < end && (info(glyphs[target + 1]).position & after) === 0) target++;
			if (target >= end) target = -1;
		}
	}
	if (target === -1) target = halantBeforeBase(glyphs, start, base);
	if (target === -1) {
		target = end - 1;
		while (target > start && info(glyphs[target]).position === POSITIONS.SMVD) target--;
		if (is(glyphs[target], HALANT_OR_COENG_FLAGS)) {
			for (let index = base + 1; index < target; index++) {
				if (info(glyphs[index]).category === CATEGORIES.M) target--;
			}
		}
	}
	target = Math.max(target, start);
	moveGlyph(glyphs, start, target);
	if (start < base && base <= target) base--;
	return base;
}

/**
 * Moves a pre-base reordering consonant that `pref` formed to before the base, after any
 * halant that kept its consonant whole.
 *
 * @param glyphs - The buffer.
 * @param settings - The script settings.
 * @param start - The syllable's first index.
 * @param end - One past its last.
 * @param base - The base's index.
 */
function reorderPref(
	glyphs: GlyphInfo[],
	settings: IndicPlan,
	start: number,
	end: number,
	base: number,
) {
	for (let index = base + 1; index < end; index++) {
		let glyph = glyphs[index];
		if (glyph?.features.has("pref") !== true) continue;
		if (!glyph.isLigated || glyph.isMultiplied) return;
		let target = base;
		if (settings.iso !== "Mlym" && settings.iso !== "Taml") {
			while (target > start && !is(glyphs[target - 1], CATEGORIES.M | HALANT_OR_COENG_FLAGS)) {
				target--;
			}
			if (target > start && info(glyphs[target - 1]).category === CATEGORIES.M) {
				for (let matra = base + 1; matra < index; matra++) {
					if (info(glyphs[matra]).category === CATEGORIES.M) {
						target--;
						break;
					}
				}
			}
		}
		if (
			target > start &&
			is(glyphs[target - 1], HALANT_OR_COENG_FLAGS) &&
			target < end &&
			is(glyphs[target], JOINER_FLAGS)
		) {
			target++;
		}
		moveGlyph(glyphs, index, target);
		return;
	}
}
