/**
 * The showcase's gallery parts: the filter chips that narrow it through `?kind=`, and the
 * tile every item gets, a screenshot over its name, chips and summary. Each tile carries a
 * chip saying whether it runs in production or is a demo, so no demo reads as a product.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { border, fg, outline } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";
import { Badge, LinkButton } from "@sdxc/ui";

import type { ShowcaseFilter, ShowcaseItem } from "~/app/services/case-studies";

import { DARK_SCHEME, darkScreenshotSrc, showcaseHref } from "~/app/services/case-studies";
import { kindChips } from "~/app/services/showcase-kinds";

/** How each filter chip reads. */
const FILTER_LABELS: Record<ShowcaseFilter, string> = {
	all: "All",
	production: "In production",
	demo: "Demos",
	app: "Apps",
	landing: "Landings",
	docs: "Docs sites",
	blog: "Blogs",
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

/** The first chip's colour: green for live, warning for a demo, neutral for source only. */
const STATUS_COLORS: Record<string, "success" | "warning" | "neutral"> = {
	"In production": "success",
	Demo: "warning",
	"Source only": "neutral",
};

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
		let [status, category] = kindChips({ ...item, live: item.liveHref !== null });
		return (
			<span mix={[hstack({ gap: 1.5, align: "center" }), raw({ flexWrap: "wrap" })]}>
				<Badge color={STATUS_COLORS[status]}>{status}</Badge>
				<Badge color="neutral" variant="outline">
					{category}
				</Badge>
			</span>
		);
	};
}

namespace ShowcaseScreenshot {
	export interface Props {
		/** The light-scheme shot; its dark twin sits beside it under the same name. */
		src: string;
		alt: string;
		id?: string;
		loading?: "lazy" | "eager";
		fetchpriority?: "high" | "low" | "auto";
		width?: number;
		height?: number;
		mix?: TagProps<"img">["mix"];
	}
}

/**
 * A showcase screenshot in the reader's color scheme: the browser picks the dark capture when
 * the system prefers dark, as the site's own theme does, so a shot never flashes the other
 * scheme inside a page. The image carries the styles; the picture around it adds no box.
 */
export function ShowcaseScreenshot(handle: Handle<ShowcaseScreenshot.Props>) {
	return () => {
		let { alt, fetchpriority, height, id, loading, mix, src, width } = handle.props;
		return (
			<picture mix={[raw({ display: "contents" })]}>
				<source media={DARK_SCHEME} srcset={darkScreenshotSrc(src)} />
				<img
					id={id}
					src={src}
					alt={alt}
					loading={loading}
					decoding="async"
					fetchpriority={fetchpriority}
					width={width}
					height={height}
					mix={mix}
				/>
			</picture>
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
						<ShowcaseScreenshot
							src={shot.src}
							alt=""
							loading="lazy"
							width={shot.width}
							height={shot.height}
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
