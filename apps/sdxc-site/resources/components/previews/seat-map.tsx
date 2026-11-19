/**
 * Live preview for `SeatMap`: a Larkwing Air narrow-body cabin with an extra-legroom front row,
 * an exit row, the wing and a few taken seats, picked inside a form that posts the seat.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SeatMap as SeatMapTypes } from "@sdxc/ui/travel/seat-map";

import { raw } from "@sdxc/u/general";
import { SeatMap } from "@sdxc/ui/travel/seat-map";

/** Seats someone already holds. */
const TAKEN = new Set(["10A", "10F", "11B", "11C", "13D", "14E", "15A", "15B", "17C", "18F"]);

/** Rows 10 to 19 of a three-and-three cabin: row 10 has extra legroom, row 12 sits at the exit. */
const ROWS: SeatMapTypes.Row[] = Array.from({ length: 10 }, (_, index) => {
	let number = 10 + index;
	return {
		number,
		seats: "ABCDEF".split("").map((letter): SeatMapTypes.Seat => {
			let id = `${number}${letter}`;
			if (number === 10) {
				return {
					id,
					status: TAKEN.has(id) ? "taken" : "available",
					kind: "extra-legroom",
					price: "$38",
				};
			}
			if (number === 12) return { id, status: "available", kind: "exit", price: "$24" };
			return { id, status: TAKEN.has(id) ? "taken" : "available" };
		}),
	};
});

/** The source the page shows, matching the markup below. */
const CODE = `<form method="post">
	<SeatMap
		name="seat"
		label="Choose a seat"
		labels={{ taken: "taken", aisle: "aisle", window: "window", exit: "exit row", kinds: { "extra-legroom": "extra legroom", exit: "exit seat" } }}
		layout="ABC DEF"
		rows={rows}
		selected="14C"
		deck="Main deck · LK 482"
		exitRows={[12]}
		wings={[12, 17]}
		sections={[{ from: 10, title: "Larkwing Plus" }, { from: 11, title: "Economy" }]}
	/>
	<SeatMap.Legend
		items={[
			{ swatch: "available", label: "Available" },
			{ swatch: "selected", label: "Your seat" },
			{ swatch: "extra-legroom", label: "Extra legroom" },
			{ swatch: "exit", label: "Exit row" },
			{ swatch: "taken", label: "Taken" },
		]}
	/>
</form>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			action="#seat"
			mix={[
				raw({
					display: "grid",
					gap: "1rem",
					inlineSize: "100%",
					maxInlineSize: "22rem",
					marginBlock: "1.5rem",
					"--ui-seat-map-max-height": "26rem",
				}),
			]}
		>
			<SeatMap
				name="seat"
				label="Choose a seat"
				labels={{
					taken: "taken",
					aisle: "aisle",
					window: "window",
					exit: "exit row",
					kinds: { "extra-legroom": "extra legroom", exit: "exit seat" },
				}}
				layout="ABC DEF"
				rows={ROWS}
				selected="14C"
				deck="Main deck · LK 482"
				exitRows={[12]}
				wings={[12, 17]}
				sections={[
					{ from: 10, title: "Larkwing Plus" },
					{ from: 11, title: "Economy" },
				]}
			/>
			<SeatMap.Legend
				items={[
					{ swatch: "available", label: "Available" },
					{ swatch: "selected", label: "Your seat" },
					{ swatch: "extra-legroom", label: "Extra legroom" },
					{ swatch: "exit", label: "Exit row" },
					{ swatch: "taken", label: "Taken" },
				]}
			/>
		</form>
	),
};
