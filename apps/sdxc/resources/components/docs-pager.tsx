/**
 * The two links closing every documentation page: the page before it and the page
 * after it, in the order the tree lists them. An end of the tree leaves its slot
 * empty rather than drawing a card with nowhere to go.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { gap, grid, gridColumn, gridTemplate, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, p } from "@sdxc/u/size";
import { text, textAlign, textTransform, tracking, weight } from "@sdxc/u/typography";
import { Card, Separator } from "@sdxc/ui";

import type { NavEntry } from "~/app/services/navigation-tree";

namespace DocsPager {
	export interface Props {
		previous: NavEntry | null;
		next: NavEntry | null;
	}
}

/** Renders the pair of neighbouring pages. */
export default function DocsPager(handle: Handle<DocsPager.Props>) {
	return () => {
		let { next, previous } = handle.props;
		if (!previous && !next) return null;

		return (
			<nav aria-label="Pagination" mix={[is("100%"), m("3rem", 0, 0, 0)]}>
				<Separator />

				<div
					mix={[
						grid(),
						gap(4),
						is("100%"),
						m("1.5rem", 0, 0, 0),
						gridTemplate({ columns: "1fr" }),
						media("(min-width: 40rem)", gridTemplate({ columns: "1fr 1fr" })),
					]}
				>
					{previous ? <PagerCard entry={previous} label="Previous" align="start" /> : null}

					{next ? (
						<PagerCard
							entry={next}
							label="Next"
							align="end"
							/* With no previous to hold the first column, the next page keeps the second. */
							mix={previous ? [] : media("(min-width: 40rem)", gridColumn("2"))}
						/>
					) : null}
				</div>
			</nav>
		);
	};
}

namespace PagerCard {
	export interface Props {
		entry: NavEntry;
		label: string;
		/** Which edge the card reads from, which is the edge it points at. */
		align: "start" | "end";
		mix?: Card.Props["mix"];
	}
}

/** Renders one neighbour: what it is, and where it goes. */
function PagerCard(handle: Handle<PagerCard.Props>) {
	return () => {
		let { align, entry, label, mix } = handle.props;

		return (
			<Card
				mix={[
					vstack({ gap: 2, align }),
					p(5),
					rounded("md"),
					bg("transparent"),
					shadow("none"),
					textAlign(align === "end" ? "end" : "start"),
					mix,
				]}
			>
				<span
					mix={[
						text("xs"),
						weight("medium"),
						tracking("widest"),
						fg("neutral.muted"),
						textTransform("uppercase"),
					]}
				>
					{label}
				</span>

				<a href={entry.href} mix={[text("base"), weight("medium"), fg("brand")]}>
					{entry.title}
				</a>
			</Card>
		);
	};
}
