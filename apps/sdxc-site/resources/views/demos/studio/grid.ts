/**
 * Quoin's page grid and caption style: twelve columns from the `lg` container of every band,
 * one column below it, and the small mono label every running head uses, so each band hangs
 * on the same columns the case studies do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { combine, raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";

import { DIDONE, MONO } from "~/resources/views/demos/studio/type";

/** The container every landing band publishes, which the grid's breakpoint queries. */
export const BAND = "ui-landing-section";

/** A printed column rule in the band's hairline. */
export const RULE = "1px solid var(--ui-landing-hairline)";

/**
 * The page grid: one column on a phone, twelve with a 2rem gutter from the `lg` container.
 *
 * @returns A mixin for a band's grid element.
 */
export function pageGrid() {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			rowGap: "2rem",
			inlineSize: "100%",
		}),
		at("lg", BAND, raw({ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", columnGap: "2rem" })),
	]);
}

/**
 * Places a cell on the page grid from the `lg` container; it spans the single column below.
 *
 * @param columns A `grid-column` value, such as `"4 / -1"`.
 * @returns A mixin for the cell.
 */
export function span(columns: string) {
	return at("lg", BAND, raw({ gridColumn: columns }));
}

/**
 * The caption: mono, small, tracked capitals in the muted ink, with even figures.
 *
 * @returns A mixin for a running head, a label or a scale.
 */
export function caption() {
	return raw({
		fontFamily: MONO,
		fontSize: "0.75rem",
		lineHeight: "1.4",
		letterSpacing: "0.1em",
		textTransform: "uppercase",
		fontVariantNumeric: "tabular-nums",
		color: "var(--ui-neutral-fg-muted)",
	});
}

/**
 * A band's running head: the caption on a ruled line across the whole grid, with the
 * section's number at the start and its name after.
 *
 * @returns A mixin for the running head paragraph.
 */
export function runningHead() {
	return combine([
		caption(),
		raw({
			gridColumn: "1 / -1",
			margin: "0",
			display: "flex",
			justifyContent: "space-between",
			gap: "1rem",
			paddingBlockEnd: "0.75rem",
			borderBlockEnd: RULE,
		}),
	]);
}

/**
 * A band's chapter title in the Didone, two steps below the hero's poster scale and held to
 * eighteen characters a line so it breaks like a printed headline.
 *
 * @returns A mixin for the band's `h2`.
 */
export function chapter() {
	return raw({
		margin: "0",
		fontFamily: DIDONE,
		fontWeight: "400",
		fontSize: "clamp(2.25rem, 5.5cqi, 4.5rem)",
		lineHeight: "1.02",
		letterSpacing: "-0.025em",
		color: "var(--ui-neutral-fg-emphasis)",
		textWrap: "balance",
		maxInlineSize: "18ch",
	});
}
