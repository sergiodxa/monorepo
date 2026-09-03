/**
 * The package entrypoint: English inflection, Chicago-style title case, URL
 * slugs, and grapheme-safe text operations, re-exported from one module.
 * Every vocabulary is passed in per inflector or titleizer, so results stay
 * independent of which module imported first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type {
	CamelizeOptions,
	HumanizeOptions,
	Inflector,
	InflectorOptions,
	IrregularPair,
} from "./inflect.js";

export {
	camelize,
	createInflector,
	dasherize,
	humanize,
	ordinalize,
	pluralize,
	singularize,
	underscore,
} from "./inflect.js";

export type { SlugifyOptions } from "./slugify.js";

export { slugify } from "./slugify.js";

export type { ExcerptOptions, InitialsOptions, LocaleOptions, TruncateOptions } from "./text.js";

export { capitalize, excerpt, initials, truncate, wordCount } from "./text.js";

export type { Titleizer, TitleizeOptions } from "./titleize.js";

export { createTitleizer, titleize } from "./titleize.js";
