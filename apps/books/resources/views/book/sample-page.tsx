/**
 * The opening page of a book's free chapter, set as the book sets it: a running head, the
 * chapter title under a red rule, a drop cap, and the first subhead, so the sample band
 * shows the reader the actual words they unlock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, leading, text, tracking } from "@sdxc/u/typography";
import { landingSurface } from "@sdxc/ui/styles";

import type { BookCopy } from "~/resources/content/books";

/**
 * Renders the page square-on on a ruled paper surface, its copy capped at 34ch like a
 * printed column, and hidden behind one accessible name since it repeats the chapter.
 *
 * @param handle Runtime handle carrying the page's copy.
 * @returns The render function producing the sample page.
 */
export default function SamplePage(handle: Handle<{ page: BookCopy.SamplePage }>) {
	return () => {
		let { page } = handle.props;

		return (
			<article
				aria-label={`The first page of “${page.title}”`}
				mix={[
					landingSurface(),
					p(8),
					vstack({ gap: 6, align: "stretch" }),
					raw({ maxInlineSize: "30rem", marginInline: "auto", inlineSize: "100%" }),
				]}
			>
				<div
					aria-hidden="true"
					mix={[
						hstack({ justify: "between" }),
						text("xs"),
						tracking("widest"),
						fg("neutral.muted"),
						raw({ textTransform: "uppercase" }),
					]}
				>
					<span>{page.runningHead}</span>
					<span>Sample</span>
				</div>
				<div mix={[vstack({ gap: 3, align: "start" })]}>
					<span
						aria-hidden="true"
						mix={[
							raw({ inlineSize: "3rem", blockSize: "3px", backgroundColor: "var(--ui-brand-fg)" }),
						]}
					/>
					<p
						mix={[
							m(0),
							font("display"),
							leading("tight"),
							raw({ fontSize: "1.75rem" }),
							fg("neutral.emphasis"),
						]}
					>
						{page.title}
					</p>
				</div>
				<div
					mix={[
						vstack({ gap: 3, align: "stretch" }),
						font("display"),
						text("base"),
						raw({ maxInlineSize: "34ch" }),
					]}
				>
					<p
						mix={[
							m(0),
							leading("relaxed"),
							fg("neutral"),
							raw({ hyphens: "auto", textWrap: "pretty" }),
						]}
					>
						<span
							mix={[
								raw({
									float: "left",
									fontSize: "3.4em",
									lineHeight: "0.82",
									paddingInlineEnd: "0.08em",
									paddingBlockStart: "0.06em",
								}),
								fg("brand"),
							]}
						>
							{page.opening.slice(0, 1)}
						</span>
						{page.opening.slice(1)}
					</p>
					<p mix={[m(0), text("lg"), fg("neutral.emphasis")]}>{page.subhead}</p>
					<p mix={[m(0), leading("relaxed"), fg("neutral"), raw({ textWrap: "pretty" })]}>
						{page.continuation}
					</p>
				</div>
			</article>
		);
	};
}
