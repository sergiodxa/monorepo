/**
 * The hand-written "Next steps" block that ends a guide: two to four links, each with
 * one line on what it gets the reader, drawn as cards or as a list. Its title is a real
 * heading at the surrounding scope's level, with an optional id an outline can link to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { bg, border, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { listStyle, mergeMix } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { m, minIs, p, pb } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { translateProperty } from "@sdxc/u/transform";
import { leading, overflowWrap, pretty, text, textDecoration, weight } from "@sdxc/u/typography";

import type { HeadingLevel } from "../components/heading-scope.js";

import { readAmbientLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";

/** Look {@link NextSteps} draws when `variant` is omitted. */
const DEFAULT_VARIANT: NextSteps.Variant = "cards";

/** Heading level with no `level` prop and no `HeadingScope` around the block: a section of the page. */
const DEFAULT_LEVEL: HeadingLevel = 2;

/** Selector for a link's arrow, which hover and focus nudge forward. */
const ARROW = '& [data-slot="next-steps-arrow"]';

/**
 * Prop types for {@link NextSteps}.
 */
export namespace NextSteps {
	/** `cards` tiles the links in an auto-fitting grid; `list` runs them down a ruled list. */
	export type Variant = "cards" | "list";

	/** One destination and the one line saying what it gets the reader. */
	export interface Item {
		title: string;
		href: string;
		description: string;
	}

	/** Props accepted by {@link NextSteps}. */
	export interface Props extends Omit<TagProps<"section">, "children" | "title" | "id"> {
		title: string;
		/** Id of the heading, so a table of contents can link to the block. */
		id?: string;
		/** Heading level; defaults to the ambient `HeadingScope` level, else {@link DEFAULT_LEVEL}. */
		level?: HeadingLevel;
		/** Two to four destinations, in the order a reader should consider them. */
		items: Item[];
		/** Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
	}
}

/**
 * Renders the titled block, named by its heading. The heading takes `level`, else the
 * ambient `HeadingScope` level, else `<h2>`; each item is one whole-card or whole-row link.
 *
 * @param handle Runtime handle carrying the block's props.
 * @returns The render function producing the block's markup.
 * @example
 * <NextSteps title="Next steps" id="next-steps" items={[{ title: "Add alerts", href: "/docs/alerts", description: "Page the right person." }]} />
 */
export function NextSteps(handle: Handle<NextSteps.Props>) {
	return () => {
		let { title, id, level, items, variant, mix, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let Tag = TAG_BY_LEVEL[level ?? readAmbientLevel(handle) ?? DEFAULT_LEVEL];
		let isCards = resolvedVariant === "cards";

		return (
			<section
				{...rest}
				aria-labelledby={id}
				aria-label={id ? undefined : title}
				data-slot="next-steps"
				data-variant={resolvedVariant}
				mix={mergeMix([vstack({ gap: 4, align: "stretch" }), minIs(0)], mix)}
			>
				<Tag
					id={id}
					data-slot="next-steps-title"
					mix={[m(0), text("lg"), weight("semibold"), fg("neutral.emphasis"), leading("snug")]}
				>
					{title}
				</Tag>
				<ul
					data-slot="next-steps-list"
					data-not-typeset=""
					mix={[
						m(0),
						p(0),
						listStyle(),
						isCards
							? [
									grid(),
									gap(3),
									gridTemplate({ columns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))" }),
								]
							: [
									vstack({ gap: 0, align: "stretch" }),
									borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
								],
					]}
				>
					{items.map((item) => (
						<li
							key={item.href}
							mix={[
								minIs(0),
								isCards
									? []
									: borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
							]}
						>
							<NextStepsLink item={item} cards={isCards} />
						</li>
					))}
				</ul>
			</section>
		);
	};
}

namespace NextStepsLink {
	export interface Props {
		item: NextSteps.Item;
		cards: boolean;
	}
}

/**
 * One destination as a single `<a>` holding its title and line, so the whole card or row
 * follows the link and its accessible name reads title then description.
 */
function NextStepsLink(handle: Handle<NextStepsLink.Props>) {
	return () => {
		let { item, cards } = handle.props;

		return (
			<a
				href={item.href}
				data-slot="next-steps-link"
				mix={[
					vstack({ gap: 1, align: "stretch" }),
					overflowWrap("anywhere"),
					textDecoration("none"),
					cards
						? [
								p(4),
								rounded("lg"),
								border({ color: "neutral.border", width: 1, style: "solid" }),
								transition("border-color, background-color"),
								hover([border("brand.border"), bg("neutral.bg-tint")]),
							]
						: [pb(3), transition("color")],
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					motionSafe(when("&:hover, &:focus-visible", when(ARROW, translateProperty("2px 0")))),
				]}
			>
				<span
					mix={[hstack({ gap: 1.5, align: "center" }), text("base"), weight("medium"), fg("brand")]}
				>
					{item.title}
					<ArrowRightIcon
						size={14}
						aria-hidden="true"
						data-slot="next-steps-arrow"
						mix={[transition("translate")]}
					/>
				</span>
				<span mix={[text("sm"), fg("neutral.muted"), pretty()]}>{item.description}</span>
			</a>
		);
	};
}
