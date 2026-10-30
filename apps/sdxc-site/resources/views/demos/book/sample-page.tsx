/**
 * The opening page of the free chapter, set the way the book sets it: running head, a
 * large chapter numeral, a drop cap and a measure rule annotated in the margin colour,
 * so the sample band shows the book's own typography at work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, leading, text, tracking, weight } from "@sdxc/u/typography";
import { marketingSurface } from "@sdxc/ui/styles";

/**
 * Renders the page square-on on a ruled paper surface. The measure rule and the paragraph
 * share one 34ch column in the same face and size, so the rule spans exactly the line it
 * annotates, with a tick at each end.
 *
 * @returns The render function producing the sample page.
 */
export default function BookSamplePage() {
	return () => (
		<article
			aria-label="The first page of chapter 2, The measure"
			mix={[
				marketingSurface(),
				p(8),
				vstack({ gap: 6, align: "stretch" }),
				raw({ maxInlineSize: "30rem", marginInline: "auto" }),
			]}
		>
			<div
				mix={[
					hstack({ justify: "between" }),
					text("xs"),
					tracking("widest"),
					fg("neutral.muted"),
					raw({ textTransform: "uppercase" }),
				]}
			>
				<span>The Measure</span>
				<span>37</span>
			</div>
			<div mix={[vstack({ gap: 1, align: "start" })]}>
				<span
					aria-hidden="true"
					mix={[font("display"), raw({ fontSize: "4.5rem", lineHeight: "1" }), fg("brand")]}
				>
					2
				</span>
				<p mix={[m(0), font("display"), raw({ fontSize: "1.75rem" }), fg("neutral.emphasis")]}>
					The measure
				</p>
			</div>
			<div
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					font("display"),
					text("base"),
					raw({ maxInlineSize: "34ch" }),
				]}
			>
				<div
					aria-hidden="true"
					mix={[hstack({ gap: 2, align: "center" }), fg("brand"), raw({ blockSize: "0.75rem" })]}
				>
					<span
						mix={[
							raw({
								flex: "1",
								alignSelf: "stretch",
								borderInlineStart: "1px solid currentColor",
								background:
									"linear-gradient(currentColor, currentColor) 0 50% / 100% 1px no-repeat",
							}),
						]}
					/>
					<span mix={[text("xs"), tracking("wide"), weight("semibold")]}>34 ch</span>
					<span
						mix={[
							raw({
								flex: "1",
								alignSelf: "stretch",
								borderInlineEnd: "1px solid currentColor",
								background:
									"linear-gradient(currentColor, currentColor) 0 50% / 100% 1px no-repeat",
							}),
						]}
					/>
				</div>
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
							fg("neutral.emphasis"),
						]}
					>
						A
					</span>
					line of text is a road the eye travels and then has to find its way back along. Make the
					road too long and the reader loses the next line; too short and they spend the paragraph
					turning around. Somewhere between the two is a length that feels like no length at all.
				</p>
			</div>
		</article>
	);
}
