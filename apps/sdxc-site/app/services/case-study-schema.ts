/**
 * The front matter every case study in `resources/content/showcase` is held to. It imports
 * nothing but the schema library, so the capture script reads the same shots the site does
 * from outside the bundler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

/**
 * One screenshot a case study shows, served at `/showcase/<slug>/<id>.jpg`. `page` is a path
 * under the demo (`""` for its home, a query or `#anchor` kept) or, for an application in
 * production, a full URL; the capture script reads the same fields.
 */
const shotSchema = s.object({
	id: s.string(),
	page: s.string(),
	alt: s.string(),
	/** A phone's viewport instead of a desktop's. Default: `desktop`. */
	viewport: s.optional(s.enum_(["desktop", "phone"])),
	/** A CSS selector to spotlight: the page dims around it and the shot crops to it. */
	highlight: s.optional(s.string()),
	/** A CSS selector to click before the shot, to open a dialog, menu or panel. */
	click: s.optional(s.string()),
	/** Milliseconds to wait before the shot, for a chart or map to settle. Default: `600`. */
	wait: s.optional(s.number()),
});

/** One screenshot's capture instructions, as the front matter lists it. */
export type CaseStudyShot = s.InferOutput<typeof shotSchema>;

/** What every case study states in its front matter. */
export const CASE_STUDY_FRONTMATTER = s.object({
	title: s.string(),
	/** The case study's headline: one sentence on what the item achieves. */
	headline: s.string(),
	/** One sentence for the card and the meta description. */
	summary: s.string(),
	/** A few words for the social card, short enough to set large on one line. */
	tagline: s.string(),
	/**
	 * The social card's accent as any CSS colour `@sdxc/raster` parses, for an item whose cover
	 * shows its brand colour too little for the card to read it from the screenshot.
	 */
	accent: s.optional(s.string()),
	/** The id of the shot set under the headline and on the showcase card. */
	cover: s.string(),
	shots: s.array(shotSchema),
});

/** A case study's front matter, as the schema reads it. */
export type CaseStudyFrontmatter = s.InferOutput<typeof CASE_STUDY_FRONTMATTER>;
