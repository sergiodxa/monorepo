/**
 * The sponsor and licence band: why Plumb stays MIT with no paid tier, the month's income
 * and what it pays for as a public ledger, then the companies and people who fund it, so
 * the licence story is told with its numbers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { HeartIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { LinkButton, PropertyList } from "@sdxc/ui";
import { LandingHeader, LandingSection, SponsorWall, Split } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { renderNearView } from "~/resources/views/demos/near-view";

/** The glyphs a sponsor's mark leads with, drawn in a 24-unit box. */
const GLYPHS = {
	slash: "M15 3 7 21h2.5L17.5 3z",
	brackets: "M8 4H4v16h4v-2.5H6.5v-11H8zM16 4h4v16h-4v-2.5h1.5v-11H16z",
	node: "M12 2 21 7v10l-9 5-9-5V7z",
	dots: "M6 6h4v4H6zM14 6h4v4h-4zM6 14h4v4H6zM14 14h4v4h-4z",
	wave: "M2 14c3-6 6-6 10 0s7 6 10 0v4c-3 6-6 6-10 0s-7-6-10 0z",
} as const;

namespace SponsorMark {
	export interface Props {
		/** The company's name, set in mono after the glyph. */
		name: string;
		/** The glyph that leads the name. */
		glyph: keyof typeof GLYPHS;
	}
}

/**
 * One sponsor's wordmark in `currentColor`, as wide as its name in mono, so the wall
 * sizes it like a real logo and it takes the page's ink in either tier.
 *
 * @param handle Runtime handle carrying the name and glyph.
 * @returns The render function producing the SVG.
 */
function SponsorMark(handle: Handle<SponsorMark.Props>) {
	return () => {
		let { glyph, name } = handle.props;
		let width = 32 + name.length * 12;
		return (
			<svg viewBox={`0 0 ${width} 28`} role="img" aria-label={name} fill="currentColor">
				<path d={GLYPHS[glyph]} transform="translate(0 2)" />
				<text
					x="30"
					y="20"
					font-size="19"
					font-weight="700"
					letter-spacing="-0.6"
					font-family="ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
				>
					{name}
				</text>
			</svg>
		);
	};
}

/** The two companies at the top tier. */
const PARTNERS = [
	{ name: "edgeport", glyph: "slash" },
	{ name: "tabula", glyph: "brackets" },
] as const;

/** The companies at the second tier. */
const SPONSORS = [
	{ name: "hexgrid", glyph: "node" },
	{ name: "formwork", glyph: "dots" },
	{ name: "lowtide", glyph: "wave" },
	{ name: "inkwell", glyph: "slash" },
	{ name: "quorum", glyph: "brackets" },
	{ name: "parsec", glyph: "node" },
] as const;

/** People who give each month, larger circles for larger amounts. */
const BACKERS = [
	{ name: "Dana Whitfield", size: "lg" },
	{ name: "Kwame Owusu", size: "lg" },
	{ name: "Sofia Marchetti", size: "md" },
	{ name: "Ravi Iyer", size: "md" },
	{ name: "Anouk Visser", size: "md" },
	{ name: "Tomasz Wolski", size: "sm" },
	{ name: "Leila Nasser", size: "sm" },
	{ name: "Mateus Prado", size: "sm" },
	{ name: "Chloe Durand", size: "sm" },
	{ name: "Ibrahim Sow", size: "sm" },
] as const;

/** Where the month's sponsorship goes, in the order the ledger lists it. */
const LEDGER = [
	["October income", "$9,420 from 2 partners, 6 sponsors, 214 backers"],
	["Maintainer time", "2 people, 3 days a week each"],
	["Benchmark machine", "$140, a dedicated runner so numbers stay comparable"],
	["CI and fuzzing", "$170"],
	["Kept in reserve", "$610, for security releases"],
] as const;

/**
 * Renders the band: the licence promise and the ledger side by side, then the wall with
 * one call to sponsor under it.
 *
 * @returns The render function producing the band.
 */
export function SponsorsChapter() {
	return () => (
		<LandingSection id="sponsors" ruled mix={[renderNearView(975, 1391)]}>
			<Split>
				<Split.Copy>
					<LandingHeader
						eyebrow="LICENSE · FUNDING.yml"
						description={
							<>
								No pro tier, no licence key, no relicensing later. Plumb is MIT and stays that way;{" "}
								<strong>sponsors pay for the maintainers' time</strong>, and the ledger is public
								every month.
							</>
						}
					>
						MIT, paid for in the open
					</LandingHeader>
				</Split.Copy>
				<Split.Media>
					<PropertyList mix={[raw({ fontSize: "0.875rem" })]}>
						{LEDGER.map(([label, value]) => (
							<PropertyList.Item key={label} label={label}>
								{value}
							</PropertyList.Item>
						))}
					</PropertyList>
				</Split.Media>
			</Split>
			<SponsorWall
				mix={[raw({ marginBlockStart: "var(--ui-landing-header-space)" })]}
				actions={
					<LinkButton href="#sponsors" color="brand" mix={[landingCtaChrome()]}>
						<HeartIcon aria-hidden="true" data-slot="icon" />
						Sponsor plumb
					</LinkButton>
				}
			>
				<SponsorWall.Tier label="Partners" size="lg">
					{PARTNERS.map((sponsor) => (
						<a key={sponsor.name} href="#sponsors">
							<SponsorMark name={sponsor.name} glyph={sponsor.glyph} />
						</a>
					))}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Sponsors" size="sm">
					{SPONSORS.map((sponsor) => (
						<a key={sponsor.name} href="#sponsors">
							<SponsorMark name={sponsor.name} glyph={sponsor.glyph} />
						</a>
					))}
				</SponsorWall.Tier>
				<SponsorWall.Individuals label="Backers">
					{BACKERS.map((backer) => (
						<SponsorWall.Person
							key={backer.name}
							href="#sponsors"
							name={backer.name}
							size={backer.size}
						/>
					))}
				</SponsorWall.Individuals>
			</SponsorWall>
		</LandingSection>
	);
}
