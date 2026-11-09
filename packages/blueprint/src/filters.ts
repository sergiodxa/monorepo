/**
 * The filters a placeholder pipes its value through, built on `@sdxc/strings`. Case filters work
 * on each `/` segment, so a nested name such as `users/show-page` keeps its folders while its
 * words change case.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	camelize,
	dasherize,
	humanize,
	pluralize,
	singularize,
	slugify,
	titleize,
	underscore,
} from "@sdxc/strings";

/** Turns one text value into another. */
export type Filter = (value: string) => string;

/** `transform` applied to each `/` segment of `value`. */
function perSegment(transform: Filter): Filter {
	return (value) => value.split("/").map(transform).join("/");
}

/** A segment in snake case, whatever case it arrived in. */
function snake(segment: string): string {
	return underscore(segment.trim().replaceAll(/[\s-]+/g, "_"));
}

/** Every filter a stub can use without the caller adding any. */
export const FILTERS: Readonly<Record<string, Filter>> = {
	camel: perSegment((segment) => camelize(snake(segment))),
	pascal: perSegment((segment) => camelize(snake(segment), { upperFirst: true })),
	kebab: perSegment((segment) => dasherize(snake(segment))),
	snake: perSegment(snake),
	humanize: perSegment((segment) => humanize(snake(segment))),
	title: perSegment((segment) => titleize(humanize(snake(segment)))),
	slug: (value) => slugify(value),
	plural: (value) => pluralize(value),
	singular: (value) => singularize(value),
	upper: (value) => value.toUpperCase(),
	lower: (value) => value.toLowerCase(),
	upperFirst: (value) => value.charAt(0).toUpperCase() + value.slice(1),
	lowerFirst: (value) => value.charAt(0).toLowerCase() + value.slice(1),
	base: (value) => value.split("/").at(-1) ?? "",
};
