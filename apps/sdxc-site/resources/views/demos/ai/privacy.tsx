/**
 * The privacy band: a ledger of everything Margin stores from a meeting, where it lives,
 * how long it stays and whether a model learns from it, then the three promises the ledger
 * adds up to. Retention here matches the choices the pricing calculator offers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { RETENTION_LABELS } from "~/resources/views/demos/ai/estimate";
import { HandNote } from "~/resources/views/demos/ai/marks";
import { MONO } from "~/resources/views/demos/ai/type";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The ledger's columns, which a phone repeats as labels inside each row. */
const COLUMNS = ["What", "Where it lives", "How long", "Trains a model"] as const;

/** One kind of data Margin holds, and its row in the ledger. */
interface Entry {
	what: string;
	where: string;
	howLong: string;
}

/** Everything a meeting leaves behind, from the rawest to the least sensitive. */
const LEDGER: readonly Entry[] = [
	{
		what: "Audio and video",
		where: "Your region: Frankfurt or Virginia",
		howLong: "Deleted within 24 hours of transcription",
	},
	{
		what: "Transcript",
		where: "Same region",
		howLong: `Your choice: ${RETENTION_LABELS["notes-only"].toLowerCase()}, ${RETENTION_LABELS["90-days"].toLowerCase()} (default), or ${RETENTION_LABELS["2-years"].toLowerCase()}`,
	},
	{
		what: "Notes and to-dos",
		where: "Same region",
		howLong: "Until you delete them",
	},
	{
		what: "Usage counts (no content)",
		where: "Virginia",
		howLong: "13 months, for billing",
	},
];

/** What the ledger adds up to, each a sentence a buyer can hold Margin to. */
const PROMISES = [
	{
		title: "Nothing trains on your meetings",
		body: "Not ours, not a vendor’s. It is in the contract, and there is no setting to switch it on.",
	},
	{
		title: "Models run in your region",
		body: "Speech and notes models run on servers we operate in the region you picked. No third party receives your audio or transcript.",
	},
	{
		title: "Delete means gone",
		body: "Deleting a meeting removes its audio, transcript, notes and backups within 7 days, and the audit log says when.",
	},
] as const;

/**
 * Renders the ledger as a real table, which on a phone stacks each row into a card with
 * its column names repeated beside the values, then the promises in a row of three.
 *
 * @returns The render function producing the band.
 */
export default function MarginPrivacy() {
	return () => (
		<LandingSection id="privacy" tone="tinted" mix={[renderNearView(662, 1505)]}>
			<LandingHeader
				eyebrow="Privacy"
				layout="split"
				description={
					<>
						A recording of your team is the most sensitive thing you will upload this week. Here is
						every copy Margin keeps, and <strong>none of it is used to train a model</strong>.
					</>
				}
			>
				Where your meeting goes
			</LandingHeader>
			<table
				aria-label="What Margin stores, where, and for how long"
				mix={[
					raw({
						inlineSize: "100%",
						borderCollapse: "collapse",
						fontSize: "0.9375rem",
						lineHeight: "1.5",
						backgroundColor: "var(--ui-surface-raised)",
						borderRadius: "var(--ui-landing-radius-surface)",
						boxShadow: "var(--ui-shadow-surface)",
						"@media (max-width: 47.99rem)": {
							"& thead": { display: "none" },
							"& tbody, & tr, & td, & th": { display: "block" },
							"& tr": { paddingBlock: "0.75rem" },
							"& tr + tr": { borderBlockStart: "1px solid var(--ui-landing-hairline)" },
							"& td, & th": { paddingBlock: "0.25rem" },
							"& td::before": {
								content: "attr(data-label)",
								display: "block",
								fontFamily: MONO,
								fontSize: "0.6875rem",
								textTransform: "uppercase",
								letterSpacing: "0.06em",
								color: "var(--ui-neutral-fg-muted)",
							},
						},
						"& th, & td": {
							paddingBlock: "0.875rem",
							paddingInline: "1.25rem",
							textAlign: "start",
							verticalAlign: "top",
						},
						"@media (min-width: 48rem)": {
							"& tbody tr + tr > *": { borderBlockStart: "1px solid var(--ui-landing-hairline)" },
						},
						"& thead th": {
							fontFamily: MONO,
							fontSize: "0.6875rem",
							fontWeight: "500",
							textTransform: "uppercase",
							letterSpacing: "0.06em",
							color: "var(--ui-neutral-fg-muted)",
							borderBlockEnd: "1px solid var(--ui-landing-hairline)",
						},
					}),
				]}
			>
				<thead>
					<tr>
						{COLUMNS.map((column) => (
							<th scope="col">{column}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{LEDGER.map((entry) => (
						<tr>
							<th
								scope="row"
								mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}
							>
								{entry.what}
							</th>
							<td data-label={COLUMNS[1]}>{entry.where}</td>
							<td data-label={COLUMNS[2]}>{entry.howLong}</td>
							<td data-label={COLUMNS[3]}>
								<HandNote>Never</HandNote>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<ul
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						gap: "1.5rem 2rem",
						margin: "2.5rem 0 0",
						padding: "0",
						listStyle: "none",
						"@media (min-width: 48rem)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
					}),
				]}
			>
				{PROMISES.map((promise) => (
					<li
						mix={[
							raw({
								paddingBlockStart: "1rem",
								borderBlockStart: "2px solid var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						<h3
							mix={[
								raw({
									margin: "0 0 0.375rem",
									fontSize: "1.0625rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{promise.title}
						</h3>
						<p
							mix={[
								raw({
									margin: "0",
									fontSize: "0.9375rem",
									lineHeight: "1.55",
									color: "var(--ui-neutral-fg)",
									textWrap: "pretty",
								}),
							]}
						>
							{promise.body}
						</p>
					</li>
				))}
			</ul>
		</LandingSection>
	);
}
