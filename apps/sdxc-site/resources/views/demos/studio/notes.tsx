/**
 * Quoin's writing: essays, notes and talks as a dated, ruled list, each opening in place on
 * its first paragraph through a native disclosure, so a reader samples how the studio
 * thinks without leaving the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { LandingSection } from "@sdxc/ui/landing";

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

/** The writing, newest first, each with the opening a reader sees when it unfolds. */
const NOTES = [
	{
		date: "2026-10-02",
		shown: "2 Oct 2026",
		kind: "Essay",
		minutes: 12,
		title: "Measure the Monday, not the demo",
		opening:
			"A product is judged on the morning someone has to use it with a queue behind them. We pick the number we will move before we draw anything, and we pick it from that morning.",
	},
	{
		date: "2026-07-18",
		shown: "18 Jul 2026",
		kind: "Note",
		minutes: 4,
		title: "Why the ferry board shows the tram",
		opening:
			"Riders do not plan a ferry trip; they plan getting to work. Showing the connection on the pier board cost one column and removed the most common question at the ticket window.",
	},
	{
		date: "2026-04-09",
		shown: "9 Apr 2026",
		kind: "Talk",
		minutes: 28,
		title: "One typeface for the screen and the sign",
		opening:
			"Given at Typo Antwerp: how Mercer Sign was drawn to survive a 4 metre floor sign and a 13 pixel search result, and what we cut from it to get there.",
	},
	{
		date: "2026-01-21",
		shown: "21 Jan 2026",
		kind: "Essay",
		minutes: 9,
		title: "Two projects at a time, on purpose",
		opening:
			"We stopped at two concurrent projects in 2019. Here is what it did to our prices, our waiting list and the number of releases that shipped on the date we promised.",
	},
	{
		date: "2025-11-03",
		shown: "3 Nov 2025",
		kind: "Note",
		minutes: 3,
		title: "Eleven checkout fields we deleted",
		opening:
			"Every field on the old Oda checkout, the reason it was there, and the reason it could go. Three survived: email, address, postcode.",
	},
];

/**
 * Renders the claim in the first three columns and the list from the fourth, each entry a
 * `<details>` whose summary carries the date, kind, title and reading time.
 *
 * @returns The render function producing the notes band.
 */
export default function StudioNotes() {
	return () => (
		<LandingSection id="notes" mix={[renderNearView(467, 694)]}>
			<div mix={[pageGrid(), raw({ rowGap: "3rem" })]}>
				<p mix={[runningHead()]}>
					<span>05 — Notes</span>
					<span>Essays, notes and talks</span>
				</p>
				<h2 mix={[span("1 / 4"), chapter(), raw({ alignSelf: "start" })]}>What we write down</h2>
				<ul mix={[span("4 / -1"), raw({ margin: "0", padding: "0", listStyle: "none" })]}>
					{NOTES.map((note) => (
						<li key={note.date} mix={[raw({ borderBlockStart: RULE })]}>
							<details>
								<summary mix={[summary()]}>
									<time dateTime={note.date} mix={[caption(), raw({ gridArea: "date" })]}>
										{note.shown} · {note.kind}
									</time>
									<span
										mix={[
											raw({
												gridArea: "title",
												fontFamily: DIDONE,
												fontSize: "clamp(1.375rem, 2.4cqi, 2rem)",
												lineHeight: "1.15",
												color: "var(--ui-neutral-fg-emphasis)",
											}),
										]}
									>
										{note.title}
									</span>
									<span mix={[caption(), raw({ gridArea: "time" })]}>{note.minutes} min</span>
									<span aria-hidden="true" mix={[toggle()]} />
								</summary>
								<p mix={[opening()]}>{note.opening}</p>
							</details>
						</li>
					))}
				</ul>
			</div>
		</LandingSection>
	);
}

/**
 * The summary row: date and kind over the title on a phone with the time and toggle at the
 * end; from `lg` the date in a narrow first column beside the title.
 */
function summary() {
	return [
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr) auto auto",
			gridTemplateAreas: '"date time toggle" "title title title"',
			alignItems: "baseline",
			gap: "0.5rem 1.25rem",
			paddingBlock: "1.25rem",
			cursor: "pointer",
			listStyle: "none",
		}),
		when("&::-webkit-details-marker", raw({ display: "none" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
		at(
			"lg",
			BAND,
			raw({
				gridTemplateColumns: "11.5rem minmax(0, 1fr) auto auto",
				gridTemplateAreas: '"date title time toggle"',
			}),
		),
	];
}

/** The plus that turns to a minus while its entry is open, drawn from two hairlines. */
function toggle() {
	return [
		raw({
			gridArea: "toggle",
			position: "relative",
			inlineSize: "0.875rem",
			blockSize: "0.875rem",
			alignSelf: "center",
			backgroundImage:
				"linear-gradient(currentColor, currentColor), linear-gradient(currentColor, currentColor)",
			backgroundSize: "100% 1.5px, 1.5px 100%",
			backgroundPosition: "center",
			backgroundRepeat: "no-repeat",
			color: "var(--ui-neutral-fg-emphasis)",
		}),
		when(":is(details[open]) &", raw({ backgroundSize: "100% 1.5px, 0 100%" })),
	];
}

/** The unfolded opening, aligned with the title's column from `lg`. */
function opening() {
	return [
		raw({
			margin: "0",
			paddingBlockEnd: "1.5rem",
			maxInlineSize: "38rem",
			color: "var(--ui-neutral-fg)",
			lineHeight: "1.65",
			textWrap: "pretty",
		}),
		at("lg", BAND, raw({ marginInlineStart: "calc(11.5rem + 1.25rem)" })),
	];
}
