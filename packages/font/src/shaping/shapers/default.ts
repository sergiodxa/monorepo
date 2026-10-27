/**
 * The default shaper, which every script without its own uses and every script shaper
 * extends: it plans the common and horizontal features around the shaper's own stage, and
 * normalizes mark clusters and marks fractions before GSUB.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NormalizationCharacter } from "../normalize.js";
import type { ShapingPlan, UserFeatures } from "../plan.js";

import { GlyphInfo } from "../glyph-info.js";
import { normalizeCluster } from "../normalize.js";
import { isDigit, isMark } from "../unicode/properties.js";

/** When a shaper zeroes the advances of mark glyphs, relative to running GPOS. */
export type ZeroMarkWidths = "before-gpos" | "after-gpos" | "none";

/** Features that pick a variable font's alternate glyphs, applied before anything else. */
const VARIATION_FEATURES = ["rvrn"];

/** Direction-dependent forms: `ltrm`/`rtlm` mirrored forms, `ltra`/`rtla` alternates. */
const DIRECTIONAL_FEATURES = { ltr: ["ltra", "ltrm"], rtl: ["rtla"] };

/** Features enabled around a fraction slash, on its numerator and denominator digits. */
const FRACTION_FEATURES = ["frac", "numr", "dnom"];

/** Features every script gets after its own: composition, localized forms, marks. */
const COMMON_FEATURES = ["abvm", "blwm", "ccmp", "locl", "mark", "mkmk", "rlig"];

/** Features of horizontal text: ligatures, contextual alternates, kerning, cursive joins. */
const HORIZONTAL_FEATURES = ["calt", "clig", "curs", "dist", "kern", "liga", "rclt"];

/** The fraction slash, U+2044, which turns the digits around it into a fraction. */
const FRACTION_SLASH = 0x2044;

/**
 * Shapes text that needs no script-specific processing, and is the base class script
 * shapers override the planning and feature assignment hooks of.
 */
export class DefaultShaper {
	/** When mark advances are zeroed; the default zeroes them after GPOS, as most fonts expect. */
	zeroMarkWidths: ZeroMarkWidths = "after-gpos";

	/**
	 * Plans the features for a run and enables them on its glyphs.
	 *
	 * @param plan - The empty plan to fill.
	 * @param glyphs - The buffer, which the shaper may change in place.
	 * @param features - The user's features.
	 */
	plan(plan: ShapingPlan, glyphs: GlyphInfo[], features: UserFeatures | undefined) {
		this.planPreprocessing(plan);
		this.planFeatures(plan);
		this.planPostprocessing(plan, features);
		plan.assignGlobalFeatures(glyphs);
		this.assignFeatures(plan, glyphs);
	}

	/**
	 * The first stage: variation and directional features, and the fraction features local
	 * to fractions, in a stage of their own so later features see their output.
	 *
	 * @param plan - The plan.
	 */
	planPreprocessing(plan: ShapingPlan) {
		plan.add({ global: VARIATION_FEATURES });
		plan.addStage({
			global: DIRECTIONAL_FEATURES[plan.direction],
			local: plan.direction === "rtl" ? ["rtlm", ...FRACTION_FEATURES] : FRACTION_FEATURES,
		});
	}

	/**
	 * The script's own stages; a script shaper overrides this.
	 *
	 * @param _plan - The plan.
	 */
	planFeatures(_plan: ShapingPlan) {}

	/**
	 * The common and horizontal features, then the user's features.
	 *
	 * @param plan - The plan.
	 * @param features - The user's features.
	 */
	planPostprocessing(plan: ShapingPlan, features: UserFeatures | undefined) {
		plan.add([...COMMON_FEATURES, ...HORIZONTAL_FEATURES]);
		plan.setFeatureOverrides(features);
	}

	/**
	 * Orders a run of marks after they are sorted by combining class; a script shaper with
	 * its own mark order overrides this.
	 *
	 * @param _characters - The cluster's characters.
	 * @param _start - Index of the run's first mark.
	 * @param _end - One past its last mark.
	 */
	reorderMarks(_characters: NormalizationCharacter[], _start: number, _end: number) {}

	/**
	 * Normalizes mark clusters against the font and enables the fraction features around
	 * each fraction slash; a script shaper extends it with its own local features.
	 *
	 * @param plan - The plan.
	 * @param glyphs - The buffer.
	 */
	assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]) {
		this.normalize(plan, glyphs);
		for (let index = 0; index < glyphs.length; index++) {
			if (glyphs[index]?.codePoints[0] !== FRACTION_SLASH) continue;
			let start = index;
			let end = index + 1;
			while (start > 0 && isDigit(glyphs[start - 1]?.codePoints[0] ?? 0)) {
				glyphs[start - 1]?.features.add("numr").add("frac");
				start--;
			}
			while (end < glyphs.length && isDigit(glyphs[end]?.codePoints[0] ?? 0)) {
				glyphs[end]?.features.add("dnom").add("frac");
				end++;
			}
			glyphs[index]?.features.add("frac");
			index = end - 1;
		}
	}

	/**
	 * Rebuilds each base-plus-marks cluster from its normalized characters when
	 * normalization changed it; the rebuilt glyphs keep the base's cluster and features.
	 *
	 * @param plan - The plan, for the font.
	 * @param glyphs - The buffer.
	 */
	normalize(plan: ShapingPlan, glyphs: GlyphInfo[]) {
		let font = plan.font;
		let hasGlyph = (codePoint: number) => font.glyphIndex(codePoint) !== 0;
		let reorder = this.reorderMarks.bind(this);
		let index = 0;
		while (index < glyphs.length) {
			let base = glyphs[index];
			let first = base?.codePoints[0] ?? 0;
			if (base === undefined || base.codePoints.length !== 1 || isMark(first)) {
				index++;
				continue;
			}
			let end = index + 1;
			while (end < glyphs.length && isSingleMark(glyphs[end])) end++;
			let input = glyphs.slice(index, end).map((glyph) => glyph.codePoints[0] ?? 0);
			let output = normalizeCluster(input, hasGlyph, reorder);
			let changed =
				output.length !== input.length || output.some((value, at) => value !== input[at]);
			if (changed) {
				let replacement = output.map(
					(codePoint) =>
						new GlyphInfo(
							font,
							font.glyphIndex(codePoint),
							[codePoint],
							base.cluster,
							base.features,
						),
				);
				glyphs.splice(index, end - index, ...replacement);
			}
			index += output.length;
		}
	}
}

/**
 * Whether a buffer glyph is still one combining mark character, the shape a mark keeps
 * until substitution.
 *
 * @param glyph - A buffer glyph.
 */
function isSingleMark(glyph: GlyphInfo | undefined): boolean {
	return glyph !== undefined && glyph.codePoints.length === 1 && isMark(glyph.codePoints[0] ?? 0);
}
