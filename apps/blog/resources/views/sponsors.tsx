/**
 * View for the public `/sponsors` page: why sponsoring helps, every way to do it, then the
 * people who sponsor now, drawn large and named, and those who did before, as a wall of
 * small avatars. Each list draws only when it names someone, and none is ever invented.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vars } from "@sdxc/u/general";
import { listStyle } from "@sdxc/u/general";
import {
	basis,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	grow,
	hstack,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { m, maxIs, minIs, p } from "@sdxc/u/size";
import { spacing } from "@sdxc/u/tokens";
import { textAlign, text, weight } from "@sdxc/u/typography";
import { Avatar, Card, Heading, Link, LinkButton } from "@sdxc/ui";

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
	return ({ model }: { model: SponsorRoster }) => (
		<BlogLayout
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
					{TIP_AMOUNTS.map((amount, index) => (
						<>
							{index === 0 ? "" : index === TIP_AMOUNTS.length - 1 ? " or " : ", "}
							<Link href={`${PROFILE.paypal.profile}/${amount}USD`}>${amount}</Link>
						</>
					))}{" "}
					through PayPal, or any amount on <Link href={PROFILE.kofi.profile}>Ko-fi</Link>.
				</p>

				{model.current.length > 0 ? (
					<section id="current" mix={[grid(), gap(4)]}>
						<Heading level={2} mix={[text("2xl")]}>
							Current sponsors
						</Heading>
						<ul
							mix={[
								grid(),
								gap(6),
								gridTemplate({ columns: `repeat(auto-fill, minmax(${spacing(32)}, 1fr))` }),
								m(0),
								p(0),
								listStyle("none"),
							]}
						>
							{model.current.map((sponsor) => (
								<li key={sponsor.login}>
									<a
										href={sponsor.url}
										rel="noreferrer"
										mix={[
											vstack({ gap: 2, align: "center" }),
											textAlign("center"),
											text("sm"),
											weight("medium"),
											fg("neutral.emphasis"),
										]}
									>
										<SponsorAvatar sponsor={sponsor} large />
										{sponsor.name}
									</a>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{model.past.length > 0 ? (
					<section id="past" mix={[grid(), gap(4)]}>
						<Heading level={2} mix={[text("2xl")]}>
							Past sponsors
						</Heading>
						<p mix={[m(0), fg("neutral")]}>Thank you to everyone who sponsored before.</p>
						<ul
							mix={[
								hstack({ gap: 2, align: "center" }),
								flexWrap("wrap"),
								m(0),
								p(0),
								listStyle("none"),
							]}
						>
							{model.past.map((sponsor) => (
								<li key={sponsor.login}>
									<a
										href={sponsor.url}
										rel="noreferrer"
										title={sponsor.name}
										aria-label={sponsor.name}
									>
										<SponsorAvatar sponsor={sponsor} />
									</a>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</main>
		</BlogLayout>
	);
}

namespace SponsorAvatar {
	export interface Props {
		sponsor: Sponsor;
		/** Draws the picture at the size a current sponsor is named with. */
		large?: boolean;
	}
}

/**
 * Renders one sponsor's picture, falling back to their initials while it loads or when it
 * fails. The picture sits beside the name or a label, so its text alternative is empty.
 */
function SponsorAvatar(handle: Handle<SponsorAvatar.Props>) {
	return () => {
		let { large, sponsor } = handle.props;

		return (
			<Avatar
				size={large ? "lg" : "md"}
				mix={large ? [vars({ "ui-image-placeholder-size-lg": spacing(20) }), text("xl")] : []}
			>
				<Avatar.Image src={sponsor.avatarUrl} alt="" loading="lazy" />
				<Avatar.Fallback>{sponsor.name.trim().slice(0, 2).toUpperCase()}</Avatar.Fallback>
			</Avatar>
		);
	};
}
