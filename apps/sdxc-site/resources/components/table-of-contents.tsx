/**
 * Client island: a page's own headings as links, with the section being read marked
 * against a guide line, as a rail beside the prose or a disclosure bar on narrow screens.
 * The links work as plain anchors; script adds the mark and closes the bar on a jump.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChevronDownIcon, ListIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { bg, borderEdge, fg } from "@sdxc/u/color";
import { rounded, transition, transitionDuration } from "@sdxc/u/effects";
import { listStyle, pseudoContent, raw } from "@sdxc/u/general";
import {
	absolute,
	block,
	hidden,
	hstack,
	insBs,
	insIs,
	relative,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, maxBs, minBs, minIs, mis, p, pis } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { rotate } from "@sdxc/u/transform";
import { text, truncate, weight } from "@sdxc/u/typography";
import { clientEntry, on, ref } from "remix/component";

/**
 * The band at the top of the viewport a heading has to sit in to count as the one
 * being read. Shrinking the root from below leaves it, so the mark follows crossings
 * rather than a measurement taken on every scroll tick.
 */
const READING_BAND = "0px 0px -70% 0px";

/** Fewest headings that earn an in-page list; fewer leave the rail empty. */
export const TOC_MIN_ANCHORS = 2;

/** The shallowest depth the list offers, which every indent is measured from. */
const BASE_LEVEL = 2;

/** How far one extra heading depth sets an item in, in rem. */
const INDENT_STEP = 0.75;

/** The width the bar's gutter widens at, matching the prose under it so their text aligns. */
const GUTTER_BREAKPOINT = "(min-width: 60rem)";

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type TableOfContentsProps = {
	anchors: Array<{ id: string; text: string; level: number }>;
	/**
	 * `rail` lists the headings under a label, for the column beside the prose; `bar` folds
	 * them into a disclosure whose summary names the section being read, for a narrow screen.
	 * @default "rail"
	 */
	layout?: "rail" | "bar";
};

/** Renders the in-page navigation, or nothing when the page has too few headings. */
export const TableOfContents = clientEntry(
	import.meta.url,
	function TableOfContents(handle: Handle<TableOfContentsProps>) {
		/**
		 * The headings in the band, in document order. The last set is kept when the band
		 * empties between one heading leaving it and the next arriving, since a reader in
		 * the middle of a section is still in that section.
		 */
		let marked: string[] = [];

		let watch = ref((node, signal) => {
			let { anchors } = handle.props;
			let headings = new Map<string, Element>();
			let inBand = new Set<string>();

			/**
			 * The section the reader is inside when no heading is in the band: the last one
			 * they scrolled past, since the prose under it is what fills the screen.
			 */
			function lastPassed(): string[] {
				let passed = anchors.filter((anchor) => {
					let heading = headings.get(anchor.id);
					return heading !== undefined && heading.getBoundingClientRect().top < 0;
				});

				let current = passed.at(-1) ?? anchors.at(0);
				return current ? [current.id] : [];
			}

			let observer = new IntersectionObserver(
				(entries) => {
					for (let entry of entries) {
						if (entry.isIntersecting) inBand.add(entry.target.id);
						else inBand.delete(entry.target.id);
					}

					let reading = anchors.map((anchor) => anchor.id).filter((id) => inBand.has(id));
					if (reading.length === 0) reading = lastPassed();
					if (reading.join(" ") === marked.join(" ")) return;

					marked = reading;
					void handle.update();
				},
				{ rootMargin: READING_BAND },
			);

			for (let anchor of anchors) {
				let heading = node.ownerDocument.getElementById(anchor.id);
				if (!heading) continue;
				headings.set(anchor.id, heading);
				observer.observe(heading);
			}

			signal.addEventListener("abort", () => observer.disconnect(), { once: true });
		});

		/**
		 * Closes the bar once a reader follows one of its links, so the section they jumped
		 * to is not hidden under the open list.
		 */
		let closeOnJump = on<HTMLDetailsElement, "click">("click", (event) => {
			if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
			event.currentTarget.open = false;
		});

		return () => {
			let { anchors, layout = "rail" } = handle.props;
			if (anchors.length < TOC_MIN_ANCHORS) return null;

			let list = (
				<ul
					mix={[
						watch,
						vstack({ gap: 0 }),
						m(0),
						p(0),
						listStyle("none"),
						borderEdge("inline-start", { color: "neutral.border", width: 1, style: "solid" }),
					]}
				>
					{anchors.map((anchor) => {
						let depth = Math.max(anchor.level - BASE_LEVEL, 0);
						let isMarked = marked.includes(anchor.id);
						let isLead = marked.at(0) === anchor.id;
						let active = iife(() => {
							if (isLead) return "lead";
							if (isMarked) return "";
							return undefined;
						});

						return (
							<li key={anchor.id}>
								<a
									href={`#${anchor.id}`}
									data-active={active}
									mix={[
										relative(),
										block(),
										truncate(),
										text("sm"),
										fg("neutral"),
										p(1.5, 0),
										pis(`${INDENT_STEP + depth * INDENT_STEP}rem`),
										mis("-1px"),
										borderEdge("inline-start", {
											color: "transparent",
											width: 2,
											style: "solid",
										}),
										transition("color, border-color"),
										hover(fg("neutral.emphasis")),
										when("&[data-active]", [
											fg("brand"),
											weight("medium"),
											borderEdge("inline-start", { color: "brand", width: 2, style: "solid" }),
										]),
										when('&[data-active="lead"]::before', [
											pseudoContent('""'),
											absolute(),
											insIs("-5px"),
											insBs("calc(50% - 0.1875rem)"),
											is("0.375rem"),
											bs("0.375rem"),
											rounded("full"),
											bg("brand.solid"),
										]),
									]}
								>
									{anchor.text}
								</a>
							</li>
						);
					})}
				</ul>
			);

			if (layout === "bar") {
				let reading = anchors.find((anchor) => anchor.id === marked.at(0));

				return (
					<details data-slot="toc-bar" mix={[closeOnJump]}>
						<summary
							mix={[
								hstack({ gap: 2, align: "center" }),
								minBs("2.75rem"),
								p(0, 5),
								media(GUTTER_BREAKPOINT, p(0, 8)),
								text("sm"),
								fg("neutral"),
								listStyle("none"),
								raw({ cursor: "pointer" }),
								when("&::-webkit-details-marker", hidden()),
								when("&:focus-visible", raw({ outlineOffset: "-2px" })),
							]}
						>
							<ListIcon size={14} aria-hidden="true" mix={[shrink(0)]} />
							<span mix={[shrink(0), fg("neutral.emphasis"), weight("medium")]}>On this page</span>
							{reading ? <span mix={[minIs(0), truncate()]}>{reading.text}</span> : null}
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
							aria-label="On this page"
							mix={[
								absolute(),
								raw({ insetInline: 0, insetBlockStart: "100%" }),
								maxBs("min(60dvh, 28rem)"),
								overflowY("auto"),
								p(3, 5),
								media(GUTTER_BREAKPOINT, p(3, 8)),
								bg(),
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
				<nav aria-label="On this page" mix={[vstack({ gap: 3 })]}>
					<p mix={[m(0), hstack({ gap: 2, align: "center" }), text("sm"), fg("neutral")]}>
						<ListIcon size={14} aria-hidden="true" />
						On this page
					</p>

					{list}
				</nav>
			);
		};
	},
);

export default TableOfContents;
