/**
 * A shaping plan: the features a shaper asks for, grouped into stages that run in order,
 * with pause callbacks between stages where a shaper inspects or reorders the buffer. Each
 * feature is global (on every glyph) or local (on the glyphs a shaper marks).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GlyphInfo } from "./glyph-info.js";
import type { GsubProcessor } from "./gsub.js";
import type { GlyphPosition, LayoutProcessor } from "./processor.js";
import type { ShapingFont } from "./shaping-font.js";

/** What a pause callback receives: the buffer to change in place and the GSUB processor to probe features with. */
export interface StageContext {
	font: ShapingFont;
	plan: ShapingPlan;
	/** The buffer; splice it rather than replacing it. */
	glyphs: GlyphInfo[];
	/** `null` when the font has no GSUB table. */
	gsub: GsubProcessor | null;
}

/**
 * A callback that runs between feature stages during substitution.
 *
 * @param context - The buffer and the processors.
 */
export type StageCallback = (context: StageContext) => void;

/** One step of a plan: a set of features applied together, or a pause callback. */
export interface Stage {
	features: string[];
	pause: StageCallback | null;
}

/** Features a shaper adds, split by whether every glyph or only marked glyphs get them. */
export interface FeatureGroups {
	global?: readonly string[];
	local?: readonly string[];
}

/**
 * Features to turn on or off: an array turns each tag on; an object maps a tag to `true`,
 * `false`, or a number, which selects that alternate (`1` for the first) in GSUB type 3.
 */
export type UserFeatures = readonly string[] | Readonly<Record<string, boolean | number>>;

/** The ordered features and pauses a shaper planned for one run of text. */
export class ShapingPlan {
	readonly font: ShapingFont;
	/** The OpenType script tag the font's tables were selected under, or the text's when they list none. */
	readonly script: string;
	readonly direction: "ltr" | "rtl";
	/** The OpenType language system tag asked for, `null` for the script's default. */
	readonly language: string | null;
	readonly stages: Stage[] = [];
	/** Features enabled on every glyph. */
	readonly globalFeatures = new Set<string>();
	/** Every planned feature with the index of the stage it runs in. */
	readonly allFeatures = new Map<string, number>();
	/** The user's values for features they set to a number, for alternate selection. */
	readonly userFeatures = new Map<string, number>();
	/** Features the user turned off, which stay off even where no stage planned them. */
	readonly disabledFeatures = new Set<string>();

	/**
	 * @param font - The font being shaped.
	 * @param script - The OpenType script tag.
	 * @param direction - The run's direction.
	 * @param language - The language system tag, or `null`.
	 */
	constructor(
		font: ShapingFont,
		script: string,
		direction: "ltr" | "rtl",
		language: string | null,
	) {
		this.font = font;
		this.script = script;
		this.direction = direction;
		this.language = language;
	}

	/**
	 * Adds features to the last stage. A feature already planned keeps its stage, and becomes
	 * global when added globally again.
	 *
	 * @param features - A tag, tags, or global and local groups.
	 * @param global - Whether bare tags apply to every glyph.
	 * @example plan.add({ global: ["rvrn"], local: ["frac", "numr", "dnom"] })
	 */
	add(features: string | readonly string[] | FeatureGroups, global = true) {
		if (this.stages.length === 0) this.stages.push({ features: [], pause: null });
		if (typeof features === "string") this.#addFeatures([features], global);
		else if (isTagList(features)) this.#addFeatures(features, global);
		else {
			let groups = features as FeatureGroups;
			this.#addFeatures(groups.global ?? [], true);
			this.#addFeatures(groups.local ?? [], false);
		}
	}

	/**
	 * Starts a new stage, either a pause callback (followed by an empty feature stage) or a
	 * stage holding the given features.
	 *
	 * @param stage - A pause callback, or features as `add` takes them.
	 * @param global - Whether bare tags apply to every glyph.
	 * @example plan.addStage(reorderSyllables)
	 */
	addStage(stage: StageCallback | string | readonly string[] | FeatureGroups, global = true) {
		if (typeof stage === "function") {
			this.stages.push({ features: [], pause: stage }, { features: [], pause: null });
			return;
		}
		this.stages.push({ features: [], pause: null });
		this.add(stage, global);
	}

	/**
	 * Applies the user's features: enabled ones are added globally to the last stage,
	 * disabled ones are removed from the plan wherever they were.
	 *
	 * @param features - What the caller of `shape` asked for.
	 */
	setFeatureOverrides(features: UserFeatures | undefined) {
		if (features === undefined) return;
		if (isTagList(features)) {
			this.add(features);
			return;
		}
		for (let [tag, value] of Object.entries(features as Record<string, boolean | number>)) {
			if (typeof value === "number") this.userFeatures.set(tag, value);
			if (value !== false && value !== 0) {
				this.add(tag);
				continue;
			}
			this.disabledFeatures.add(tag);
			let stage = this.allFeatures.get(tag);
			if (stage === undefined) continue;
			let list = this.stages[stage]?.features ?? [];
			list.splice(list.indexOf(tag), 1);
			this.allFeatures.delete(tag);
			this.globalFeatures.delete(tag);
		}
	}

	/**
	 * Enables every global feature on the given glyphs.
	 *
	 * @param glyphs - The buffer.
	 */
	assignGlobalFeatures(glyphs: readonly GlyphInfo[]) {
		for (let glyph of glyphs) {
			for (let tag of this.globalFeatures) glyph.features.add(tag);
		}
	}

	/**
	 * Runs the stages for substitution: feature stages through GSUB when the font has one,
	 * and every pause callback whether or not it does.
	 *
	 * @param gsub - The GSUB processor, or `null`.
	 * @param glyphs - The buffer, changed in place.
	 */
	substitute(gsub: GsubProcessor | null, glyphs: GlyphInfo[]) {
		for (let stage of this.stages) {
			if (stage.pause !== null) stage.pause({ font: this.font, plan: this, glyphs, gsub });
			else if (gsub !== null && stage.features.length > 0) {
				gsub.userFeatures = this.userFeatures;
				gsub.applyFeatures(stage.features, glyphs);
			}
		}
	}

	/**
	 * Runs the feature stages for positioning; pause callbacks belong to substitution.
	 *
	 * @param gpos - The GPOS processor.
	 * @param glyphs - The buffer.
	 * @param positions - Its positions, changed in place.
	 */
	position(gpos: LayoutProcessor, glyphs: GlyphInfo[], positions: GlyphPosition[]) {
		for (let stage of this.stages) {
			if (stage.pause === null && stage.features.length > 0) {
				gpos.userFeatures = this.userFeatures;
				gpos.applyFeatures(stage.features, glyphs, positions);
			}
		}
	}

	/**
	 * Adds features to the last stage; see `add`.
	 *
	 * @param features - Tags.
	 * @param global - Whether every glyph gets them.
	 */
	#addFeatures(features: readonly string[], global: boolean) {
		let index = this.stages.length - 1;
		let stage = this.stages[index];
		if (stage === undefined) return;
		for (let tag of features) {
			if (!this.allFeatures.has(tag)) {
				stage.features.push(tag);
				this.allFeatures.set(tag, index);
			}
			if (global) this.globalFeatures.add(tag);
		}
	}
}

/**
 * Whether a feature argument is a list of tags rather than groups or values by tag.
 *
 * @param features - What a shaper or the user passed.
 */
function isTagList(features: unknown): features is readonly string[] {
	return Array.isArray(features);
}
