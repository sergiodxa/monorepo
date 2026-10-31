/**
 * `GET /showcase` — the applications these packages are built and proven in. The list
 * is curated rather than exhaustive: an app reaching for a handful of packages proves
 * nothing about them, and the same set is what a package page names as its users.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, m, maxIs } from "@sdxc/u/size";
import { font, leading, text } from "@sdxc/u/typography";
import { Feature } from "@sdxc/ui";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { readPackageFacts } from "~/app/services/packages";
import { listShowcase } from "~/app/services/showcase";
import Actions from "~/resources/components/actions";
import Hero from "~/resources/components/hero";
import { ProseHeading, ProseParagraph } from "~/resources/components/prose";
import SectionBlock from "~/resources/components/section-block";
import { ShowcaseCard, ShowcaseDepth } from "~/resources/components/showcase";
import SiteHeader from "~/resources/components/site-header";
import Split, { SplitCopy, SplitMedia } from "~/resources/components/split";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Where every application's source is read from. */
const APPS_SOURCE_HREF = "https://github.com/sergiodxa/monorepo/tree/main/apps";

/** Cardinal words for the curated count, so the prose stays exact as the list grows. */
const CARDINALS = [
	"zero",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"ten",
] as const;

/**
 * The page's one-sentence summary and intro, written from the live list so a new
 * application or a newly shipped URL moves the prose with the cards.
 */
function showcaseCopy(applications: ReturnType<typeof listShowcase>): {
	description: string;
	introduction: string;
} {
	let count = applications.length;
	let cardinal = CARDINALS[count] ?? String(count);
	let sourceOnly = applications.filter((application) => application.href === null).length;
	let sourceOnlyCardinal = CARDINALS[sourceOnly] ?? String(sourceOnly);
	let sourceOnlyClause = "Every one of them is running somewhere a reader can open.";
	if (sourceOnly === 1) {
		sourceOnlyClause = "One of them has no deployment, and says so.";
	} else if (sourceOnly > 1) {
		sourceOnlyClause = `${sourceOnlyCardinal.charAt(0).toUpperCase()}${sourceOnlyCardinal.slice(1)} of them have no deployment, and say so.`;
	}

	return {
		description: `${cardinal.charAt(0).toUpperCase()}${cardinal.slice(1)} applications built on these packages, each with the number of them it installs, read from its own manifest.`,
		introduction: `These are reference applications rather than customers: ${cardinal} things that run on the collection, listed with what reading each one is worth and how deep into the set it goes. ${sourceOnlyClause}`,
	};
}

export default createAction(routes.showcase, async (ctx) => {
	let applications = listShowcase();
	let { description, introduction } = showcaseCopy(applications);
	let { published } = readPackageFacts();

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Showcase — sdxc"
			description={description}
			canonical={ctx.url.href}
		>
			<SiteHeader activePath={routes.showcase.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				<Hero>
					<Split>
						<SplitCopy>
							<ProseHeading level={1}>Built on these packages</ProseHeading>
							<ProseParagraph>{introduction}</ProseParagraph>
							<Actions
								cta-href="#applications"
								cta-label="See the applications"
								alt-href={APPS_SOURCE_HREF}
								alt-label="Read the source"
							>
								{null}
							</Actions>
						</SplitCopy>
						<SplitMedia>
							<ShowcaseDepth applications={applications} published={published} />
						</SplitMedia>
					</Split>
				</Hero>

				<SectionBlock
					id="applications"
					eyebrow="Applications"
					title="What each one is worth reading for"
					tone="tinted"
				>
					<Feature.Grid columns={2}>
						{applications.map((application) => (
							<ShowcaseCard key={application.directory} application={application} />
						))}
					</Feature.Grid>

					<p mix={[m(0), maxIs("48rem"), text("sm"), leading("relaxed"), fg("neutral")]}>
						Each count is that application&apos;s <code mix={[font("mono")]}>@sdxc/*</code>{" "}
						dependencies, read from its own <code mix={[font("mono")]}>package.json</code>. Every
						package&apos;s reference page names which of these install it, read from the same files.
					</p>
				</SectionBlock>

				<SectionBlock id="build" title="Build your own." tone="grid" align="center">
					<p>Every one of these started with one package. Start yours the same way.</p>

					<Actions
						cta-href="/docs/getting-started/install-and-pin"
						cta-label="Install your first package"
						alt-href={routes.api.index.href()}
						alt-label="Browse the API"
					>
						{null}
					</Actions>
				</SectionBlock>
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
