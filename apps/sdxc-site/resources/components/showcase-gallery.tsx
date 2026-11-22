/**
 * The showcase's gallery parts: the filter chips that narrow it through `?kind=`, and the
 * tile every item gets, a screenshot over its name, chips and summary. Each tile carries a
 * chip saying whether it runs in production or is a demo, so no demo reads as a product.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { border, fg, outline } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";
import { Badge, LinkButton } from "@sdxc/ui";

import type { ShowcaseFilter, ShowcaseItem } from "~/app/services/case-studies";

import { CATEGORY_LABELS, showcaseHref } from "~/app/services/case-studies";

/** How each filter chip reads. */
const FILTER_LABELS: Record<ShowcaseFilter, string> = {
	all: "All",
	production: "In production",
	demo: "Demos",
	app: "Apps",
	landing: "Landings",
	docs: "Docs sites",
};

namespace ShowcaseFilters {
	export interface Props {
		current: ShowcaseFilter;
		/** How many items each filter shows, so a chip says what it leads to. */
		counts: Record<ShowcaseFilter, number>;
	}
}

/**
 * The filter chips, each a plain link to the showcase narrowed to it, the current one marked
 * with `aria-current`, so filtering works without script and every view has an address.
 */
export function ShowcaseFilters(handle: Handle<ShowcaseFilters.Props>) {
	return () => {
		let { counts, current } = handle.props;
		return (
			<nav aria-label="Filter the showcase">
				<ul
					mix={[
						hstack({ gap: 2, align: "center" }),
						m(0),
						p(0),
						raw({ listStyle: "none", flexWrap: "wrap" }),
					]}
				>
					{(Object.keys(FILTER_LABELS) as ShowcaseFilter[]).map((filter) => (
						<li key={filter}>
							<LinkButton
								href={`${showcaseHref(filter)}#items`}
								size="sm"
								color="neutral"
								variant={filter === current ? "solid" : "outline"}
								aria-current={filter === current ? "page" : undefined}
							>
								{FILTER_LABELS[filter]}
								<span mix={[fg("neutral"), raw({ fontVariantNumeric: "tabular-nums" })]}>
									{counts[filter]}
								</span>
							</LinkButton>
						</li>
					))}
				</ul>
			</nav>
		);
	};
}

namespace ShowcaseKindChips {
	export interface Props {
		item: ShowcaseItem;
	}
}

/**
 * The chips that say what an item is: in production, source only for an application with no
 * deployment, or a demo and which kind of one.
 */
export function ShowcaseKindChips(handle: Handle<ShowcaseKindChips.Props>) {
	return () => {
		let { item } = handle.props;
		return (
			<span mix={[hstack({ gap: 1.5, align: "center" }), raw({ flexWrap: "wrap" })]}>
				{item.kind === "production" && item.liveHref === null ? (
					<Badge color="neutral">Source only</Badge>
				) : null}
				{item.kind === "production" && item.liveHref !== null ? (
					<Badge color="success">In production</Badge>
				) : null}
				{item.kind === "production" ? null : (
					<>
						<Badge color="warning">Demo</Badge>
						<Badge color="neutral" variant="outline">
							{CATEGORY_LABELS[item.category].replace(" demo", "")}
						</Badge>
					</>
				)}
			</span>
		);
	};
}

namespace ShowcaseTile {
	export interface Props {
		item: ShowcaseItem;
		/** `large` for the production row, whose tiles run two across. Default: `small`. */
		size?: "large" | "small";
		/** How many `@sdxc/*` packages an application installs, read from its manifest. */
		packageCount?: number;
	}
}

/**
 * One item's tile, which as a whole opens its case study: the first screenshot on top, then
 * the name as the link, stretched over the tile, so a screen reader announces the name alone.
 */
export function ShowcaseTile(handle: Handle<ShowcaseTile.Props>) {
	return () => {
		let { item, packageCount, size = "small" } = handle.props;
		let shot = item.cover;
		return (
			<article
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					raw({ position: "relative", minInlineSize: 0 }),
					when(
						"&:has([data-slot='tile-link']:focus-visible)",
						outline({ color: "brand.ring", width: 2, offset: 4 }),
					),
				]}
			>
				<div
					mix={[
						border({ color: "neutral" }),
						raw({
							aspectRatio: "16 / 10",
							overflow: "hidden",
							borderRadius: "var(--ui-radius-lg, 0.75rem)",
							backgroundColor: "var(--ui-neutral-bg-tint, Canvas)",
						}),
					]}
				>
					{shot === null ? null : (
						<img
							src={shot.src}
							alt=""
							loading="lazy"
							decoding="async"
							width={1440}
							height={900}
							mix={[
								raw({
									display: "block",
									inlineSize: "100%",
									blockSize: "100%",
									objectFit: "cover",
									objectPosition: "top",
									transition: "transform 300ms",
								}),
								when(":is(article:hover) &", raw({ transform: "scale(1.02)" })),
							]}
						/>
					)}
				</div>
				<div mix={[vstack({ gap: 1.5, align: "start" })]}>
					<div mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
						<h3 mix={[m(0), text(size === "large" ? "xl" : "lg"), weight("semibold")]}>
							<a
								href={item.href}
								data-slot="tile-link"
								mix={[
									raw({ color: "inherit", textDecoration: "none", outline: "none" }),
									when("&::after", raw({ content: '""', position: "absolute", inset: "0" })),
								]}
							>
								{item.title}
							</a>
						</h3>
						<ShowcaseKindChips item={item} />
						{packageCount === undefined ? null : (
							<Badge color="brand" variant="outline">
								{packageCount} packages
							</Badge>
						)}
					</div>
					<p mix={[m(0), fg("neutral"), leading("snug"), text(size === "large" ? "base" : "sm")]}>
						{item.summary}
					</p>
				</div>
			</article>
		);
	};
}
