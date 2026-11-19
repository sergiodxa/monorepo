/**
 * Live preview for `BoardingPass`: a Larkwing Air pass from Marrow Bay to Vellis with the route,
 * gate, seat and zone, torn off above a code drawn from the booking's data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { BoardingPass } from "@sdxc/ui/travel/boarding-pass";

/** The source the page shows, matching the markup below. */
const CODE = `<BoardingPass
	label="Boarding pass, Marrow Bay to Vellis"
	airline={{ name: "Larkwing Air", mark: <LarkwingMark /> }}
	passenger="Ana Ortiz"
	from={{ code: "MRW", city: "Marrow Bay", time: "08:40" }}
	to={{ code: "VLS", city: "Vellis", time: "11:05" }}
	flight="LK 482"
	date="14 Mar"
	boards="08:05"
	gate="B12"
	seat="14C"
	zone="3"
	cabin="Economy"
	confirmation="K7Q2XR"
	code="LK482|20260314|MRWVLS|14C|K7Q2XR"
	labels={{
		passenger: "Passenger", flight: "Flight", date: "Date", boards: "Boards", gate: "Gate",
		seat: "Seat", zone: "Zone", cabin: "Cabin", confirmation: "Confirmation",
		from: "From", to: "To", code: "Boarding code for confirmation K7Q2XR",
	}}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "22rem", marginBlock: "1.5rem" })]}>
			<BoardingPass
				label="Boarding pass, Marrow Bay to Vellis"
				airline={{
					name: "Larkwing Air",
					mark: (
						<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
							<path d="M2 14 C7 6 14 5 22 7 C15 8 11 11 9 17 C8 14 5 13 2 14 Z" />
						</svg>
					),
				}}
				passenger="Ana Ortiz"
				from={{ code: "MRW", city: "Marrow Bay", time: "08:40" }}
				to={{ code: "VLS", city: "Vellis", time: "11:05" }}
				flight="LK 482"
				date="14 Mar"
				boards="08:05"
				gate="B12"
				seat="14C"
				zone="3"
				cabin="Economy"
				confirmation="K7Q2XR"
				code="LK482|20260314|MRWVLS|14C|K7Q2XR"
				labels={{
					passenger: "Passenger",
					flight: "Flight",
					date: "Date",
					boards: "Boards",
					gate: "Gate",
					seat: "Seat",
					zone: "Zone",
					cabin: "Cabin",
					confirmation: "Confirmation",
					from: "From",
					to: "To",
					code: "Boarding code for confirmation K7Q2XR",
				}}
			/>
		</div>
	),
};
