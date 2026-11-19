/**
 * Live preview for `FlightOption`: two rows of a results list for a Merrow ⇄ Vellis round trip,
 * the first ringed and badged "Cheapest", each with its price and a select button that posts
 * the chosen option with no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Badge, Button } from "@sdxc/ui";
import { FlightOption } from "@sdxc/ui/travel/flight-option";

/** The source the page shows, matching the markup below. */
const CODE = `<FlightOption
	aria-label="Larkwing Air, $412"
	price="$412"
	priceDetail="Round trip per person"
	badges={<Badge color="success" variant="secondary">Cheapest</Badge>}
	action={<Button type="submit" name="option" value="lw-214">Select</Button>}
	featured
>
	<FlightOption.Journey airline="Larkwing Air" departure={{ time: "08:40", code: "MRW" }}
		arrival={{ time: "10:55", code: "VLS" }} duration="2h 15m" stopsLabel="Nonstop" />
	<FlightOption.Journey airline="Larkwing Air" departure={{ time: "22:10", code: "VLS" }}
		arrival={{ time: "06:05", code: "MRW" }} duration="7h 55m" stops={1}
		stopsLabel="1 stop · OSK" dayOffset="+1" dayOffsetLabel="arrives the next day" />
</FlightOption>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			action="#select"
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "46rem",
					marginBlock: "1.5rem",
				}),
			]}
		>
			<ol
				mix={[raw({ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.75rem" })]}
			>
				<li>
					<FlightOption
						aria-label="Larkwing Air, $412"
						price="$412"
						priceDetail="Round trip per person"
						badges={
							<Badge color="success" variant="secondary">
								Cheapest
							</Badge>
						}
						action={
							<Button type="submit" name="option" value="lw-214">
								Select
							</Button>
						}
						featured
					>
						<FlightOption.Journey
							airline="Larkwing Air"
							departure={{ time: "08:40", code: "MRW", city: "Merrow" }}
							arrival={{ time: "10:55", code: "VLS", city: "Vellis" }}
							duration="2h 15m"
							stopsLabel="Nonstop"
						/>
						<FlightOption.Journey
							airline="Larkwing Air"
							departure={{ time: "22:10", code: "VLS", city: "Vellis" }}
							arrival={{ time: "06:05", code: "MRW", city: "Merrow" }}
							duration="7h 55m"
							stops={1}
							stopsLabel="1 stop · OSK"
							dayOffset="+1"
							dayOffsetLabel="arrives the next day"
						/>
					</FlightOption>
				</li>
				<li>
					<FlightOption
						aria-label="Fenwick Connect, $468"
						price="$468"
						priceDetail="Round trip per person"
						badges={
							<Badge color="brand" variant="secondary">
								Fastest
							</Badge>
						}
						action={
							<Button type="submit" name="option" value="fc-88" variant="outline" color="neutral">
								Select
							</Button>
						}
					>
						<FlightOption.Journey
							airline="Fenwick Connect"
							departure={{ time: "07:15", code: "MRW", city: "Merrow" }}
							arrival={{ time: "09:20", code: "VLS", city: "Vellis" }}
							duration="2h 05m"
							stopsLabel="Nonstop"
						/>
						<FlightOption.Journey
							airline="Fenwick Connect"
							departure={{ time: "19:40", code: "VLS", city: "Vellis" }}
							arrival={{ time: "21:50", code: "MRW", city: "Merrow" }}
							duration="2h 10m"
							stopsLabel="Nonstop"
						/>
					</FlightOption>
				</li>
			</ol>
		</form>
	),
};
