/**
 * The figures Strata Two's page quotes in more than one place: the price, the deposit, the
 * open batch, its size and ship date, and the batches around it. Every band reads them from
 * here, so the hero, the comparison and the preorder never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One production batch and where it stands. */
export interface Batch {
	number: string;
	units: number;
	reserved: number;
	ships: string;
	state: "shipped" | "sold out" | "open" | "next";
}

/** The batches of the first production year, oldest first. */
export const BATCHES: Batch[] = [
	{ number: "01", units: 300, reserved: 300, ships: "Shipped 4 November 2026", state: "shipped" },
	{ number: "02", units: 900, reserved: 900, ships: "Ships 12 January 2027", state: "sold out" },
	{ number: "03", units: 1200, reserved: 846, ships: "Ships 9 March 2027", state: "open" },
	{ number: "04", units: 1200, reserved: 0, ships: "Opens when 03 fills", state: "next" },
];

/** The batch a preorder placed today joins. */
const OPEN = BATCHES.find((batch) => batch.state === "open") ?? BATCHES[0]!;

/** The preorder's terms, as every band states them. */
export const PREORDER = {
	price: "$279",
	previousPrice: "$249",
	deposit: "$40",
	batch: OPEN.number,
	units: OPEN.units,
	reserved: OPEN.reserved,
	ships: "9 March 2027",
} as const;

/** The id of the preorder form, which the finish radios elsewhere on the page belong to. */
export const PREORDER_FORM = "strata-preorder";
