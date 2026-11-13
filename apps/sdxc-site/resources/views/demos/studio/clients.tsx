/**
 * Quoin's client list, set as a printed index: each client's name in the Didone with its
 * sector and the years the studio has worked with it, so how long clients stay is visible
 * at a glance instead of claimed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingSection } from "@sdxc/ui/landing";
import { landingLead } from "@sdxc/ui/styles";

import { renderNearView } from "~/resources/views/demos/near-view";
import {
	BAND,
	caption,
	chapter,
	pageGrid,
	RULE,
	runningHead,
	span,
} from "~/resources/views/demos/studio/grid";
import { DIDONE } from "~/resources/views/demos/studio/type";

/** The clients, longest-standing first, with the years the studio has worked for each. */
const CLIENTS = [
	{ name: "Mercer Public Library", sector: "Libraries", years: "2016–" },
	{ name: "Harbour Line", sector: "Transit", years: "2017–" },
	{ name: "Province of Zeeland", sector: "Government", years: "2018–2024" },
	{ name: "Vandersteen & Co.", sector: "Logistics", years: "2019–" },
	{ name: "Oda Ceramics", sector: "Retail", years: "2020–" },
	{ name: "Hôpital Saint-Rémi", sector: "Healthcare", years: "2020–2023" },
	{ name: "North Sea Wind Trust", sector: "Energy", years: "2021–" },
	{ name: "Kunsthal Gent", sector: "Culture", years: "2021–2022" },
	{ name: "Brouwerij De Kade", sector: "Food & drink", years: "2022–" },
	{ name: "Atlas Legal", sector: "Legal", years: "2022–" },
	{ name: "Scheldt Rowing Club", sector: "Sport", years: "2023–" },
	{ name: "Fondation Moreau", sector: "Philanthropy", years: "2024–" },
];

/**
 * Renders the claim in the first four columns and the index in the last eight, two
 * entries a row from the `xl` container.
 *
 * @returns The render function producing the clients band.
 */
export default function StudioClients() {
	return () => (
		<LandingSection id="clients" mix={[renderNearView(585, 1334)]}>
			<div mix={[pageGrid(), raw({ rowGap: "3rem" })]}>
				<p mix={[runningHead()]}>
					<span>02 — Clients</span>
					<span>Since 2014</span>
				</p>
				<div mix={[span("1 / 5"), raw({ display: "grid", gap: "1.5rem", alignContent: "start" })]}>
					<h2 mix={[chapter()]}>Most of them come back</h2>
					<p mix={[landingLead(), raw({ margin: "0" })]}>
						Nine of the twelve clients below are still working with us. The open years are the ones
						that have not ended.
					</p>
				</div>
				<ul mix={[index()]}>
					{CLIENTS.map((client) => (
						<li key={client.name} mix={[entry()]}>
							<span
								mix={[
									raw({
										gridArea: "name",
										fontFamily: DIDONE,
										fontSize: "1.5rem",
										lineHeight: "1.2",
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{client.name}
							</span>
							<span mix={[caption(), raw({ gridArea: "sector" })]}>{client.sector}</span>
							<span mix={[caption(), raw({ gridArea: "years", textAlign: "end" })]}>
								{client.years}
							</span>
						</li>
					))}
				</ul>
			</div>
		</LandingSection>
	);
}

/** The index: one column of ruled entries, two from the `xl` container, on columns 6 to 12. */
function index() {
	return [
		raw({
			margin: "0",
			padding: "0",
			listStyle: "none",
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			columnGap: "2rem",
			alignContent: "start",
		}),
		at("lg", BAND, raw({ gridColumn: "6 / -1" })),
		at("xl", BAND, raw({ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" })),
	];
}

/** One entry: the name across the top, the sector and years beneath it on a hairline. */
function entry() {
	return raw({
		display: "grid",
		gridTemplateColumns: "minmax(0, 1fr) auto",
		gridTemplateAreas: '"name name" "sector years"',
		gap: "0.375rem 1rem",
		paddingBlock: "1rem",
		borderBlockStart: RULE,
	});
}
