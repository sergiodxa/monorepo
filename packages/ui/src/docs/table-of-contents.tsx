/**
 * Island: a docs page's own headings as an "On this page" list, as a rail beside the prose
 * or a sticky bar on a narrow screen. The links work as plain anchors; once it loads a
 * marker slides over every section on screen and the bar names the section being read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { ChevronDownIcon, ListIcon } from "@sdxc/icons";
import { bg, borderEdge, fg, stroke } from "@sdxc/u/color";
import { rounded, transition, transitionDuration } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { absolute, block, hidden, hstack, insIs, relative, shrink, vstack } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { is, m, maxBs, minBs, minIs, mis, p, pi, pis } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { rotate } from "@sdxc/u/transform";
import { text, truncate, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { tocSpy } from "./mixins/toc-spy.js";

/** The shallowest heading level the list offers, which every indent is measured from. */
const BASE_LEVEL = 2;

/** How far each heading level below {@link BASE_LEVEL} sets an item in, in rem. */
const INDENT_STEP = 0.75;

/**
 * Width below which the bar names only its label: beside a menu button there is room for
 * a letter or two of the section, which reads as noise rather than a name.
 */
const NARROW_BAR = "(max-width: 22.4375rem)";

/** Circumference of the bar's progress ring (radius 7), which its dash pattern spans. */
const RING = 43.98;

/** Shared easing for the marker and ring, a quick start that settles softly. */
const SETTLE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Prop types for {@link TableOfContents}. */
export namespace TableOfContents {
	/** One heading the list links to; `level` 2 sits flush and each deeper level indents. */
	export type Item = { id: string; text: string; level: number };

	/** Plain data only, since the props cross into the browser with the island. */
	export type Props = {
		items: Item[];
		/** The list's visible heading and the landmark's accessible name ("On this page"). */
		label: string;
		/**
		 * `rail` lists the headings under the label, for the column beside the prose; `bar`
		 * folds them into a disclosure whose summary names the section being read.
		 * @default "rail"
		 */
		layout?: "rail" | "bar";
		/**
		 * Fewest headings that earn a list; a shorter page renders nothing, so a layout can
		 * test the same number to drop its rail column.
		 * @default 2
		 */
		minItems?: number;
	};
}

/**
 * Renders the in-page navigation, or nothing when the page has fewer than `minItems`
 * headings. Load `@sdxc/ui/table-of-contents` in the browser entry. Headings that the
 * page's layout gives a `scroll-margin-top` set the line a section is read from.
 *
 * @example
 * <TableOfContents items={anchors} label="On this page" />
 * @example
 * <TableOfContents items={anchors} label="On this page" layout="bar" />
 */
export const TableOfContents: EntryComponent<TableOfContents.Props> = clientEntry(
	"@sdxc/ui/table-of-contents#TableOfContents",
	function TableOfContents(handle: Handle<TableOfContents.Props>) {
		return () => {
			let { items, label, layout = "rail", minItems = TOC_MIN_ITEMS } = handle.props;
			if (items.length < minItems) return null;

			let list = <TocList items={items} />;

			if (layout === "bar") {
				return (
					<details data-toc="bar" mix={[relative(), minIs(0), raw({ flex: "1 1 auto" })]}>
						<summary
							mix={[
								hstack({ gap: 2, align: "center" }),
								minBs("2.75rem"),
								pi(3, 0),
								text("sm"),
								fg("neutral"),
								listStyle("none"),
								raw({ cursor: "pointer" }),
								when("&::-webkit-details-marker", hidden()),
								when("&:focus-visible", raw({ outlineOffset: "-2px" })),
							]}
						>
							<ProgressRing />
							<span mix={[shrink(0), fg("neutral.emphasis"), weight("medium")]}>{label}</span>
							<span
								data-toc-reading=""
								aria-live="off"
								mix={[minIs(0), truncate(), media(NARROW_BAR, hidden())]}
							/>
							<ChevronDownIcon
								size={16}
								aria-hidden="true"
								mix={[
									shrink(0),
									mis("auto"),
									transition("transform"),
									media("(prefers-reduced-motion: reduce)", transitionDuration("0s")),
									when("[open] > summary > &", rotate(180)),
								]}
							/>
						</summary>

						<nav
							aria-label={label}
							mix={[
								absolute(),
								raw({ insetInline: 0, insetBlockStart: "100%" }),
								maxBs("min(60dvh, 28rem)"),
								overflowY("auto"),
								p(3, 4),
								bg("neutral.bg-tint"),
								borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
								raw({ boxShadow: "var(--ui-shadow-float, none)" }),
							]}
						>
							{list}
						</nav>
					</details>
				);
			}

			return (
				<nav data-toc="rail" aria-label={label} mix={[vstack({ gap: 3 })]}>
					<p
						mix={[
							m(0),
							hstack({ gap: 2, align: "center" }),
							text("sm"),
							fg("neutral.emphasis"),
							weight("medium"),
						]}
					>
						<ListIcon size={14} aria-hidden="true" />
						{label}
					</p>
					{list}
				</nav>
			);
		};
	},
);

/** Fewest headings that earn a list when `minItems` is unset. */
export const TOC_MIN_ITEMS = 2;

namespace TocList {
	export interface Props {
		items: TableOfContents.Item[];
	}
}

/**
 * The links on a guide line, with one marker that {@link tocSpy} stretches over the
 * sections on screen. The marker stays invisible until the spy has placed it once.
 */
function TocList(handle: Handle<TocList.Props>) {
	return () => (
		<div mix={[relative(), tocSpy()]}>
			<span
				data-toc-marker=""
				aria-hidden="true"
				mix={[
					absolute(),
					raw({
						insetBlockStart: 0,
						blockSize: "var(--toc-marker-size, 0px)",
						transform: "translateY(var(--toc-marker-start, 0px))",
						opacity: 0,
						transition: `transform 300ms ${SETTLE}, block-size 300ms ${SETTLE}, opacity 150ms ease-out`,
					}),
					insIs(0),
					is("2px"),
					rounded("full"),
					bg("brand.solid"),
					when("[data-toc-ready] > &", raw({ opacity: 1 })),
					media("(prefers-reduced-motion: reduce)", raw({ transition: "opacity 150ms linear" })),
				]}
			/>
			<ul
				mix={[
					vstack({ gap: 0 }),
					m(0),
					p(0),
					listStyle("none"),
					borderEdge("inline-start", { color: "neutral.border", width: 1, style: "solid" }),
				]}
			>
				{handle.props.items.map((item) => {
					let depth = Math.max(item.level - BASE_LEVEL, 0);
					return (
						<li key={item.id}>
							<a
								href={`#${item.id}`}
								mix={[
									block(),
									raw({ textWrap: "pretty" }),
									text("sm"),
									fg("neutral"),
									p(1.5, 0),
									pis(`${INDENT_STEP + depth * INDENT_STEP}rem`),
									transition("color"),
									hover(fg("neutral.emphasis")),
									when("&[data-active]", fg("neutral.emphasis")),
									when('&[data-active="lead"]', [fg("brand"), weight("medium")]),
								]}
							>
								{item.text}
							</a>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/**
 * An 18px ring in the bar that fills as the reader moves down the list, read from the
 * `--toc-progress` the spy sets on the bar; empty before it loads.
 */
function ProgressRing() {
	return () => (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			aria-hidden="true"
			mix={[shrink(0), rotate(-90)]}
		>
			<circle cx="9" cy="9" r="7" fill="none" stroke-width="2" mix={[stroke("neutral.border")]} />
			<circle
				cx="9"
				cy="9"
				r="7"
				fill="none"
				stroke-width="2"
				stroke-linecap="round"
				mix={[
					stroke("brand.solid"),
					raw({
						strokeDasharray: `${RING}px`,
						strokeDashoffset: `calc(${RING}px * (1 - var(--toc-progress, 0)))`,
						transition: `stroke-dashoffset 300ms ${SETTLE}`,
					}),
					media("(prefers-reduced-motion: reduce)", raw({ transition: "none" })),
				]}
			/>
		</svg>
	);
}
