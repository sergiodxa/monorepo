/**
 * Client island: a page's own headings as links, with the section being read marked
 * against a guide line. The list renders and navigates as plain anchors on its own;
 * script only adds the mark, so a reader without it loses the mark, not the links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ListIcon } from "@sdxc/icons";
import { bg, borderEdge, fg } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { listStyle, pseudoContent } from "@sdxc/u/general";
import { absolute, block, hstack, insBs, insIs, relative, vstack } from "@sdxc/u/layout";
import { bs, is, m, mis, p, pis } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, truncate, weight } from "@sdxc/u/typography";
import { clientEntry, ref } from "remix/component";

/**
 * The band at the top of the viewport a heading has to sit in to count as the one
 * being read. Shrinking the root from below leaves it, so the mark follows crossings
 * rather than a measurement taken on every scroll tick.
 */
const READING_BAND = "0px 0px -70% 0px";

/** The shallowest depth the list offers, which every indent is measured from. */
const BASE_LEVEL = 2;

/** How far one extra heading depth sets an item in, in rem. */
const INDENT_STEP = 0.75;

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type TableOfContentsProps = {
	anchors: Array<{ id: string; text: string; level: number }>;
};

/** Renders the in-page navigation, or nothing when the page has too few headings. */
export const TableOfContents = clientEntry(
	"/resources/components/table-of-contents.tsx#TableOfContents",
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

		return () => {
			let { anchors } = handle.props;
			if (anchors.length < 2) return null;

			return (
				<nav aria-label="On this page" mix={[vstack({ gap: 3 })]}>
					<p mix={[m(0), hstack({ gap: 2, align: "center" }), text("sm"), fg("neutral")]}>
						<ListIcon size={14} aria-hidden="true" />
						On this page
					</p>

					{/* The list's leading edge draws the guide a marked item's own edge sits on. */}
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

							return (
								<li key={anchor.id}>
									<a
										href={`#${anchor.id}`}
										data-active={isLead ? "lead" : isMarked ? "" : undefined}
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
				</nav>
			);
		};
	},
);

export default TableOfContents;
