/**
 * The people funding this work, named with their avatar and their profile. The
 * sponsorships are the author's rather than the collection's — they predate the npm
 * scope — so the heading says whose work is funded and the block carries no tiers, no
 * perks and no sizes: everyone here is on the same row.
 *
 * With nobody to name the block draws nothing at all, which is what keeps a page
 * whose sponsor list could not be read from showing an empty heading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { HeartIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { flexWrap, hstack, inlineFlex, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { text, tracking, weight } from "@sdxc/u/typography";
import { Avatar } from "@sdxc/ui";

import type { Sponsor } from "~/app/services/sponsors";

import { SPONSOR_HREF } from "~/app/services/sponsors";

/** What the block is titled, everywhere it appears. */
const HEADING = "People who fund this work";

namespace Sponsors {
	export interface Props {
		sponsors: Sponsor[];
	}
}

/** The initials an avatar falls back to while its image loads or fails. */
function initials(name: string): string {
	return name.trim().slice(0, 2).toUpperCase();
}

/** Renders the named sponsors, or nothing when there are none. */
export default function Sponsors(handle: Handle<Sponsors.Props>) {
	return () => {
		let { sponsors } = handle.props;
		if (sponsors.length === 0) return null;

		return (
			<section mix={[vstack({ gap: 4 })]}>
				<h2 mix={[m(0), text("lg"), weight("semibold"), tracking("tight")]}>{HEADING}</h2>

				<ul mix={[hstack({ gap: 4, align: "center" }), flexWrap(), m(0), p(0), listStyle("none")]}>
					{sponsors.map((sponsor) => (
						<li key={sponsor.login}>
							<a
								href={sponsor.url}
								rel="noreferrer"
								mix={[hstack({ gap: 2, align: "center" }), text("sm"), fg("neutral")]}
							>
								<Avatar size="sm">
									<Avatar.Image src={sponsor.avatarUrl} alt="" />
									<Avatar.Fallback>{initials(sponsor.name)}</Avatar.Fallback>
								</Avatar>
								{sponsor.name}
							</a>
						</li>
					))}
				</ul>

				<a
					href={SPONSOR_HREF}
					rel="noreferrer"
					mix={[hstack({ gap: 2, align: "center" }), text("sm"), weight("medium"), fg("brand")]}
				>
					<span mix={[inlineFlex()]}>
						<HeartIcon size={16} />
					</span>
					Sponsor this work
				</a>
			</section>
		);
	};
}
