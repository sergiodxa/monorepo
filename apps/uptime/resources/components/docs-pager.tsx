/**
 * The two links closing every documentation page: the page before it and the page after
 * it, in the order the sidebar lists them. An end of the list leaves its slot empty, so a
 * reader is never offered a card with nowhere to go.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowLeftIcon, ArrowRightIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { gap, grid, gridColumn, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, textAlign, weight } from "@sdxc/u/typography";

/** One neighbouring page. */
export interface DocsPagerEntry {
	path: string;
	title: string;
}

namespace DocsPager {
	export interface Props {
		previous: DocsPagerEntry | null;
		next: DocsPagerEntry | null;
		labels: { nav: string; previous: string; next: string };
	}
}

/** Renders the pair of neighbouring pages, or nothing when the page stands alone. */
export default function DocsPager(handle: Handle<DocsPager.Props>) {
	return () => {
		let { next, previous, labels } = handle.props;
		if (!previous && !next) return null;

		return (
			<nav
				aria-label={labels.nav}
				mix={[
					grid(),
					gap(3),
					is("100%"),
					m("3.5rem", 0, 0, 0),
					gridTemplate({ columns: "minmax(0, 1fr)" }),
					media("(min-width: 40rem)", gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" })),
				]}
			>
				{previous ? <PagerCard entry={previous} label={labels.previous} align="start" /> : null}
				{next ? (
					<PagerCard entry={next} label={labels.next} align="end" alone={previous === null} />
				) : null}
			</nav>
		);
	};
}

namespace PagerCard {
	export interface Props {
		entry: DocsPagerEntry;
		label: string;
		/** Which edge the card reads from, which is the edge it points at. */
		align: "start" | "end";
		/** A next card with no previous beside it keeps to the second column. */
		alone?: boolean;
	}
}

/** Renders one neighbour as a whole-card link: which way it goes, and where. */
function PagerCard(handle: Handle<PagerCard.Props>) {
	return () => {
		let { align, alone, entry, label } = handle.props;
		let Arrow = align === "end" ? ArrowRightIcon : ArrowLeftIcon;

		return (
			<a
				href={entry.path}
				rel={align === "end" ? "next" : "prev"}
				data-rmx-prefetch="intent"
				mix={[
					vstack({ gap: 1, align: align === "end" ? "end" : "start" }),
					p(4, 5),
					rounded("lg"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					textAlign(align),
					transition("border-color, background-color"),
					hover([border("brand.border"), bg("neutral.bg-tint")]),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					alone ? media("(min-width: 40rem)", gridColumn("2")) : [],
				]}
			>
				<span mix={[hstack({ gap: 1.5, align: "center" }), text("xs"), fg("neutral.muted")]}>
					{align === "start" ? <Arrow size={14} aria-hidden="true" /> : null}
					{label}
					{align === "end" ? <Arrow size={14} aria-hidden="true" /> : null}
				</span>
				<span mix={[text("base"), weight("medium"), fg("brand")]}>{entry.title}</span>
			</a>
		);
	};
}
