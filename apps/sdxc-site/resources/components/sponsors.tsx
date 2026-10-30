/**
 * The people funding this work, as a wall of their GitHub avatars, and the links to join
 * them: the page that makes the case for it and the sponsorship profile itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixOptions } from "@sdxc/markdown/remix";
import type { Handle } from "remix/component";

import { HeartIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { is } from "@sdxc/u/size";
import { LinkButton } from "@sdxc/ui";
import { SponsorWall } from "@sdxc/ui/patterns";

import type { Sponsor } from "~/app/services/sponsors";
import type { MarkdownProps } from "~/resources/components/markdown-props";

import { SPONSORED_LOGIN } from "~/app/services/sponsors";
import SectionBlock from "~/resources/components/section-block";
import routes from "~/routes/web";

/** The GitHub Sponsors profile the sponsorships are taken through. */
const SPONSOR_PROFILE_HREF = `https://github.com/sponsors/${SPONSORED_LOGIN}`;

/** What the block is titled, everywhere it appears. */
const HEADING = "People who fund this work";

namespace Sponsors {
	export interface Props {
		sponsors: Sponsor[];
	}
}

/**
 * Renders the current sponsors as a wall of their GitHub avatars, then the ways to join
 * them. Every circle is a real sponsor's profile, so the wall claims no tier nobody has
 * taken, and it renders nothing while nobody funds the work.
 */
export default function Sponsors(handle: Handle<Sponsors.Props>) {
	return () => {
		let { sponsors } = handle.props;
		if (sponsors.length === 0) return null;

		return (
			<SectionBlock id="sponsors" eyebrow="Sponsors" title={HEADING} align="center">
				<p>
					The collection is written and maintained in the open, funded through GitHub Sponsors by
					the people and teams below.
				</p>

				<SponsorWall
					mix={[is("100%"), raw({ marginBlockStart: "1rem" })]}
					actions={
						<>
							<LinkButton href={routes.sponsors.href()} color="brand">
								<HeartIcon size={16} aria-hidden="true" />
								Sponsor this work
							</LinkButton>
							<LinkButton href={SPONSOR_PROFILE_HREF} variant="outline" color="neutral">
								GitHub Sponsors
							</LinkButton>
						</>
					}
				>
					<SponsorWall.Individuals>
						{sponsors.map((sponsor) => (
							<SponsorWall.Person
								key={sponsor.login}
								href={sponsor.url}
								name={sponsor.name}
								src={sponsor.avatarUrl}
								size="lg"
								rel="noreferrer"
							/>
						))}
					</SponsorWall.Individuals>
				</SponsorWall>
			</SectionBlock>
		);
	};
}

/**
 * The `current-sponsors` tag for one request, bound to the sponsors it names, so a content
 * file decides where on the page the band sits. The band draws nothing while the list is
 * empty, so the page closes up around it.
 *
 * @param sponsors The current sponsors, from the stored roster.
 * @returns The tag's component, to spread over the page's component map.
 */
export function sponsorTags(sponsors: Sponsor[]): NonNullable<RemixOptions["components"]> {
	return {
		"current-sponsors": function CurrentSponsors(_handle: Handle<MarkdownProps>) {
			return () => <Sponsors sponsors={sponsors} />;
		},
	};
}
