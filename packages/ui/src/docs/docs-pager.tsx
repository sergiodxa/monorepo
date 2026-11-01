/**
 * The previous and next links closing a docs page, each a whole-card link naming its
 * destination, with the section shown when the step crosses into another one. Pair it
 * with `findNeighbours` from `@sdxc/ui/utils`, which reads the same sidebar tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { ArrowLeftIcon, ArrowRightIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { mergeMix } from "@sdxc/u/general";
import { raw } from "@sdxc/u/general";
import { container, gap, grid, hstack, vstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { is, minIs, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { translateProperty } from "@sdxc/u/transform";
import { overflowWrap, text, textAlign, weight } from "@sdxc/u/typography";

/** Container the pager measures; at 36rem of its own width a pair of cards sits side by side. */
const PAGER_CONTAINER = "ui-docs-pager";

/** Selector for a card's arrow, which hover and focus nudge toward the destination. */
const ARROW = '& [data-slot="docs-pager-arrow"]';

/**
 * Prop types for {@link DocsPager}.
 */
export namespace DocsPager {
	/** One neighbouring page; a `DocsTree.Page` from `findNeighbours` fits as is. */
	export interface Entry {
		title: string;
		href: string;
		/** Title of the section the page sits in, shown when it differs from `section`. */
		section?: string;
	}

	/** Every string the pager shows or announces. */
	export interface Labels {
		/** Name of the navigation landmark, such as "Pagination". */
		nav: string;
		previous: string;
		next: string;
	}

	/** Props accepted by {@link DocsPager}. */
	export interface Props extends Omit<TagProps<"nav">, "children"> {
		previous?: Entry | null;
		next?: Entry | null;
		/** Section of the page being read; a destination in another section names its own. */
		section?: string;
		labels: Labels;
	}
}

/**
 * Renders the pair of neighbours, or nothing when the page has neither. A card with no
 * partner fills the row on its own, and the pair stacks when the pager is under 36rem wide.
 *
 * @param handle Runtime handle carrying the pager's props.
 * @returns The render function producing the pager's markup.
 * @example
 * <DocsPager {...findNeighbours(tree, path)} section="Guides" labels={{ nav: "Pagination", previous: "Previous", next: "Next" }} />
 */
export function DocsPager(handle: Handle<DocsPager.Props>) {
	return () => {
		let { previous, next, section, labels, mix, ...rest } = handle.props;
		if (!previous && !next) return null;
		let paired = Boolean(previous && next);

		return (
			<nav
				{...rest}
				aria-label={labels.nav}
				data-slot="docs-pager"
				mix={mergeMix([is("100%"), container(PAGER_CONTAINER)], mix)}
			>
				<div
					mix={[
						grid(),
						gap(3),
						/**
						 * Both column counts live in one rule, so the wide layout always wins at its
						 * width whatever order the stylesheet layers land in.
						 */
						raw({
							gridTemplateColumns: "minmax(0, 1fr)",
							[`@container ${PAGER_CONTAINER} (min-width: 36rem)`]: {
								gridTemplateColumns: paired ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
							},
						}),
					]}
				>
					{previous ? (
						<DocsPagerCard
							entry={previous}
							label={labels.previous}
							direction="previous"
							section={section}
						/>
					) : null}
					{next ? (
						<DocsPagerCard entry={next} label={labels.next} direction="next" section={section} />
					) : null}
				</div>
			</nav>
		);
	};
}

namespace DocsPagerCard {
	export interface Props {
		entry: DocsPager.Entry;
		label: string;
		direction: "previous" | "next";
		section?: string;
	}
}

/**
 * One neighbour as a single `<a>`, so every pixel of the card follows the link. The
 * previous card reads from the start edge and the next from the end edge, so each points
 * the way it goes.
 */
function DocsPagerCard(handle: Handle<DocsPagerCard.Props>) {
	return () => {
		let { direction, entry, label, section } = handle.props;
		let isNext = direction === "next";
		let Arrow = isNext ? ArrowRightIcon : ArrowLeftIcon;
		let showSection = entry.section !== undefined && entry.section !== section;
		let arrow = (
			<Arrow
				size={14}
				aria-hidden="true"
				data-slot="docs-pager-arrow"
				mix={[transition("translate")]}
			/>
		);

		return (
			<a
				href={entry.href}
				rel={isNext ? "next" : "prev"}
				data-slot="docs-pager-card"
				data-direction={direction}
				mix={[
					vstack({ gap: 1, align: isNext ? "end" : "start" }),
					minIs(0),
					p(4, 5),
					rounded("lg"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					textAlign(isNext ? "end" : "start"),
					overflowWrap("anywhere"),
					transition("border-color, background-color"),
					hover([border("brand.border"), bg("neutral.bg-tint")]),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					motionSafe(
						when(
							"&:hover, &:focus-visible",
							when(ARROW, translateProperty(isNext ? "2px 0" : "-2px 0")),
						),
					),
				]}
			>
				<span mix={[hstack({ gap: 1.5, align: "center" }), text("xs"), fg("neutral.muted")]}>
					{isNext ? null : arrow}
					{label}
					{showSection ? <span aria-hidden="true">·</span> : null}
					{showSection ? <span data-slot="docs-pager-section">{entry.section}</span> : null}
					{isNext ? arrow : null}
				</span>
				<span data-slot="docs-pager-title" mix={[text("base"), weight("medium"), fg("brand")]}>
					{entry.title}
				</span>
			</a>
		);
	};
}
