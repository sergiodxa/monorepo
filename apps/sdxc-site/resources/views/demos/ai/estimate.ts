/**
 * Margin's usage pricing and the estimate its calculator prints: free hours each month,
 * two per-hour rates, and a retention choice, read from the page's query string so the
 * calculator answers through a plain GET form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

/** Recorded hours each workspace gets free every month. */
export const FREE_HOURS = 5;

/** Hours a month billed at the first rate; every hour past it takes the lower rate. */
export const FIRST_TIER_HOURS = 200;

/** Price per recorded hour up to {@link FIRST_TIER_HOURS}, in cents. */
export const FIRST_RATE_CENTS = 36;

/** Price per recorded hour past {@link FIRST_TIER_HOURS}, in cents. */
export const VOLUME_RATE_CENTS = 24;

/** Most hours the calculator accepts, so a typo never prints a five-figure bill. */
export const MAX_HOURS = 2000;

/** Hours the calculator shows before a reader enters their own. */
export const DEFAULT_HOURS = 40;

/** How long Margin keeps a transcript once its notes are written. */
export type Retention = "notes-only" | "90-days" | "2-years";

/** Every retention choice, in the order the form lists them. */
export const RETENTIONS: readonly Retention[] = ["notes-only", "90-days", "2-years"];

/** What each retention choice keeps, as the form labels it. */
export const RETENTION_LABELS: Record<Retention, string> = {
	"notes-only": "Delete it once the notes are written",
	"90-days": "Keep it 90 days",
	"2-years": "Keep it 2 years",
};

/** Extra cents per billed hour for each retention; only the long archive costs more. */
export const RETENTION_CENTS: Record<Retention, number> = {
	"notes-only": 0,
	"90-days": 0,
	"2-years": 4,
};

/** Retention the calculator shows before a reader picks one. */
export const DEFAULT_RETENTION: Retention = "90-days";

/** The calculator's inputs once read and bounded. */
export interface EstimateInput {
	hours: number;
	retention: Retention;
}

/** One line of the bill. */
export interface EstimateRow {
	label: string;
	/** The arithmetic behind the amount, such as `35 h × $0.36`. */
	detail: string;
	cents: number;
}

/** A month's bill for the inputs. */
export interface Estimate {
	rows: EstimateRow[];
	totalCents: number;
}

/** Whole hours from 0 to {@link MAX_HOURS}. */
const HOURS = coerce
	.number()
	.refine((value) => Number.isInteger(value) && value >= 0 && value <= MAX_HOURS);

/** One of the {@link RETENTIONS}. */
const RETENTION = s.enum_(["notes-only", "90-days", "2-years"]);

/**
 * Reads the calculator's fields from a query string. A missing or malformed field falls
 * back to its default, so a hand-edited URL still renders an estimate.
 *
 * @param params The page's query.
 * @returns The inputs the estimate is computed for.
 */
export function readEstimateInput(params: URLSearchParams): EstimateInput {
	let hours = s.parseSafe(HOURS, params.get("hours") ?? "");
	let retention = s.parseSafe(RETENTION, params.get("retention") ?? "");
	return {
		hours: hours.success ? hours.value : DEFAULT_HOURS,
		retention: retention.success ? retention.value : DEFAULT_RETENTION,
	};
}

/**
 * Prices a month: the free hours first, then the first tier, then the volume rate, and the
 * retention surcharge on every billed hour.
 *
 * @param input Hours recorded and the retention picked.
 * @returns The bill's rows, zero-cost rows included so the free hours show, and its total.
 */
export function estimate(input: EstimateInput): Estimate {
	let free = Math.min(input.hours, FREE_HOURS);
	let first = Math.min(Math.max(input.hours - FREE_HOURS, 0), FIRST_TIER_HOURS - FREE_HOURS);
	let volume = Math.max(input.hours - FIRST_TIER_HOURS, 0);
	let rows: EstimateRow[] = [
		{ label: "Free hours", detail: `${free} h × $0.00`, cents: 0 },
		{
			label: "Recorded hours",
			detail: `${first} h × ${formatCents(FIRST_RATE_CENTS)}`,
			cents: first * FIRST_RATE_CENTS,
		},
	];
	if (volume > 0) {
		rows.push({
			label: `Past ${FIRST_TIER_HOURS} h`,
			detail: `${volume} h × ${formatCents(VOLUME_RATE_CENTS)}`,
			cents: volume * VOLUME_RATE_CENTS,
		});
	}
	let surcharge = RETENTION_CENTS[input.retention];
	if (surcharge > 0) {
		rows.push({
			label: "Two-year archive",
			detail: `${first + volume} h × ${formatCents(surcharge)}`,
			cents: (first + volume) * surcharge,
		});
	}
	return { rows, totalCents: rows.reduce((sum, row) => sum + row.cents, 0) };
}

/**
 * Prints cents as US dollars with two decimals and thousands separators.
 *
 * @param cents A whole number of cents.
 * @returns Such as `$1,234.50`.
 */
export function formatCents(cents: number): string {
	return `$${(cents / 100).toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}
