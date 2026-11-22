/**
 * Reads a Strata Two reservation from the page's URL. The preorder form submits by GET to
 * this same page, so the server renders the confirmation from the query, with no script and
 * no stored state; anything the form could not have sent reads as no reservation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

/** The layouts the form offers. */
export const LAYOUTS = [
	{ value: "ansi", name: "ANSI", detail: "84 keys, US" },
	{ value: "iso", name: "ISO", detail: "85 keys, UK and EU" },
] as const;

/** The switches the form offers. */
export const SWITCHES = [
	{ value: "silk", name: "Silk", detail: "Linear, 45 g" },
	{ value: "notch", name: "Notch", detail: "Tactile, 55 g" },
] as const;

/** What a submitted form carries; `reserve` marks a submission rather than a plain visit. */
const ORDER = f.object({
	finish: f.field(s.defaulted(s.enum_(["raw", "graphite", "bronze"]), "raw")),
	layout: f.field(s.defaulted(s.enum_(["ansi", "iso"]), "ansi")),
	switch: f.field(s.defaulted(s.enum_(["silk", "notch"]), "silk")),
	reserve: f.field(s.optional(s.literal("1"))),
});

/** A reservation's choices, and whether the reader has submitted them. */
export interface Order {
	finish: "raw" | "graphite" | "bronze";
	layout: "ansi" | "iso";
	switch: "silk" | "notch";
	reserved: boolean;
}

/**
 * The reservation the URL describes, or the defaults when the URL holds none or holds
 * values the form never sends.
 *
 * @param url The requested page address; absent when the page renders outside a request.
 * @returns The choices to pre-check and whether to show the confirmation.
 */
export function readOrder(url: URL | undefined): Order {
	let fallback: Order = { finish: "raw", layout: "ansi", switch: "silk", reserved: false };
	if (!url) return fallback;
	let result = s.parseSafe(ORDER, url.searchParams);
	if (!result.success) return fallback;
	let { reserve, ...choices } = result.value;
	return { ...choices, reserved: reserve === "1" };
}
