/**
 * `GET /sponsors` — the case for funding the work, then the people who do and who did.
 * Current sponsors are drawn large and named; past ones as a wall of small avatars, the
 * way a sponsor's own profile lists them. Each list draws only when it names someone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { textAlign, text, weight } from "@sdxc/u/typography";
import { Avatar } from "@sdxc/ui";
import { createAction } from "remix/router";

import type { Sponsor } from "~/app/services/sponsors";

import { withBundleCache } from "~/app/http/caching";
import { siteCache } from "~/app/services/cache";
import { readContent } from "~/app/services/content";
import { readStoredSponsors, sponsorsTag } from "~/app/services/sponsors";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import SectionBlock from "~/resources/components/section-block";
import SiteHeader from "~/resources/components/site-header";
import source from "~/resources/content/sponsors.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one-sentence summary search results and link previews show. */
const DESCRIPTION =
	"Sponsor the packages, guides and releases of sdxc on GitHub, and meet the people who fund the work.";

export default createAction(routes.sponsors, async (ctx) => {
	let content = readContent(source);

	if (isFailure(content)) {
		ctx.log.fail(content.error, { line: content.error.position?.start.line ?? null });
		throw content.error;
	}

	let roster = await readStoredSponsors(siteCache());

	let response = await ctx.render(
		<DocumentLayout title="Sponsors — sdxc" description={DESCRIPTION} canonical={ctx.url.href}>
			<SiteHeader activePath={routes.sponsors.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(content.data, { components: LANDING_COMPONENTS })}

				{roster.current.length > 0 ? (
					<SectionBlock id="current" eyebrow="Thank you" title="Current sponsors" tone="tinted">
						<ul
							mix={[
								grid(),
								gap(8),
								gridTemplate({ columns: "repeat(auto-fill, minmax(8rem, 1fr))" }),
								m(0),
								p(0),
								listStyle("none"),
							]}
						>
							{roster.current.map((sponsor) => (
								<li key={sponsor.login}>
									<a
										href={sponsor.url}
										rel="noreferrer"
										mix={[
											vstack({ gap: 3, align: "center" }),
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
					</SectionBlock>
				) : null}

				{roster.past.length > 0 ? (
					<SectionBlock id="past" eyebrow="Thank you too" title="Past sponsors">
						<ul
							mix={[hstack({ gap: 2, align: "center" }), flexWrap(), m(0), p(0), listStyle("none")]}
						>
							{roster.past.map((sponsor) => (
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
					</SectionBlock>
				) : null}
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(roster));
});

namespace SponsorAvatar {
	export interface Props {
		sponsor: Sponsor;
		/** Draws the picture at the size a current sponsor is named with. */
		large?: boolean;
	}
}

/**
 * Renders one sponsor's picture, falling back to their initials while it loads or when it
 * fails. The picture is decorative beside the name, so its text alternative is empty.
 */
function SponsorAvatar(handle: Handle<SponsorAvatar.Props>) {
	return () => {
		let { large, sponsor } = handle.props;

		return (
			<Avatar
				size={large ? "lg" : "md"}
				mix={large ? [raw({ "--ui-image-placeholder-size-lg": "5rem", fontSize: "1.25rem" })] : []}
			>
				<Avatar.Image src={sponsor.avatarUrl} alt="" loading="lazy" />
				<Avatar.Fallback>{sponsor.name.trim().slice(0, 2).toUpperCase()}</Avatar.Fallback>
			</Avatar>
		);
	};
}
