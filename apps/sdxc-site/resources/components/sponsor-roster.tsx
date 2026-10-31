/**
 * The sponsors page's two lists: who funds the work now, named in a window beside the
 * pitch, and who funded it before, as a wall of avatars that closes the page with the
 * ways to join them. Both read the stored roster, so every name is a real sponsorship.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixOptions } from "@sdxc/markdown/remix";
import type { Handle } from "remix/component";

import { HeartIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";
import { Avatar, LinkButton } from "@sdxc/ui";
import { SponsorWall } from "@sdxc/ui/patterns";

import type { Sponsor, SponsorRoster } from "~/app/services/sponsors";
import type { MarkdownProps } from "~/resources/components/markdown-props";

import { SPONSORED_LOGIN } from "~/app/services/sponsors";
import FramedPanel, { FRAMED_PANEL_CONTAINER } from "~/resources/components/framed-panel";
import SectionBlock from "~/resources/components/section-block";

/** The GitHub Sponsors profile the sponsorships are taken through. */
const SPONSOR_PROFILE_HREF = `https://github.com/sponsors/${SPONSORED_LOGIN}`;

/** The ruling between roster rows, the hairline every marketing surface uses. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** How many empty seats the window draws while nobody sponsors the work publicly. */
const EMPTY_SEATS = 5;

namespace CurrentSponsors {
	export interface Props {
		roster: SponsorRoster;
	}
}

/**
 * Renders the window of current sponsors: one ruled row per sponsor with their picture
 * and name, two to a row once the window is wide enough. An odd last row spans both
 * columns, so the ruling never leaves an empty cell. With nobody listed, the window
 * says where a first sponsor will appear instead.
 */
function CurrentSponsors(handle: Handle<CurrentSponsors.Props>) {
	return () => {
		let { current, past } = handle.props.roster;

		if (current.length === 0) {
			return (
				<FramedPanel title="github.com/sponsors/sergiodxa" label="GitHub Sponsors">
					<div mix={[vstack({ gap: 4, align: "start" }), p(6, 4)]}>
						<ul
							aria-hidden="true"
							mix={[hstack({ gap: 2, align: "center" }), m(0), p(0), raw({ listStyle: "none" })]}
						>
							{Array.from({ length: EMPTY_SEATS }, (_, index) => (
								<li
									key={index}
									mix={[
										raw({
											inlineSize: "2.5rem",
											blockSize: "2.5rem",
											borderRadius: "9999px",
											border: "1px dashed color-mix(in oklch, CanvasText 24%, transparent)",
										}),
									]}
								/>
							))}
						</ul>
						<p mix={[m(0), text("sm"), leading("relaxed"), fg("neutral")]}>
							Public sponsorships are listed here as soon as someone makes one.
						</p>
					</div>
				</FramedPanel>
			);
		}

		return (
			<FramedPanel
				title="Current sponsors"
				meta={String(current.length)}
				footer={
					past.length > 0 ? (
						<a href="#past" mix={[fg("neutral"), raw({ textUnderlineOffset: "0.2em" })]}>
							And {past.length} past sponsors, below
						</a>
					) : (
						"Listed from GitHub Sponsors"
					)
				}
			>
				<ul
					mix={[
						m(0),
						p(0),
						raw({
							listStyle: "none",
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							marginBlockEnd: "-1px",
						}),
						when("& > li", raw({ boxShadow: `0 1px 0 ${HAIRLINE}`, minInlineSize: 0 })),
						at("md", FRAMED_PANEL_CONTAINER, [
							raw({ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }),
							when(
								"& > li:nth-child(odd):not(:last-child)",
								raw({ boxShadow: `1px 0 0 ${HAIRLINE}, 0 1px 0 ${HAIRLINE}` }),
							),
							when("& > li:nth-child(odd):last-child", raw({ gridColumn: "1 / -1" })),
						]),
					]}
				>
					{current.map((sponsor) => (
						<li key={sponsor.login}>
							<a
								href={sponsor.url}
								rel="noreferrer"
								mix={[
									hstack({ gap: 3, align: "center" }),
									raw({
										boxSizing: "border-box",
										minBlockSize: "3.5rem",
										paddingInline: "1rem",
										paddingBlock: "0.75rem",
										textDecoration: "none",
										outlineOffset: "-2px",
									}),
									text("sm"),
									weight("medium"),
									fg("neutral.emphasis"),
									when(
										"&:hover",
										raw({ backgroundColor: "color-mix(in oklch, CanvasText 3%, transparent)" }),
									),
								]}
							>
								<SponsorAvatar sponsor={sponsor} />
								<span
									mix={[
										raw({
											minInlineSize: 0,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}),
									]}
								>
									{sponsor.name}
								</span>
							</a>
						</li>
					))}
				</ul>
			</FramedPanel>
		);
	};
}

namespace SponsorAvatar {
	export interface Props {
		sponsor: Sponsor;
	}
}

/**
 * Renders one sponsor's picture, falling back to their initials while it loads or when it
 * fails. The picture is decorative beside the name, so its text alternative is empty.
 */
function SponsorAvatar(handle: Handle<SponsorAvatar.Props>) {
	return () => {
		let { sponsor } = handle.props;

		return (
			<Avatar size="sm" mix={[raw({ flexShrink: 0 })]}>
				<Avatar.Image src={sponsor.avatarUrl} alt="" loading="lazy" />
				<Avatar.Fallback>{sponsor.name.trim().slice(0, 2).toUpperCase()}</Avatar.Fallback>
			</Avatar>
		);
	};
}

namespace PastSponsors {
	export interface Props {
		sponsors: Sponsor[];
	}
}

/**
 * Renders everyone who funded the work before as a centred wall of avatars, each named
 * for assistive technology and as a tooltip, then the ways to join the current list.
 * Draws nothing while the list is empty, so the page closes on the band above it.
 */
export function PastSponsors(handle: Handle<PastSponsors.Props>) {
	return () => {
		let { sponsors } = handle.props;
		if (sponsors.length === 0) return null;

		return (
			<SectionBlock id="past" eyebrow="Thank you too" title="Past sponsors" align="center">
				<p>
					{sponsors.length} people and teams have funded this work before. It would not be here
					without them.
				</p>

				<SponsorWall
					mix={[is("100%"), raw({ marginBlockStart: "1rem" })]}
					actions={
						<>
							<LinkButton href={SPONSOR_PROFILE_HREF} color="brand" rel="noreferrer">
								<HeartIcon size={16} aria-hidden="true" />
								Sponsor on GitHub
							</LinkButton>
							<LinkButton
								href="https://ko-fi.com/sergiodxa"
								variant="outline"
								color="neutral"
								rel="noreferrer"
							>
								Give once on Ko-fi
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
								size="sm"
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
 * The `current-sponsors` tag as the sponsors page draws it, bound to one request's roster:
 * the window of current sponsors that sits beside the page's pitch.
 *
 * @param roster The stored roster, current and past.
 * @returns The tag's component, to spread over the page's component map.
 */
export function sponsorRosterTags(roster: SponsorRoster): NonNullable<RemixOptions["components"]> {
	return {
		"current-sponsors": function CurrentSponsorsTag(_handle: Handle<MarkdownProps>) {
			return () => <CurrentSponsors roster={roster} />;
		},
	};
}
