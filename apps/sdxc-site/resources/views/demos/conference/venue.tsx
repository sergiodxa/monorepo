/**
 * The venue band: what the building is and what a visitor needs from it, beside the map that
 * shows how to reach its door. The facts are the questions people email the organisers about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LinkButton } from "@sdxc/ui";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";
import { css } from "remix/component";

import { BLUE, MONO } from "~/resources/views/demos/conference/ink";
import VenueMap from "~/resources/views/demos/conference/venue-map";
import { renderNearView } from "~/resources/views/demos/near-view";

/** What the building offers, label then detail. */
const FACTS = [
	["Address", "Fabrieksweg 7, 3072 Rotterdam"],
	["Rooms", "Hall A seats 600, Hall B seats 180, both with induction loops"],
	["Access", "Step-free from the metro, lifts to every floor"],
	["Rest", "Quiet room, prayer room and all-gender toilets on each floor"],
	["Bikes", "Covered racks for 400 bikes by the north door"],
] as const;

/**
 * Renders the band: the copy and facts in one column and the map in the other from the `lg`
 * container, the map under the copy on a phone.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceVenue() {
	return () => (
		<LandingSection id="venue" tone="tinted" mix={[renderNearView(704, 1181)]}>
			<div
				mix={css({
					display: "grid",
					gap: "2.5rem",
					alignItems: "start",
					"@container (min-width: 64rem)": {
						gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
						gap: "4rem",
					},
				})}
			>
				<div mix={css({ display: "grid", gap: "2rem" })}>
					<LandingHeader
						eyebrow="Venue · Katendrecht"
						description={
							<>
								A nineteenth-century ship-propeller foundry on the south bank, its casting floor now
								the main hall. <strong>Six minutes on foot from the metro</strong>, and the river is
								outside the lunch terrace.
							</>
						}
						parts={{ title: [css({ textTransform: "uppercase" })] }}
					>
						A foundry on the river
					</LandingHeader>
					<dl mix={css({ margin: "0", display: "grid", borderBlockStart: `3px solid ${BLUE}` })}>
						{FACTS.map(([label, detail]) => (
							<div
								key={label}
								mix={css({
									display: "grid",
									gridTemplateColumns: "5.5rem minmax(0, 1fr)",
									gap: "1rem",
									paddingBlock: "0.75rem",
									borderBlockEnd: `1px solid ${BLUE}`,
								})}
							>
								<dt
									mix={css({
										fontFamily: MONO,
										fontSize: "0.75rem",
										fontWeight: "700",
										textTransform: "uppercase",
										letterSpacing: "0.08em",
										paddingBlockStart: "0.2rem",
									})}
								>
									{label}
								</dt>
								<dd mix={css({ margin: "0" })}>{detail}</dd>
							</div>
						))}
					</dl>
					<div>
						<LinkButton
							href="/examples/overprint/directions"
							variant="surface"
							mix={[landingCtaChrome()]}
						>
							Directions in your map app
						</LinkButton>
					</div>
				</div>
				<VenueMap />
			</div>
		</LandingSection>
	);
}
