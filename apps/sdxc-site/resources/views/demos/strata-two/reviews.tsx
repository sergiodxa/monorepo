/**
 * Press reviews of Strata Two, quoted with their criticism: each card carries the outlet's
 * score, its verdict, what it liked and what it did not, which unit it tested, and what has
 * changed since. The outlets are invented, as the board is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** One review as the card quotes it. */
interface Review {
	outlet: string;
	score: string;
	date: string;
	quote: string;
	liked: string;
	disliked: string;
	unit: string;
	since: string;
}

/** The reviews, in the order they were published. */
const REVIEWS: Review[] = [
	{
		outlet: "Keyline",
		score: "8 / 10",
		date: "18 Nov 2026",
		quote: "The most even-sounding board we have tested under $300, edge to edge.",
		liked: "Gasket mount with no dead corners; the knob's detents.",
		disliked: "A faint tick from the spacebar stabiliser on our unit.",
		unit: "Batch 01, Silk switches",
		since: "Fixed: batch 02 onward ships a thicker stabiliser wire.",
	},
	{
		outlet: "Desk & Lamp",
		score: "4 / 5",
		date: "2 Dec 2026",
		quote: "It is heavy in the way good tools are heavy, and nothing on it rattles.",
		liked: "The finish, and the receiver stored inside the case.",
		disliked: "1.68 kg is a lot to put in a bag every morning.",
		unit: "Batch 01, Notch switches, Bronze",
		since: "Unchanged: Strata One remains the lighter board.",
	},
	{
		outlet: "Input Weekly",
		score: "Recommended",
		date: "9 Dec 2026",
		quote: "4,000 Hz wired is real, and so is the 140 hours, with the backlight off.",
		liked: "Latency wired and on 2.4 GHz; open QMK firmware.",
		disliked: "The receiver is USB-A, so most new laptops need the adapter.",
		unit: "Batch 02 sample, Silk switches",
		since: "Unchanged: a USB-C receiver is planned, not promised.",
	},
];

namespace ReviewCard {
	export interface Props {
		review: Review;
	}
}

/**
 * One review: the outlet and score, the quote, then liked, disliked, tested on and since as
 * a short list, so the criticism sits at the same size as the praise.
 *
 * @param handle Runtime handle carrying the review.
 * @returns The render function producing the card.
 */
function ReviewCard(handle: Handle<ReviewCard.Props>) {
	return () => {
		let { review } = handle.props;
		let rows: Array<[string, string]> = [
			["Liked", review.liked],
			["Didn't", review.disliked],
			["Tested", review.unit],
			["Since", review.since],
		];
		return (
			<article
				mix={[
					raw({
						display: "grid",
						gridTemplateRows: "subgrid",
						gridRow: "span 3",
						gap: "1.25rem",
						padding: "1.5rem",
						borderRadius: "var(--ui-landing-card-radius-outer)",
						backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
						boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
					}),
				]}
			>
				<header
					mix={[
						raw({
							display: "flex",
							justifyContent: "space-between",
							alignItems: "baseline",
							gap: "1rem",
						}),
					]}
				>
					<h3
						mix={[
							raw({ margin: "0", fontSize: "1rem", fontWeight: "650", letterSpacing: "-0.01em" }),
						]}
					>
						{review.outlet}
					</h3>
					<span
						mix={[
							raw({
								fontSize: "0.8125rem",
								fontWeight: "600",
								fontVariantNumeric: "tabular-nums",
								whiteSpace: "nowrap",
							}),
						]}
					>
						{review.score}
					</span>
				</header>
				<blockquote mix={[raw({ margin: "0" })]}>
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "1.1875rem",
								lineHeight: "1.4",
								letterSpacing: "-0.01em",
								textWrap: "pretty",
							}),
						]}
					>
						“{review.quote}”
					</p>
					<footer
						mix={[
							raw({
								marginBlockStart: "0.5rem",
								fontSize: "0.8125rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						<cite mix={[raw({ fontStyle: "normal" })]}>{review.outlet}</cite>, {review.date}
					</footer>
				</blockquote>
				<dl mix={[raw({ margin: "0", display: "grid", gap: "0.5rem", alignContent: "start" })]}>
					{rows.map(([term, value]) => (
						<div
							key={term}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "4rem 1fr",
									gap: "0.75rem",
									paddingBlockStart: "0.5rem",
									borderBlockStart: "1px solid var(--ui-landing-hairline)",
									fontSize: "0.8125rem",
									lineHeight: "1.45",
								}),
							]}
						>
							<dt mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{term}</dt>
							<dd mix={[raw({ margin: "0", textWrap: "pretty" })]}>{value}</dd>
						</div>
					))}
				</dl>
			</article>
		);
	};
}

/**
 * Renders the band: the header with the terms the reviews were written under, then the
 * three cards on one subgrid so their quotes and lists line up.
 *
 * @returns The render function producing the band.
 */
export default function Reviews() {
	return () => (
		<LandingSection id="reviews" tone="tinted" spacing="normal" mix={[renderNearView(652, 1529)]}>
			<LandingHeader
				eyebrow="09 · Reviews"
				description="Review units were lent and returned. No outlet was paid, and none saw this page before it went up. We quote what they disliked too."
			>
				What the press found, faults included
			</LandingHeader>
			<div
				mix={[
					raw({ display: "grid", gap: "1rem", paddingBlockStart: "1rem" }),
					at(
						"lg",
						raw({ gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "auto auto 1fr" }),
					),
				]}
			>
				{REVIEWS.map((review) => (
					<ReviewCard key={review.outlet} review={review} />
				))}
			</div>
		</LandingSection>
	);
}
