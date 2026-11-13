/**
 * Quoin's calendar for the next twelve months: two project slots a month, the studio's
 * whole capacity, drawn filled where a project holds them and open where one could start,
 * so "booking from March" is read off the calendar rather than taken on trust.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { caption, RULE } from "~/resources/views/demos/studio/grid";

/** The months from November 2026, and how many of the two slots a project holds in each. */
const MONTHS = [
	{ month: "Nov", year: 2026, booked: 2 },
	{ month: "Dec", year: 2026, booked: 2 },
	{ month: "Jan", year: 2027, booked: 2 },
	{ month: "Feb", year: 2027, booked: 2 },
	{ month: "Mar", year: 2027, booked: 1 },
	{ month: "Apr", year: 2027, booked: 1 },
	{ month: "May", year: 2027, booked: 1 },
	{ month: "Jun", year: 2027, booked: 0 },
	{ month: "Jul", year: 2027, booked: 0 },
	{ month: "Aug", year: 2027, booked: 0 },
	{ month: "Sep", year: 2027, booked: 0 },
	{ month: "Oct", year: 2027, booked: 0 },
];

/** How many projects the studio runs at once. */
const SLOTS = 2;

/**
 * Renders the twelve months as a table-like grid of four by three, each month's two slots
 * as squares, with a key under it. The first month with a free slot is marked in the brand
 * ink, the place a new project would start.
 *
 * @returns The render function producing the calendar.
 */
export default function StudioAvailability() {
	return () => {
		let first = MONTHS.findIndex((entry) => entry.booked < SLOTS);

		return (
			<div
				id="availability"
				data-slot="studio-availability"
				mix={[raw({ display: "grid", gap: "1rem" })]}
			>
				<ol aria-label="Project slots, November 2026 to October 2027" mix={[months()]}>
					{MONTHS.map((entry, index) => {
						let open = SLOTS - entry.booked;
						let label = `${entry.month} ${entry.year}: ${open === 0 ? "fully booked" : `${open} of ${SLOTS} slots open`}`;

						return (
							<li
								key={`${entry.month}-${entry.year}`}
								aria-label={label}
								data-open={open > 0 ? "true" : undefined}
								data-first-open={index === first ? "true" : undefined}
								mix={[month(index === first)]}
							>
								<span
									aria-hidden="true"
									mix={[caption(), index === first ? raw({ color: "var(--ui-brand-fg)" }) : []]}
								>
									{entry.month}
									{entry.month === "Jan" || index === 0 ? ` ’${String(entry.year).slice(2)}` : ""}
								</span>
								<span aria-hidden="true" mix={[raw({ display: "flex", gap: "0.25rem" })]}>
									{Array.from({ length: SLOTS }, (_, slot) => (
										<span key={slot} mix={[square(slot < entry.booked)]} />
									))}
								</span>
							</li>
						);
					})}
				</ol>
				<p
					mix={[
						caption(),
						raw({ margin: "0", display: "flex", flexWrap: "wrap", gap: "0.5rem 1.5rem" }),
					]}
				>
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })]}>
						<span aria-hidden="true" mix={[square(true)]} /> Booked
					</span>
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })]}>
						<span aria-hidden="true" mix={[square(false)]} /> Open
					</span>
				</p>
			</div>
		);
	};
}

/** The months grid: four across at every width, ruled between rows. */
function months() {
	return raw({
		margin: "0",
		padding: "0",
		listStyle: "none",
		display: "grid",
		gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
		borderBlockStart: RULE,
	});
}

/**
 * One month: its name over its slots, on a brand tint for the first month a project could
 * start in.
 *
 * @param first Whether this is the first month with a free slot.
 */
function month(first: boolean) {
	return raw({
		display: "grid",
		gap: "0.625rem",
		paddingBlock: "0.875rem",
		borderBlockEnd: RULE,
		paddingInline: "0.5rem",
		backgroundColor: first ? "var(--ui-brand-bg-tint)" : "transparent",
	});
}

/**
 * One slot: a filled square in the ink when a project holds it, an outlined one when open.
 *
 * @param booked Whether a project holds the slot.
 */
function square(booked: boolean) {
	return raw({
		display: "inline-block",
		inlineSize: "0.875rem",
		blockSize: "0.875rem",
		backgroundColor: booked ? "var(--ui-neutral-fg-emphasis)" : "transparent",
		boxShadow: "inset 0 0 0 1.5px var(--ui-neutral-fg-emphasis)",
	});
}
