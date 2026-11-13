/**
 * The sponsors on a tiered wall, each mark a shape and a name printed in blue ink, with a pink
 * call for next year's partners. The wall pays for the captions, the scholarships and lunch,
 * which the band says outright.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LinkButton } from "@sdxc/ui";
import { LandingHeader, LandingSection, SponsorWall } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";
import { css } from "remix/component";

import type { Sponsor } from "~/resources/views/demos/conference/data";

import { SPONSORS } from "~/resources/views/demos/conference/data";
import { BLUE, DISPLAY } from "~/resources/views/demos/conference/ink";
import { renderNearView } from "~/resources/views/demos/near-view";

/**
 * Renders the band.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceSponsors() {
	return () => (
		<LandingSection id="sponsors" tone="tinted" mix={[renderNearView(900, 1400)]}>
			<LandingHeader
				eyebrow="Sponsors"
				align="center"
				description={
					<>
						Their money pays for live captions, the 40 scholarship seats and lunch, so{" "}
						<strong>a ticket costs less than the day does</strong>. None of them get a talk.
					</>
				}
				parts={{ title: [css({ textTransform: "uppercase" })] }}
			>
				Paid for by people who build for the web
			</LandingHeader>
			<SponsorWall
				actions={
					<LinkButton href="/examples/overprint/sponsor" color="brand" mix={[landingCtaChrome()]}>
						Read the sponsor pack
					</LinkButton>
				}
			>
				<SponsorWall.Tier label="Headline" size="xl">
					{SPONSORS.headline.map((sponsor) => (
						<SponsorMark key={sponsor.name} sponsor={sponsor} />
					))}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Partners" size="md">
					{SPONSORS.partner.map((sponsor) => (
						<SponsorMark key={sponsor.name} sponsor={sponsor} />
					))}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Community" size="sm">
					{SPONSORS.community.map((sponsor) => (
						<SponsorMark key={sponsor.name} sponsor={sponsor} />
					))}
				</SponsorWall.Tier>
			</SponsorWall>
		</LandingSection>
	);
}

/** The shape each mark leads with, drawn in a 24-unit box. */
const GLYPHS: Record<Sponsor["glyph"], string> = {
	circle: "M 12 2 A 10 10 0 1 1 11.99 2 Z",
	square: "M 3 3 H 21 V 21 H 3 Z",
	triangle: "M 12 2 L 22 21 H 2 Z",
	bars: "M 2 4 H 22 V 8 H 2 Z M 2 10 H 22 V 14 H 2 Z M 2 16 H 22 V 20 H 2 Z",
	ring: "M 12 2 A 10 10 0 1 1 11.99 2 Z M 12 7 A 5 5 0 1 0 12.01 7 Z",
	diamond: "M 12 1 L 23 12 L 12 23 L 1 12 Z",
};

/**
 * One sponsor's mark, linked to their page: the glyph and the name lettered to a fixed width,
 * so every mark in a tier sits at the same size whatever face the reader has.
 */
function SponsorMark(handle: Handle<{ sponsor: Sponsor }>) {
	return () => {
		let { sponsor } = handle.props;
		let slug = sponsor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		return (
			<a href={`/examples/overprint/sponsors/${slug}`}>
				<svg viewBox="0 0 160 28" role="img" aria-label={sponsor.name} fill={BLUE}>
					<path d={GLYPHS[sponsor.glyph]} fill-rule="evenodd" transform="translate(0 2)" />
					<text
						x="34"
						y="23"
						textLength={Math.min(126, sponsor.name.length * 13)}
						lengthAdjust="spacingAndGlyphs"
						font-family={DISPLAY}
						font-size="26"
						font-weight="900"
					>
						{sponsor.name.toUpperCase()}
					</text>
				</svg>
			</a>
		);
	};
}
