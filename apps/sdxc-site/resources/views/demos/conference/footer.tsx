/**
 * The conference page's footer: the line-up letter sign-up ruled across the top, the mark and
 * the page's links in columns, and the name lettered across the whole measure as the last line
 * of the poster.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Heading, TextField } from "@sdxc/ui";
import { SiteFooter } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";
import { css } from "remix/component";

import { BLEND, BLUE, DISPLAY, PINK } from "~/resources/views/demos/conference/ink";
import ConferenceLogo from "~/resources/views/demos/conference/logo";

/** The link columns: four, so a phone sets them two by two and a wide footer in one row. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "The day",
		links: [
			{ href: "#schedule", label: "Schedule" },
			{ href: "#speakers", label: "Speakers" },
			{ href: "#tickets", label: "Tickets" },
		],
	},
	{
		title: "Being there",
		links: [
			{ href: "#venue", label: "Venue and access" },
			{ href: "#travel", label: "Travel and hotels" },
			{ href: "#conduct", label: "Code of conduct" },
		],
	},
	{
		title: "Watch",
		links: [
			{ href: "#talks", label: "2026 talks" },
			{ href: "/examples/overprint/videos", label: "Video archive" },
			{ href: "/examples/overprint/feed.xml", label: "Video feed" },
		],
	},
	{
		title: "Organisers",
		links: [
			{ href: "#sponsors", label: "Sponsors" },
			{ href: "/examples/overprint/sponsor", label: "Sponsor pack" },
			{ href: "/examples/overprint/volunteer", label: "Volunteer" },
		],
	},
];

/**
 * The line-up letter: one heading, one line on what arrives and when, and the address field
 * beside its button from `sm`.
 */
function Letter() {
	return () => (
		<div mix={css({ display: "grid", gap: "1rem" })}>
			<div mix={css({ display: "grid", gap: "0.25rem" })}>
				<Heading mix={css({ fontFamily: DISPLAY, fontWeight: "900", textTransform: "uppercase" })}>
					Hear about 2028 first
				</Heading>
				<p mix={css({ margin: "0", fontSize: "0.9375rem" })}>
					Four emails a year: the call for speakers, the line-up, early bird day and the videos.
				</p>
			</div>
			<form method="post" action="/examples/overprint/letter">
				<div
					mix={css({
						display: "flex",
						flexDirection: "column",
						gap: "0.75rem",
						"@container (min-width: 40rem)": { flexDirection: "row", alignItems: "end" },
					})}
				>
					<TextField
						label="Email address"
						type="email"
						name="email"
						autoComplete="email"
						placeholder="you@example.com"
						required
						mix={css({ flex: "1" })}
					/>
					<Button type="submit" color="brand" mix={[landingCtaChrome()]}>
						Sign up
					</Button>
				</div>
			</form>
		</div>
	);
}

/**
 * The name across the full measure in two inks, "Over" in pink and "print" in blue, lettered
 * to a fixed width so it spans the column in whatever condensed face the reader has.
 */
function Wordmark() {
	return () => (
		<svg viewBox="0 0 1000 190" aria-hidden="true">
			<text
				x="0"
				y="160"
				textLength="430"
				lengthAdjust="spacingAndGlyphs"
				font-family={DISPLAY}
				font-size="190"
				font-weight="900"
				fill={PINK}
			>
				OVER
			</text>
			<text
				x="450"
				y="160"
				textLength="550"
				lengthAdjust="spacingAndGlyphs"
				font-family={DISPLAY}
				font-size="190"
				font-weight="900"
				fill={BLUE}
				style={`mix-blend-mode: ${BLEND}`}
			>
				PRINT
			</text>
		</svg>
	);
}

/**
 * Renders the footer.
 *
 * @returns The render function producing the footer.
 */
export default function ConferenceFooter() {
	return () => (
		<SiteFooter
			brand={<ConferenceLogo />}
			tagline="A one-day conference on the web platform. Rotterdam, Thursday 15 April 2027."
			columns={COLUMNS}
			newsletter={<Letter />}
			newsletterPlacement="band"
			legal={<p mix={css({ margin: "0" })}>© 2026 Stichting Overprint. Printed in two inks.</p>}
			wordmark={<Wordmark />}
			mix={css({ marginBlockStart: "auto" })}
		/>
	);
}
