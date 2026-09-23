/**
 * `GET /showcase` — the applications these packages are built and proven in. The list
 * is curated rather than exhaustive: an app reaching for a handful of packages proves
 * nothing about them, and the same five are the ones a package page names as its
 * users, so the two surfaces never disagree about how many there are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { flexWrap, gap, grid, gridTemplate, hstack, repeat, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, maxIs, p } from "@sdxc/u/size";
import { font, nowrap, text, tracking, weight } from "@sdxc/u/typography";
import { Badge, Card, LinkButton } from "@sdxc/ui";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { listShowcase } from "~/app/services/showcase";
import SiteHeader from "~/resources/components/site-header";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one-sentence summary search results and link previews show. */
const DESCRIPTION =
	"Five applications built on these packages, each with the number of them it installs, read from its own manifest.";

/** What the page argues, which is Rails' framing rather than a logo wall's. */
const INTRODUCTION =
	"These are reference applications rather than customers: five things that run on the collection, listed with what reading each one is worth and how deep into the set it goes. Two of them have no deployment, and say so.";

export default createAction(routes.showcase, async (ctx) => {
	let applications = listShowcase();

	let response = await ctx.render(
		<DocumentLayout
			title="Showcase — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
			sponsors={ctx.sponsors}
		>
			<SiteHeader activePath={routes.showcase.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				<div
					mix={[
						vstack({ gap: 8 }),
						is("100%"),
						maxIs("64rem"),
						p(12, 5),
						media("(min-width: 48rem)", p(16, 5)),
					]}
				>
					<header mix={[vstack({ gap: 3 })]}>
						<h1 mix={[m(0), text("4xl"), weight("bold"), tracking("tight")]}>
							Built on these packages
						</h1>
						<p mix={[m(0), text("lg"), fg("neutral")]}>{INTRODUCTION}</p>
					</header>

					<div
						mix={[
							grid(),
							gap(4),
							is("100%"),
							gridTemplate({ columns: "1fr" }),
							media(
								"(min-width: 48rem)",
								gridTemplate({ columns: repeat("auto-fit", "minmax(20rem, 1fr)") }),
							),
						]}
					>
						{applications.map((application) => (
							<Card key={application.directory}>
								<Card.Header>
									<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
										<Card.Title mix={[font("mono"), text("lg"), nowrap()]}>
											{application.title}
										</Card.Title>
										<Badge color="brand">{application.packageCount} packages</Badge>
										{application.href === null ? <Badge color="neutral">Source only</Badge> : null}
									</div>
									<Card.Description>{application.summary}</Card.Description>
								</Card.Header>

								<Card.Content mix={[text("sm"), fg("neutral")]}>{application.study}</Card.Content>

								<Card.Footer mix={[hstack({ gap: 3, align: "center" })]}>
									{application.href ? (
										<LinkButton href={application.href} rel="noreferrer" size="sm">
											Open it
										</LinkButton>
									) : null}
									<LinkButton
										href={application.sourceHref}
										rel="noreferrer"
										variant="outline"
										color="neutral"
										size="sm"
									>
										Read the source
									</LinkButton>
								</Card.Footer>
							</Card>
						))}
					</div>

					<p mix={[m(0), text("sm"), fg("neutral")]}>
						Each count is that application&apos;s <code mix={[font("mono")]}>@sdxc/*</code>{" "}
						dependencies, read from its own <code mix={[font("mono")]}>package.json</code>. Every
						package&apos;s reference page names which of these five install it, read from the same
						files.
					</p>
				</div>
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});
