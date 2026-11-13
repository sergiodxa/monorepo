/**
 * Getting to Rotterdam and staying the night: the train, the metro and the bike from the
 * station, then the three hotels holding rooms, numbered as the venue map pins them, each with
 * the conference rate and the code that books it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { css } from "remix/component";

import { HOTELS } from "~/resources/views/demos/conference/data";
import { BLUE, DISPLAY, MONO, PAPER } from "~/resources/views/demos/conference/ink";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The ways in, each with its time from where most people start. */
const ROUTES = [
	["By train", "Schiphol to Rotterdam Centraal takes 25 minutes, every ten minutes all day."],
	["By metro", "Lines D and E from Centraal to Rijnhaven, three stops, then the six-minute walk."],
	["By bike", "Fifteen minutes from Centraal over the Erasmusbrug; racks for 400 at the door."],
] as const;

/**
 * Renders the band: the routes and the hotels as two columns from the `lg` container.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceTravel() {
	return () => (
		<LandingSection id="travel" mix={[renderNearView(760, 1500)]}>
			<LandingHeader
				eyebrow="Travel and stay"
				layout="split"
				description={
					<>
						Rotterdam is 25 minutes from Schiphol and two and a half hours from Paris, Brussels and
						London by train. <strong>Rooms hold at the conference rate until 1 March.</strong>
					</>
				}
				parts={{ title: [css({ textTransform: "uppercase" })] }}
			>
				Getting here is the easy part
			</LandingHeader>
			<div
				mix={css({
					display: "grid",
					gap: "2.5rem",
					"@container (min-width: 64rem)": {
						gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
						gap: "4rem",
					},
				})}
			>
				<Column title="Getting there">
					{ROUTES.map(([how, detail]) => (
						<li
							key={how}
							mix={css({
								display: "grid",
								gap: "0.25rem",
								paddingBlock: "1rem",
								borderBlockEnd: `1px solid ${BLUE}`,
							})}
						>
							<strong>{how}</strong>
							<span>{detail}</span>
						</li>
					))}
				</Column>
				<Column title="Where to stay">
					{HOTELS.map((hotel) => (
						<li
							key={hotel.pin}
							mix={css({
								display: "grid",
								gridTemplateColumns: "2.25rem minmax(0, 1fr) auto",
								alignItems: "center",
								gap: "1rem",
								paddingBlock: "1rem",
								borderBlockEnd: `1px solid ${BLUE}`,
							})}
						>
							<span
								aria-hidden="true"
								mix={css({
									display: "grid",
									placeItems: "center",
									inlineSize: "2.25rem",
									aspectRatio: "1",
									borderRadius: "50%",
									backgroundColor: BLUE,
									color: PAPER,
									fontFamily: MONO,
									fontWeight: "700",
								})}
							>
								{hotel.pin}
							</span>
							<span mix={css({ display: "grid", gap: "0.125rem", minInlineSize: "0" })}>
								<strong>
									{hotel.name}
									<span
										mix={css({
											position: "absolute",
											clipPath: "inset(50%)",
											whiteSpace: "nowrap",
										})}
									>
										, pin {hotel.pin} on the map
									</span>
								</strong>
								<span mix={css({ fontSize: "0.875rem" })}>{hotel.walk}</span>
							</span>
							<span
								mix={css({
									fontFamily: MONO,
									fontSize: "0.875rem",
									fontVariantNumeric: "tabular-nums",
									textAlign: "end",
								})}
							>
								{hotel.rate}
							</span>
						</li>
					))}
					<li mix={css({ paddingBlockStart: "1rem", fontSize: "0.9375rem" })}>
						Book with the code{" "}
						<code
							mix={css({
								paddingInline: "0.375rem",
								backgroundColor: BLUE,
								color: PAPER,
								fontFamily: MONO,
								fontWeight: "700",
							})}
						>
							OVERPRINT27
						</code>{" "}
						on the hotel's own site.
					</li>
				</Column>
			</div>
		</LandingSection>
	);
}

/** A titled, ruled list, one of the band's two columns. */
function Column(handle: Handle<{ title: string; children: RemixNode }>) {
	return () => (
		<div mix={css({ display: "grid", alignContent: "start" })}>
			<h3
				mix={css({
					margin: "0 0 0.25rem",
					paddingBlockEnd: "0.5rem",
					borderBlockEnd: `3px solid ${BLUE}`,
					fontFamily: DISPLAY,
					fontWeight: "900",
					fontSynthesis: "none",
					fontSize: "2rem",
					lineHeight: "1",
					textTransform: "uppercase",
				})}
			>
				{handle.props.title}
			</h3>
			<ul mix={css({ listStyle: "none", margin: "0", padding: "0" })}>{handle.props.children}</ul>
		</div>
	);
}
