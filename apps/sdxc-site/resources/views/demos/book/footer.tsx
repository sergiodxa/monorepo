/**
 * The book page's footer: the author's letters sign-up ruled off across the top, the
 * wordmark and the page's links in columns, the copyright line, and the title set across
 * the full measure as the last thing on the page, like a book's back board.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RssIcon, MailIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { flexCol, flexRow, items, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Button, Heading, TextField } from "@sdxc/ui";
import { SiteFooter } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import BookLogo from "~/resources/views/demos/book/logo";
import { SERIF } from "~/resources/views/demos/book/type";

/** The link columns: four, so a phone sets them two by two and a wide footer in one row. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "The book",
		links: [
			{ href: "#sample", label: "Free chapter" },
			{ href: "#contents", label: "Table of contents" },
			{ href: "#learn", label: "What you’ll learn" },
		],
	},
	{
		title: "Buying",
		links: [
			{ href: "#pricing", label: "Pricing" },
			{ href: "#pricing", label: "Team licences" },
			{ href: "#faq", label: "Refunds and questions" },
		],
	},
	{
		title: "Author",
		links: [
			{ href: "#author", label: "About Odile" },
			{ href: "#reviews", label: "Reader reviews" },
			{ href: "#praise", label: "Press" },
		],
	},
	{
		title: "Elsewhere",
		links: [
			{ href: "/examples/book/odile", label: "Odile’s studio" },
			{ href: "/examples/book/letters", label: "Letters on type" },
			{ href: "/examples/book/feed.xml", label: "RSS feed" },
		],
	},
];

/**
 * The letters sign-up: a heading, one line on what arrives, and the address field beside
 * its button from `sm`, so the address and the action read as one step.
 */
function Letters() {
	return () => (
		<div mix={[vstack({ gap: 4, align: "stretch" })]}>
			<div mix={[vstack({ gap: 1, align: "start" })]}>
				<Heading mix={[raw({ fontWeight: "400" })]}>Letters on type</Heading>
				<p mix={[m(0), text("sm"), fg("neutral")]}>
					One short letter a month from Odile, on a single detail worth setting well.
				</p>
			</div>
			<form method="post" action="/examples/book/letters">
				<div
					mix={[
						combine([
							flexCol(),
							raw({ display: "flex", gap: "0.75rem" }),
							at("sm", [flexRow(), items("end")]),
						]),
					]}
				>
					<TextField
						label="Email address"
						type="email"
						name="email"
						autoComplete="email"
						placeholder="you@studio.com"
						required
						mix={[raw({ flex: "1" })]}
					/>
					<Button type="submit" color="neutral" mix={[marketingCtaChrome()]}>
						Subscribe
					</Button>
				</div>
			</form>
		</div>
	);
}

/**
 * The title in ink, lettered to a fixed width so it spans the measure in any serif the
 * reader has; the red stays reserved for the page's actions.
 */
function Wordmark() {
	return () => (
		<svg viewBox="0 0 1000 150" fill="var(--ui-neutral-fg-emphasis)">
			<text
				x="0"
				y="122"
				textLength="1000"
				lengthAdjust="spacingAndGlyphs"
				font-family={SERIF}
				font-size="150"
				letter-spacing="-3"
			>
				<tspan font-style="italic">The</tspan> Measure
			</text>
		</svg>
	);
}

/**
 * Renders the footer with the sign-up as a ruled band above the columns, and the legal
 * line with the letters and feed links before the wordmark.
 *
 * @returns The render function producing the footer.
 */
export default function BookFooter() {
	return () => (
		<SiteFooter
			brand={<BookLogo />}
			tagline="Web typography, set by hand. A book and video course by Odile Varga."
			columns={COLUMNS}
			newsletter={<Letters />}
			newsletterPlacement="band"
			social={
				<>
					<a href="/examples/book/letters" aria-label="Letters by email">
						<MailIcon aria-hidden="true" />
					</a>
					<a href="/examples/book/feed.xml" aria-label="RSS feed">
						<RssIcon aria-hidden="true" />
					</a>
				</>
			}
			legal={<p mix={[m(0)]}>© 2026 Odile Varga. Set in the reader’s own serif.</p>}
			wordmark={<Wordmark />}
			mix={[raw({ marginBlockStart: "auto" })]}
		/>
	);
}
