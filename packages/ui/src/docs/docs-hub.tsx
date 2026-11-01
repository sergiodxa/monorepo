/**
 * The docs home: a title, an optional search and topic chips, a larger "Start here" path,
 * the sections as cards with page counts, and popular articles. It routes a newcomer and a
 * returning reader by task, and its grids fill whatever width the docs shell gives them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, mergeMix, raw } from "@sdxc/u/general";
import { flexWrap, grid, hstack, vstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import {
	balance,
	font,
	leading,
	pretty,
	text,
	textTransform,
	tracking,
	weight,
} from "@sdxc/u/typography";

import type { HeadingLevel } from "../components/heading-scope.js";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";

/**
 * Prop types for {@link DocsHub}.
 */
export namespace DocsHub {
	/** A "Start here" destination, drawn larger than a section so it reads first. */
	export interface StartItem {
		title: string;
		href: string;
		description: string;
		/** Small line above the title naming the page's section or kind ("Quickstart"). */
		eyebrow?: string;
		/** Call closing the card ("Read the guide"), drawn with an arrow on its bottom edge. */
		cta?: string;
	}

	/** A topic chip: a short task or area the reader can jump to before choosing a section. */
	export interface Topic {
		title: string;
		href: string;
	}

	/** A section of the docs, entered at its first page. */
	export interface Section {
		title: string;
		href: string;
		description: string;
		/** How many pages the section holds, worded by `countLabel` or {@link Props.formatCount}. */
		count?: number;
		/** The count's wording for this section ("12 guides"); wins over {@link Props.formatCount}. */
		countLabel?: string;
	}

	/** A popular article, optionally with a cropped picture of the UI it covers. */
	export interface Popular {
		title: string;
		href: string;
		image?: RemixNode;
	}

	/** The words of every block heading, so each app supplies them in the reader's language. */
	export interface Labels {
		/** Heading over the start cards ("Start here"). */
		start: string;
		/** Heading over the section cards ("Browse by topic"). */
		sections: string;
		/** Accessible name of the topic chips' navigation ("Popular topics"). */
		topics?: string;
		/** Heading over the popular articles ("Popular articles"). */
		popular?: string;
	}

	/** Props accepted by {@link DocsHub}. */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** The page title, rendered at the ambient heading level (`<h1>` with no scope around it). */
		title: RemixNode;
		/** Small line above the title ("Documentation"). */
		eyebrow?: string;
		/** One or two sentences under the title saying what the docs cover. */
		lead?: RemixNode;
		/** The app's search field ("How can we help?"), drawn under the lead. */
		search?: RemixNode;
		/** The path a newcomer takes, most important first. */
		start: StartItem[];
		/** Chips under the search for the most asked-about tasks. */
		topics?: Topic[];
		sections: Section[];
		popular?: Popular[];
		labels: Labels;
		/** Words a section's `count` ("12 pages"); a section's own `countLabel` wins over it. */
		formatCount?: (count: number) => string;
	}
}

/** Easing for hover and focus changes on the cards: quick to start, settling at the end. */
const EASE_OUT = "cubic-bezier(0, 0, 0.2, 1)";

/**
 * A heading level `steps` below `level`, held at `<h6>` so a deeply scoped hub keeps a
 * valid outline.
 */
function deeper(level: HeadingLevel, steps: number): HeadingLevel {
	return Math.min(level + steps, 6) as HeadingLevel;
}

/**
 * A grid whose columns are at least `min` wide and share the rest of the row. `fit`
 * stretches a short row across the width, so two start cards never leave a dead column;
 * `fill` keeps empty tracks, so one popular picture stays card-sized.
 */
function fillGrid(min: string, repeat: "fit" | "fill" = "fit") {
	return [
		grid(),
		raw({
			gap: "0.75rem",
			gridTemplateColumns: `repeat(auto-${repeat}, minmax(min(100%, ${min}), 1fr))`,
		}),
	];
}

/**
 * Whole-card link chrome: a hairline border that turns brand on hover, a focus ring
 * outside it, and the colour change animated only when motion is welcome.
 */
function cardLink() {
	return [
		vstack({ gap: 2, align: "stretch" }),
		rounded("lg"),
		border({ color: "neutral.border", width: 1, style: "solid" }),
		raw({ textDecoration: "none", minInlineSize: "0" }),
		hover(border("brand.border")),
		when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
		motionSafe(raw({ transition: `border-color 150ms ${EASE_OUT}` })),
	];
}

/**
 * Routes a reader into the docs by task. Every card is one link, start cards are larger
 * than section cards, and block headings sit one level under the title, so the outline
 * reads h1 → h2 → h3 with no scope around it and follows any `HeadingScope` that wraps it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the hub's markup.
 * @example
 * <DocsHub
 * 	title="Documentation"
 * 	labels={{ start: "Start here", sections: "Browse by topic" }}
 * 	start={[{ title: "Quickstart", href: "/docs/quickstart", description: "Add your first monitor." }]}
 * 	sections={[{ title: "Alerts", href: "/docs/alerts", description: "Who gets paged.", count: 6 }]}
 * 	formatCount={(count) => `${count} pages`}
 * />
 */
export function DocsHub(handle: Handle<DocsHub.Props>) {
	return () => {
		let {
			eyebrow,
			formatCount,
			labels,
			lead,
			mix,
			popular,
			search,
			sections,
			start,
			title,
			topics,
			...rest
		} = handle.props;
		let level = resolveHeadingLevel(handle);
		let TitleTag = TAG_BY_LEVEL[level];
		let BlockTag = TAG_BY_LEVEL[deeper(level, 1)];
		let CardTag = TAG_BY_LEVEL[deeper(level, 2)];

		let blockHeading = [m(0), text("lg"), weight("semibold"), balance(), fg("neutral.emphasis")];

		return (
			<div
				{...rest}
				data-slot="docs-hub"
				mix={mergeMix([vstack({ gap: 12, align: "stretch" }), raw({ minInlineSize: "0" })], mix)}
			>
				<header data-slot="docs-hub-header" mix={[vstack({ gap: 4, align: "stretch" })]}>
					<div mix={[vstack({ gap: 3, align: "stretch" })]}>
						{eyebrow ? (
							<p
								data-slot="docs-hub-eyebrow"
								mix={[
									m(0),
									font("mono"),
									text("xs"),
									weight("medium"),
									textTransform("uppercase"),
									tracking("widest"),
									fg("brand"),
								]}
							>
								{eyebrow}
							</p>
						) : null}
						<TitleTag
							data-slot="docs-hub-title"
							mix={[
								m(0),
								text("4xl"),
								balance(),
								fg("neutral.emphasis"),
								raw({ fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.1 }),
							]}
						>
							{title}
						</TitleTag>
						{lead ? (
							<p
								data-slot="docs-hub-lead"
								mix={[m(0), text("lg"), pretty(), fg("neutral"), raw({ maxInlineSize: "65ch" })]}
							>
								{lead}
							</p>
						) : null}
					</div>
					{search ? (
						<div data-slot="docs-hub-search" mix={[raw({ maxInlineSize: "36rem" })]}>
							{search}
						</div>
					) : null}
					{topics && topics.length > 0 ? (
						<nav data-slot="docs-hub-topics" aria-label={labels.topics}>
							<ul
								data-not-typeset=""
								mix={[hstack({ gap: 2 }), flexWrap("wrap"), m(0), p(0), listStyle("none")]}
							>
								{topics.map((topic) => (
									<li key={topic.href}>
										<a
											href={topic.href}
											data-rmx-prefetch="intent"
											data-slot="docs-hub-topic"
											mix={[
												hstack({ align: "center" }),
												raw({
													minBlockSize: "2.25rem",
													paddingInline: "0.875rem",
													textDecoration: "none",
												}),
												rounded("full"),
												border({ color: "neutral.border", width: 1, style: "solid" }),
												bg("neutral.bg-tint"),
												text("sm"),
												fg("neutral.emphasis"),
												hover(border("brand.border")),
												when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
												motionSafe(raw({ transition: `border-color 150ms ${EASE_OUT}` })),
											]}
										>
											{topic.title}
										</a>
									</li>
								))}
							</ul>
						</nav>
					) : null}
				</header>

				{start.length > 0 ? (
					<section data-slot="docs-hub-start" mix={[vstack({ gap: 4, align: "stretch" })]}>
						<BlockTag mix={blockHeading}>{labels.start}</BlockTag>
						<ul data-not-typeset="" mix={[fillGrid("20rem"), m(0), p(0), listStyle("none")]}>
							{start.map((item) => (
								<li key={item.href} mix={[grid()]}>
									<a
										href={item.href}
										data-rmx-prefetch="intent"
										data-slot="docs-hub-start-card"
										mix={[cardLink(), p(6), bg("neutral.bg-tint"), raw({ minBlockSize: "11rem" })]}
									>
										{item.eyebrow ? (
											<span mix={[text("xs"), font("mono"), fg("neutral.muted")]}>
												{item.eyebrow}
											</span>
										) : null}
										<CardTag
											data-slot="docs-hub-start-title"
											mix={[
												m(0),
												text("xl"),
												weight("semibold"),
												balance(),
												fg("neutral.emphasis"),
											]}
										>
											{item.title}
										</CardTag>
										<span mix={[text("base"), leading("relaxed"), pretty(), fg("neutral")]}>
											{item.description}
										</span>
										{item.cta ? (
											<span
												data-slot="docs-hub-start-cta"
												mix={[
													hstack({ gap: 1, align: "center" }),
													raw({ marginBlockStart: "auto", paddingBlockStart: "0.5rem" }),
													text("sm"),
													weight("medium"),
													fg("brand"),
												]}
											>
												{item.cta}
												<ArrowRightIcon size={14} aria-hidden="true" />
											</span>
										) : null}
									</a>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{sections.length > 0 ? (
					<section data-slot="docs-hub-sections" mix={[vstack({ gap: 4, align: "stretch" })]}>
						<BlockTag mix={blockHeading}>{labels.sections}</BlockTag>
						<ul data-not-typeset="" mix={[fillGrid("15rem"), m(0), p(0), listStyle("none")]}>
							{sections.map((section) => {
								let countText =
									section.countLabel ??
									(section.count === undefined
										? undefined
										: (formatCount?.(section.count) ?? String(section.count)));
								return (
									<li key={section.href} mix={[grid()]}>
										<a
											href={section.href}
											data-rmx-prefetch="intent"
											data-slot="docs-hub-section-card"
											mix={[cardLink(), p(4)]}
										>
											<CardTag
												data-slot="docs-hub-section-title"
												mix={[
													m(0),
													text("base"),
													weight("semibold"),
													balance(),
													fg("neutral.emphasis"),
												]}
											>
												{section.title}
											</CardTag>
											<span mix={[text("sm"), pretty(), fg("neutral")]}>{section.description}</span>
											{countText ? (
												<span
													data-slot="docs-hub-count"
													mix={[
														raw({ marginBlockStart: "auto", paddingBlockStart: "0.25rem" }),
														text("xs"),
														font("mono"),
														fg("neutral.muted"),
													]}
												>
													{countText}
												</span>
											) : null}
										</a>
									</li>
								);
							})}
						</ul>
					</section>
				) : null}

				{popular && popular.length > 0 ? (
					<section data-slot="docs-hub-popular" mix={[vstack({ gap: 4, align: "stretch" })]}>
						{labels.popular ? <BlockTag mix={blockHeading}>{labels.popular}</BlockTag> : null}
						<ul
							data-not-typeset=""
							mix={[fillGrid("15rem", "fill"), m(0), p(0), listStyle("none")]}
						>
							{popular.map((item) => (
								<li key={item.href} mix={[grid()]}>
									<a
										href={item.href}
										data-rmx-prefetch="intent"
										data-slot="docs-hub-popular-card"
										mix={[cardLink(), raw({ overflow: "hidden" })]}
									>
										{item.image ? (
											<span
												data-slot="docs-hub-popular-image"
												mix={[
													raw({
														display: "block",
														aspectRatio: "16 / 9",
														overflow: "hidden",
														borderBlockEnd: "1px solid var(--ui-neutral-border)",
													}),
													bg("neutral.bg-tint"),
												]}
											>
												{item.image}
											</span>
										) : null}
										<span
											mix={[p(4), text("sm"), weight("medium"), pretty(), fg("neutral.emphasis")]}
										>
											{item.title}
										</span>
									</a>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</div>
		);
	};
}
