/**
 * View for the public `/sponsors` page: why sponsoring helps, every way to do it, then the
 * people who sponsor now, drawn large and named, and those who did before, as a wall of
 * small avatars. Each list draws only when it names someone, and none is ever invented.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { basis, flexWrap, gap, grid, grow, hstack, shrink } from "@sdxc/u/layout";
import { m, maxIs, minIs, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Card, Heading, Link, LinkButton } from "@sdxc/ui";
import { SponsorWall } from "@sdxc/ui/landing";

import type { Sponsor, SponsorRoster } from "~/app/services/sponsors";

import { PROFILE } from "~/config/profile";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/** The amounts a one-off PayPal tip is offered at, in US dollars. */
const TIP_AMOUNTS = [5, 10, 20];

/**
 * Creates a renderer for the sponsors page.
 *
 * @returns View function that renders the pitch and the stored roster.
 */
export function SponsorsView() {
	return ({ model, assets }: { model: SponsorRoster; assets: DocumentAssets }) => (
		<BlogLayout
			assets={assets}
			title="Sponsors"
			description="Sponsor my articles, tutorials and open-source work, and meet the people who already do."
			activePath={routes.sponsors.href()}
		>
			<main mix={[grid(), gap(8)]}>
				<header mix={[grid(), gap(4)]}>
					<Heading level={1} mix={[text("3xl")]}>
						Sponsors
					</Heading>
					<p mix={[m(0), maxIs("60ch"), text("lg"), fg("neutral")]}>
						I write the articles and tutorials here and maintain open-source libraries around React
						Router, Remix and OAuth2, these days alongside AI coding agents. Sponsoring pays for the
						hours and the tokens that work takes, and keeps all of it free to read and use.
					</p>
				</header>

				<Card
					color="brand"
					mix={[p(4), hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}
				>
					<div mix={[minIs(0), grow(1), shrink(1), basis("30rem")]}>
						<p mix={[m(0), fg("brand.emphasis"), text("base"), weight("bold")]}>
							Become a monthly sponsor
						</p>
						<p mix={[m(0), fg("brand"), text("base")]}>
							GitHub Sponsors takes any monthly amount, and every one of them adds up.
						</p>
					</div>
					<LinkButton
						href={PROFILE.github.sponsor}
						color="brand"
						size="lg"
						mix={[shrink(0), weight("bold")]}
					>
						Sponsor me on GitHub
					</LinkButton>
				</Card>

				<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
					Rather give once? Send{" "}
					{TIP_AMOUNTS.map((amount, index) => {
						let separator = iife(() => {
							if (index === 0) return "";
							if (index === TIP_AMOUNTS.length - 1) return " or ";
							return ", ";
						});
						return (
							<>
								{separator}
								<Link href={`${PROFILE.paypal.profile}/${amount}USD`}>${amount}</Link>
							</>
						);
					})}{" "}
					through PayPal, or any amount on <Link href={PROFILE.kofi.profile}>Ko-fi</Link>.
				</p>

				<SponsorLists roster={model} />
			</main>
		</BlogLayout>
	);
}

namespace SponsorLists {
	export interface Props {
		roster: SponsorRoster;
	}
}

/**
 * Renders the current sponsors, large and named, then the past ones as a wall of small
 * avatars, each list only while it names someone. The ways to join close whichever list
 * comes last, so the page ends on them.
 */
export function SponsorLists(handle: Handle<SponsorLists.Props>) {
	return () => {
		let { roster } = handle.props;

		return (
			<>
				{roster.current.length > 0 ? (
					<section id="current" mix={[grid(), gap(4)]}>
						<Heading level={2} mix={[text("2xl")]}>
							Current sponsors
						</Heading>
						<Roster
							sponsors={roster.current}
							named
							actions={roster.past.length > 0 ? null : <JoinActions />}
						/>
					</section>
				) : null}

				{roster.past.length > 0 ? (
					<section id="past" mix={[grid(), gap(4)]}>
						<Heading level={2} mix={[text("2xl")]}>
							Past sponsors
						</Heading>
						<p mix={[m(0), fg("neutral")]}>Thank you to everyone who sponsored before.</p>
						<Roster sponsors={roster.past} actions={<JoinActions />} />
					</section>
				) : null}
			</>
		);
	};
}

namespace Roster {
	export interface Props {
		sponsors: Sponsor[];
		/** Draws each sponsor large with their name under the picture, for the people sponsoring now. */
		named?: boolean;
		/** The ways to join, closing the wall; the page passes them to its last list only. */
		actions?: RemixNode;
	}
}

/**
 * Renders one list as a sponsor wall set on the column's start edge, the way the rest of
 * the page reads. Every circle links the sponsor's GitHub profile and is named for
 * assistive technology; a picture that fails shows the sponsor's initials.
 */
function Roster(handle: Handle<Roster.Props>) {
	return () => {
		let { actions, named, sponsors } = handle.props;

		return (
			<SponsorWall align="start" actions={actions ?? undefined}>
				<SponsorWall.Individuals>
					{sponsors.map((sponsor) => (
						<SponsorWall.Person
							key={sponsor.login}
							href={sponsor.url}
							name={sponsor.name}
							src={sponsor.avatarUrl}
							size={named ? "lg" : undefined}
							showName={named}
							rel="noreferrer"
						/>
					))}
				</SponsorWall.Individuals>
			</SponsorWall>
		);
	};
}

/** The two ongoing and one-off ways to join the list, closing the page's last wall. */
function JoinActions() {
	return () => (
		<>
			<LinkButton href={PROFILE.github.sponsor} color="brand">
				Sponsor me on GitHub
			</LinkButton>
			<LinkButton href={PROFILE.kofi.profile} variant="outline" color="neutral">
				Give once on Ko-fi
			</LinkButton>
		</>
	);
}
