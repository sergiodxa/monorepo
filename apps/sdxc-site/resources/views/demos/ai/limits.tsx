/**
 * The limits band: six things Margin gets wrong, each with the slip as it would appear in
 * the notes and the red-pen correction beside it, and what Margin does to make the slip
 * easy to catch. An AI product earns trust by naming its failures before a buyer finds them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { HandNote, Struck } from "~/resources/views/demos/ai/marks";
import { MONO } from "~/resources/views/demos/ai/type";
import { renderNearView } from "~/resources/views/demos/near-view";

/** One failure: what goes wrong, what Margin does about it, and the slip on paper. */
interface Limit {
	title: string;
	body: string;
	/** The slip as the notes would print it, struck where it is wrong. */
	slip: RemixNode;
	/** The correction a reader would write beside it. */
	fix: string;
}

/** The six, in roughly the order a team meets them. */
const LIMITS: readonly Limit[] = [
	{
		title: "Jokes and sarcasm",
		body: "It takes people at their word. A line that only works with a raised eyebrow can become a to-do, so items that hinge on tone are marked “check”.",
		slip: <Struck>To do: Priya, book another meeting</Struck>,
		fix: "she was joking",
	},
	{
		title: "Two people at once",
		body: "When voices overlap it keeps the louder one and marks the gap with its times, rather than merging two sentences into one nobody said.",
		slip: <>[overlap 02:44–02:47]</>,
		fix: "Tomás agreed here",
	},
	{
		title: "Names it never heard spelled",
		body: "A name said aloud is spelled the common way until someone corrects it once. After that, the workspace remembers.",
		slip: <Struck>Thomas</Struck>,
		fix: "Tomás",
	},
	{
		title: "Decisions made by silence",
		body: "If nobody says “agreed”, it writes an open question instead of a decision. Teams that decide by nodding will see more questions than they expect.",
		slip: <>Open: refund window?</>,
		fix: "we did agree, 14 days",
	},
	{
		title: "A number said once, fast",
		body: "“Fourteen” and “forty” sound alike on a bad line. Every figure carries its timestamp, so the check is one click.",
		slip: <Struck>Refund window: 40 days</Struck>,
		fix: "14 days",
	},
	{
		title: "What was on screen",
		body: "It only hears the call. A slide, a whiteboard or a shared spreadsheet is not in the notes unless someone says it out loud.",
		slip: <>(slide 3 not captured)</>,
		fix: "add the pricing table",
	},
];

/**
 * Renders the six in three columns from a wide container, two on a tablet and one on a
 * phone, so every row is full at every width.
 *
 * @returns The render function producing the band.
 */
export default function MarginLimits() {
	return () => (
		<LandingSection id="limits" mix={[renderNearView(762, 1674)]}>
			<LandingHeader
				eyebrow="Limits"
				description={
					<>
						Margin is a good note-taker, not a perfect one. These are the mistakes it still makes,
						shown the way they appear in your notes, and{" "}
						<strong>what it does so you catch them</strong>.
					</>
				}
			>
				What it still gets wrong
			</LandingHeader>
			<ul
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						gap: "1rem",
						margin: "0",
						padding: "0",
						listStyle: "none",
						"@media (min-width: 40rem)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
						"@media (min-width: 64rem)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
					}),
				]}
			>
				{LIMITS.map((limit) => (
					<LimitCard limit={limit} />
				))}
			</ul>
		</LandingSection>
	);
}

namespace LimitCard {
	/** The failure the card shows. */
	export interface Props {
		limit: Limit;
	}
}

/**
 * One failure as a card: the slip on a ruled strip at the top with its correction in red
 * pen, then the title and what Margin does about it.
 *
 * @param handle Runtime handle carrying the failure.
 * @returns The render function producing the card.
 */
function LimitCard(handle: Handle<LimitCard.Props>) {
	return () => {
		let { limit } = handle.props;
		return (
			<li
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.75rem",
						padding: "1.25rem",
						backgroundColor: "var(--ui-surface-raised)",
						borderRadius: "var(--ui-landing-radius-surface)",
						boxShadow: "var(--ui-shadow-surface)",
					}),
				]}
			>
				<p
					mix={[
						raw({
							margin: "0",
							paddingBlock: "0.5rem",
							borderBlock: "1px dashed var(--ui-landing-hairline)",
							fontFamily: MONO,
							fontSize: "0.8125rem",
							lineHeight: "1.5",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{limit.slip}{" "}
					<span mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}>
						<HandNote pen="red">← {limit.fix}</HandNote>
					</span>
				</p>
				<h3
					mix={[
						raw({
							margin: "0",
							fontSize: "1.0625rem",
							fontWeight: "600",
							lineHeight: "1.3",
							color: "var(--ui-neutral-fg-emphasis)",
							textWrap: "balance",
						}),
					]}
				>
					{limit.title}
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
					{limit.body}
				</p>
			</li>
		);
	};
}
