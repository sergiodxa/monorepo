/**
 * Live preview for `SponsorWall`: an open-source project's partners in three tiers that
 * shrink from two large cells to a row of small ones, then the individual backers as a
 * grayscale avatar cloud and the call to sponsor, inside a band with its own header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LinkButton, MarketingHeader, MarketingSection } from "@sdxc/ui";
import { SponsorWall } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import type { WordmarkProps } from "~/resources/components/demo-media";

import { Wordmark } from "~/resources/components/demo-media";

/** The top tier: two partners. */
const GOLD: readonly WordmarkProps[] = [
	{ name: "Northwind", glyph: "ring" },
	{ name: "Voltage", glyph: "bolt" },
];

/** The middle tier: three partners. */
const SILVER: readonly WordmarkProps[] = [
	{ name: "Layerline", glyph: "stack" },
	{ name: "Fernway", glyph: "leaf" },
	{ name: "Quadrant", glyph: "grid" },
];

/** The long tail: eight smaller sponsors. */
const BRONZE: readonly WordmarkProps[] = [
	{ name: "Halcyon", glyph: "ring" },
	{ name: "Brightline", glyph: "bolt" },
	{ name: "Strata", glyph: "stack" },
	{ name: "Mossbank", glyph: "leaf" },
	{ name: "Tessel", glyph: "grid" },
	{ name: "Orbital", glyph: "ring" },
	{ name: "Kindling", glyph: "bolt" },
	{ name: "Lattice", glyph: "grid" },
];

/** A backer's portrait as a data URI, so the cloud fetches nothing to render. */
function portrait(color: string): string {
	return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23${color}'/%3E%3Ccircle cx='4' cy='3' r='1.5' fill='%23fff'/%3E%3Cpath d='M1 8a3 3 0 0 1 6 0z' fill='%23fff'/%3E%3C/svg%3E`;
}

/** Individual backers, sized by how much they give; a few have no picture and show initials. */
const BACKERS: readonly SponsorWall.PersonProps[] = [
	{ name: "Ana Souza", href: "/examples/ana", src: portrait("6366f1"), size: "lg" },
	{ name: "Bruno Lima", href: "/examples/bruno", src: portrait("16a34a"), size: "md" },
	{ name: "Chen Wei", href: "/examples/chen", src: portrait("db2777"), size: "sm" },
	{ name: "Dana Okafor", href: "/examples/dana", size: "md" },
	{ name: "Elif Kaya", href: "/examples/elif", src: portrait("ea580c"), size: "lg" },
	{ name: "Femi Adeyemi", href: "/examples/femi", src: portrait("0891b2"), size: "sm" },
	{ name: "Greta Holm", href: "/examples/greta", size: "sm" },
	{ name: "Hiro Tanaka", href: "/examples/hiro", src: portrait("7c3aed"), size: "md" },
	{ name: "Ines Duarte", href: "/examples/ines", src: portrait("ca8a04"), size: "sm" },
	{ name: "Jonas Berg", href: "/examples/jonas", src: portrait("475569"), size: "lg" },
	{ name: "Kemal Aydın", href: "/examples/kemal", size: "sm" },
	{ name: "Lea Martin", href: "/examples/lea", src: portrait("be123c"), size: "md" },
];

/** The source the page shows, matching the markup below. */
const CODE = `<MarketingSection>
	<MarketingHeader eyebrow="Partners" align="center" description="…">
		Built with the support of these teams
	</MarketingHeader>
	<SponsorWall
		actions={
			<LinkButton href="/sponsor" color="brand" mix={[marketingCtaChrome()]}>
				Become a sponsor
			</LinkButton>
		}
	>
		<SponsorWall.Tier label="Gold partners" size="xl">
			<a href="https://northwind.com"><svg role="img" aria-label="Northwind">…</svg></a>
			<a href="https://voltage.com"><svg role="img" aria-label="Voltage">…</svg></a>
		</SponsorWall.Tier>
		<SponsorWall.Tier label="Silver partners" size="lg">{silver}</SponsorWall.Tier>
		<SponsorWall.Tier label="Sponsors" size="sm">{bronze}</SponsorWall.Tier>
		<SponsorWall.Individuals label="Individual backers">
			<SponsorWall.Person href="https://github.com/ana" name="Ana Souza" src={ana} size="lg" />
			<SponsorWall.Person href="https://github.com/dana" name="Dana Okafor" size="md" />
			…
		</SponsorWall.Individuals>
	</SponsorWall>
</MarketingSection>`;

/** What the preview registry reads: the source to show, and the band to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<MarketingSection>
			<MarketingHeader
				eyebrow="Partners"
				align="center"
				description="Keel is free and open source. These companies and people pay for the time it takes to keep it that way."
			>
				Built with the support of these teams
			</MarketingHeader>
			<SponsorWall
				actions={
					<LinkButton href="/examples/sponsor" color="brand" mix={[marketingCtaChrome()]}>
						Become a sponsor
					</LinkButton>
				}
			>
				<SponsorWall.Tier label="Gold partners" size="xl">
					{GOLD.map((mark) => (
						<a key={mark.name} href={`/examples/${mark.name.toLowerCase()}`}>
							<Wordmark name={mark.name} glyph={mark.glyph} />
						</a>
					))}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Silver partners" size="lg">
					{SILVER.map((mark) => (
						<a key={mark.name} href={`/examples/${mark.name.toLowerCase()}`}>
							<Wordmark name={mark.name} glyph={mark.glyph} />
						</a>
					))}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Sponsors" size="sm">
					{BRONZE.map((mark) => (
						<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
					))}
				</SponsorWall.Tier>
				<SponsorWall.Individuals label="Individual backers">
					{BACKERS.map((backer) => (
						<SponsorWall.Person key={backer.name} {...backer} />
					))}
				</SponsorWall.Individuals>
			</SponsorWall>
		</MarketingSection>
	),
};
