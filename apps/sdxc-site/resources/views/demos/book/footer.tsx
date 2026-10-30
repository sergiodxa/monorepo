/**
 * The book page's footer: the mark with a one-line pitch, three columns of links back into
 * the page, and the copyright line. Every link is an anchor on this page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, grid, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { leading, text, weight } from "@sdxc/u/typography";
import { NavLink } from "@sdxc/ui";
import { marketingContainer } from "@sdxc/ui/styles";

import BookLogo from "~/resources/views/demos/book/logo";

/** The link columns: a heading, then each link's anchor and label. */
const COLUMNS = [
	[
		"The book",
		[
			["#learn", "What you’ll learn"],
			["#contents", "Table of contents"],
			["#sample", "Free chapter"],
		],
	],
	[
		"Buying",
		[
			["#pricing", "Pricing"],
			["#pricing", "Team licences"],
			["#faq", "Refunds and questions"],
		],
	],
	[
		"Author",
		[
			["#author", "About Odile"],
			["#reviews", "Reader reviews"],
			["#sample", "Newsletter"],
		],
	],
] as const;

/**
 * Renders the pitch above the columns on a phone and beside them from the `lg` container,
 * with the copyright line ruled off underneath.
 *
 * @returns The render function producing the footer.
 */
export default function BookFooter() {
	return () => (
		<footer
			mix={[
				container("book-footer"),
				raw({
					borderBlockStart: "1px solid var(--ui-marketing-hairline)",
					marginBlockStart: "auto",
				}),
			]}
		>
			<div
				mix={[
					marketingContainer(),
					raw({ paddingBlock: "4rem 2.5rem" }),
					vstack({ gap: 12, align: "stretch" }),
				]}
			>
				<div
					mix={[
						grid(),
						combine([
							raw({ gap: "2.5rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }),
							at("lg", raw({ gridTemplateColumns: "minmax(0, 2fr) repeat(3, minmax(0, 1fr))" })),
						]),
					]}
				>
					<div
						mix={[
							vstack({ gap: 4, align: "start" }),
							combine([raw({ gridColumn: "1 / -1" }), at("lg", raw({ gridColumn: "auto" }))]),
						]}
					>
						<BookLogo />
						<p
							mix={[
								m(0),
								text("sm"),
								leading("relaxed"),
								fg("neutral"),
								raw({ maxInlineSize: "22rem" }),
							]}
						>
							Web typography, set by hand. A book and video course by Odile Varga.
						</p>
					</div>
					{COLUMNS.map(([heading, links]) => (
						<div key={heading} mix={[vstack({ gap: 3, align: "start" })]}>
							<p mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>{heading}</p>
							<ul
								mix={[m(0), p(0), raw({ listStyle: "none" }), vstack({ gap: 2.5, align: "start" })]}
							>
								{links.map(([href, label]) => (
									<li key={label}>
										<NavLink href={href} mix={[text("sm")]}>
											{label}
										</NavLink>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<div
					mix={[
						hstack({ gap: 4, justify: "between" }),
						raw({ flexWrap: "wrap" }),
						raw({
							paddingBlockStart: "2rem",
							borderBlockStart: "1px solid var(--ui-marketing-hairline)",
						}),
						text("sm"),
						fg("neutral.muted"),
					]}
				>
					<span>© 2026 Odile Varga. All rights reserved.</span>
					<span>Set in the reader’s own serif and sans.</span>
				</div>
			</div>
		</footer>
	);
}
