/**
 * The Universal Shaping Engine, for the Brahmic-derived scripts without a dedicated shaper
 * (Balinese, Javanese, Tibetan, Tirhuta, Siddham and many more): it splits the run into
 * clusters by USE category, applies reph and pre-base forms, and reorders each cluster.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ShapingPlan, StageContext } from "../plan.js";

import { GlyphInfo } from "../glyph-info.js";

import { DefaultShaper } from "./default.js";
import { mergeClusters, splitVowels } from "./indic.js";
import { useCategory } from "./use-data.js";
import { useSymbol, useSyllables } from "./use-machine.js";

/** The dotted circle, which stands in for the missing base of a broken cluster. */
const DOTTED_CIRCLE = 0x25cc;

/** Categories a repha moves in front of when it reorders past its base. */
const POST_BASE_CATEGORIES = new Set([
	"FAbv",
	"FBlw",
	"FPst",
	"FM",
	"MAbv",
	"MBlw",
	"MPst",
	"MPre",
	"VAbv",
	"VBlw",
	"VPst",
	"VPre",
	"VMAbv",
	"VMBlw",
	"VMPst",
	"VMPre",
]);

/** Cluster types whose glyphs reorder. */
const REORDERED_TYPES = new Set([
	"virama_terminated_cluster",
	"standard_cluster",
	"broken_cluster",
]);

/** What the shaper records on each glyph between its stages. */
export class UseInfo {
	/** The USE category; a formed repha becomes `R`, a formed pre-base form `VPre`. */
	category: string;
	/** The grammar rule that matched, `"non_cluster"` outside any cluster. */
	syllableType: string;
	/** A serial number shared by the glyphs of one cluster. */
	syllable: number;

	/**
	 * @param category - The USE category.
	 * @param syllableType - The cluster's type.
	 * @param syllable - The cluster's serial number.
	 */
	constructor(category: string, syllableType: string, syllable: number) {
		this.category = category;
		this.syllableType = syllableType;
		this.syllable = syllable;
	}
}

/**
 * Shapes text by the Universal Shaping Engine model. Marks lose their advance before GPOS,
 * which then positions them from zero.
 */
export class UniversalShaper extends DefaultShaper {
	override zeroMarkWidths = "before-gpos" as const;

	/**
	 * Clusters, the default pre-processing features, reph and pre-base forms each followed by
	 * a record of what formed, the orthographic unit features, reordering, then the
	 * presentation and positioning features.
	 *
	 * @param plan - The plan.
	 */
	override planFeatures(plan: ShapingPlan) {
		plan.addStage(setupSyllables);
		plan.addStage(["locl", "ccmp", "nukt", "akhn"]);
		plan.addStage(clearSubstitutionFlags);
		plan.addStage(["rphf"], false);
		plan.addStage(recordRphf);
		plan.addStage(clearSubstitutionFlags);
		plan.addStage(["pref"]);
		plan.addStage(recordPref);
		plan.addStage(["rkrf", "abvf", "blwf", "half", "pstf", "vatu", "cjct"]);
		plan.addStage(reorder);
		plan.addStage(["abvs", "blws", "pres", "psts", "dist", "abvm", "blwm"]);
	}

	/**
	 * Splits multi-part vowel signs into their parts, which reorder independently.
	 *
	 * @param plan - The plan, for the font.
	 * @param glyphs - The buffer.
	 */
	override assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]) {
		splitVowels(plan, glyphs);
	}
}

/**
 * The glyph's USE state, created as outside any cluster when a stage before cluster setup
 * made the glyph; an index past the buffer reads a detached placeholder.
 *
 * @param glyph - A buffer glyph, or `undefined`.
 */
function info(glyph: GlyphInfo | undefined): UseInfo {
	if (glyph === undefined) return new UseInfo("", "", -1);
	if (glyph.shaperInfo instanceof UseInfo) return glyph.shaperInfo;
	let created = new UseInfo("O", "non_cluster", -1);
	glyph.shaperInfo = created;
	return created;
}

/**
 * Finds the clusters, records each glyph's category and cluster, and enables `rphf` on the
 * glyphs that may form a reph: a prefixed repha alone, else up to the first three glyphs.
 *
 * @param context - The buffer.
 */
function setupSyllables({ glyphs }: StageContext) {
	let categories = glyphs.map((glyph) => useCategory(glyph.codePoints[0] ?? 0));
	let serial = 0;
	for (let syllable of useSyllables(categories.map(useSymbol))) {
		serial++;
		for (let index = syllable.start; index < syllable.end; index++) {
			let glyph = glyphs[index];
			if (glyph === undefined) continue;
			glyph.shaperInfo =
				syllable.type === null
					? new UseInfo("O", "non_cluster", serial)
					: new UseInfo(categories[index] ?? "O", syllable.type, serial);
		}
		if (syllable.type === null) continue;
		let { start, end } = syllable;
		let limit = info(glyphs[start]).category === "R" ? 1 : Math.min(3, end - 1 - start);
		for (let index = start; index < start + limit; index++) glyphs[index]?.features.add("rphf");
	}
}

/**
 * Clears every glyph's substituted flag, so the next stage's record sees only what it did.
 *
 * @param context - The buffer.
 */
function clearSubstitutionFlags({ glyphs }: StageContext) {
	for (let glyph of glyphs) glyph.substituted = false;
}

/**
 * Marks a glyph `rphf` substituted as a repha, which reordering then moves.
 *
 * @param context - The buffer.
 */
function recordRphf({ glyphs }: StageContext) {
	for (let glyph of glyphs) {
		if (glyph.substituted && glyph.features.has("rphf")) info(glyph).category = "R";
	}
}

/**
 * Marks a glyph `pref` substituted as a pre-base vowel, which it reorders like.
 *
 * @param context - The buffer.
 */
function recordPref({ glyphs }: StageContext) {
	for (let glyph of glyphs) {
		if (glyph.substituted) info(glyph).category = "VPre";
	}
}

/**
 * Whether a glyph is a virama that did not ligate.
 *
 * @param glyph - A buffer glyph.
 */
function isHalant(glyph: GlyphInfo | undefined): boolean {
	return glyph !== undefined && info(glyph).category === "H" && !glyph.isLigated;
}

/**
 * Whether a glyph is a cluster's base.
 *
 * @param glyph - A buffer glyph.
 */
function isBase(glyph: GlyphInfo | undefined): boolean {
	let { category } = info(glyph);
	return category === "B" || category === "GB";
}

/**
 * The end of the cluster starting at `start`.
 *
 * @param glyphs - The buffer.
 * @param start - A cluster's first index.
 */
function nextSyllable(glyphs: readonly GlyphInfo[], start: number): number {
	if (start >= glyphs.length) return start;
	let syllable = info(glyphs[start]).syllable;
	let end = start + 1;
	while (end < glyphs.length && info(glyphs[end]).syllable === syllable) end++;
	return end;
}

/**
 * Reorders each cluster: a dotted circle into broken clusters, the repha forward to before
 * the first post-base glyph, and pre-base vowels back to before the base or halant.
 *
 * @param context - The buffer and font.
 */
function reorder(context: StageContext) {
	let { glyphs } = context;
	let start = 0;
	while (start < glyphs.length) {
		start = reorderSyllable(context, start, nextSyllable(glyphs, start));
	}
}

/**
 * Reorders one cluster.
 *
 * @param context - The buffer and font.
 * @param start - The cluster's first index.
 * @param initialEnd - One past its last.
 * @returns One past the cluster's last index after any dotted circle went in.
 */
function reorderSyllable(context: StageContext, start: number, initialEnd: number): number {
	let { font, glyphs, plan } = context;
	let end = initialEnd;
	let first = info(glyphs[start]);
	if (!REORDERED_TYPES.has(first.syllableType)) return end;
	let dottedCircle = font.glyphIndex(DOTTED_CIRCLE);
	if (first.syllableType === "broken_cluster" && dottedCircle !== 0) {
		let at = start;
		while (at < end && info(glyphs[at]).category === "R") at++;
		let circle = new GlyphInfo(
			font,
			dottedCircle,
			[DOTTED_CIRCLE],
			glyphs[at]?.cluster ?? glyphs[start]?.cluster ?? 0,
			plan.globalFeatures,
		);
		circle.shaperInfo = new UseInfo("GB", first.syllableType, first.syllable);
		glyphs.splice(at, 0, circle);
		end++;
	}
	if (first.category === "R" && end - start > 1) moveRepha(glyphs, start, end);
	let target = end;
	for (let index = start; index < end; index++) {
		let glyph = glyphs[index];
		if (isBase(glyph) || isHalant(glyph)) {
			target = isHalant(glyph) ? index + 1 : index;
			continue;
		}
		let { category } = info(glyph);
		if (
			glyph !== undefined &&
			(category === "VPre" || category === "VMPre") &&
			!glyph.isMultiplied &&
			target < index
		) {
			glyphs.splice(index, 1);
			glyphs.splice(target, 0, glyph);
		}
	}
	mergeClusters(glyphs, start, end);
	return end;
}

/**
 * Moves a cluster's leading repha to just before its first post-base glyph or halant, or to
 * the cluster's end when it has none.
 *
 * @param glyphs - The buffer.
 * @param start - The cluster's first index.
 * @param end - One past its last.
 */
function moveRepha(glyphs: GlyphInfo[], start: number, end: number) {
	for (let index = start + 1; index < end; index++) {
		let glyph = glyphs[index];
		let isPostBase = POST_BASE_CATEGORIES.has(info(glyph).category) || isHalant(glyph);
		if (!isPostBase && index !== end - 1) continue;
		let target = isPostBase ? index - 1 : index;
		let [repha] = glyphs.splice(start, 1);
		if (repha !== undefined) glyphs.splice(target, 0, repha);
		return;
	}
}
