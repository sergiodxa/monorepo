/**
 * `GET /docs/releases/changelog` — one entry per dated release, newest first, with the
 * notes it went out with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatDate } from "@sdxc/dates";
import { toRemix } from "@sdxc/markdown/remix";
import { MicroTime, mf } from "@sdxc/microformats/ui";
import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, tracking, weight } from "@sdxc/u/typography";
import { Separator, Typeset } from "@sdxc/ui";
import { Callout, DocsPageHeader } from "@sdxc/ui/docs";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";

import { siteCache } from "~/app/initializers/cache";
import { pageSchema, seo, trailSchema } from "~/app/initializers/seo";
import { parseNotes, readChangelog } from "~/app/services/changelog";
import { buildGuidesNav } from "~/app/services/navigation";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { DOCS_COMPONENTS } from "~/resources/components/markdown-components";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const TITLE = "Changelog";

const DESCRIPTION = "Every dated release of the collection, newest first, with its notes.";

/** Release dates are stated in the zone the version scheme names its day in. */
const TIME_ZONE = "UTC";

/** Where the releases are read, which is where a reader goes when this page has none. */
const RELEASES_HREF = "https://github.com/sergiodxa/monorepo/releases";

export default createAction(routes.docs.changelog, async (ctx) => {
	let tree = await buildGuidesNav();
	let cache = siteCache();
	let releases = await readChangelog(cache);

	/** The rail lists the dates alone: a release's own headings belong to its notes. */
	let anchors: Anchor[] = releases.map((release) => ({
		id: release.version,
		text: release.version,
		level: 2,
	}));

	let activePath = routes.docs.changelog.href();
	let canonical = seo.canonical(ctx.url);

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${TITLE} — sdxc`}
			description={DESCRIPTION}
			canonical={ctx.url.href}
			schema={[
				pageSchema({
					name: TITLE,
					description: DESCRIPTION,
					url: canonical,
					cardTitle: `${TITLE} — sdxc`,
				}),
				trailSchema([{ name: "Documentation", url: routes.docs.index.href() }], {
					name: TITLE,
					url: canonical,
				}),
			]}
			siteFooter={false}
		>
			<DocsLayout
				tree={tree}
				filterQuery={ctx.url.searchParams.get("filter")}
				activePath={activePath}
				anchors={anchors}
				feedback={{ sent: isFeedbackSent(ctx.url) }}
			>
				<article mix={[mf("h-feed")]}>
					<header mix={[vstack({ gap: 3 })]}>
						<DocsPageHeader
							crumbs={[
								{ label: "Documentation", href: routes.docs.index.href() },
								{ label: "Releases" },
								{ label: TITLE },
							]}
							title={<span mix={[mf("p-name")]}>{TITLE}</span>}
							description={DESCRIPTION}
						/>
					</header>

					{releases.length === 0 ? (
						<div mix={[m("2.5rem", 0, 0, 0)]}>
							<Callout kind="note" label="Note">
								<p mix={[m(0)]}>
									The releases could not be read just now. Every one of them is published in full{" "}
									<a href={RELEASES_HREF} mix={[fg("brand")]} rel="noreferrer">
										on GitHub
									</a>
									, and this page fills in again as soon as the call answers.
								</p>
							</Callout>
						</div>
					) : (
						<div mix={[vstack({ gap: 10 }), m("2.5rem", 0, 0, 0)]}>
							{releases.map((release, index) => {
								let notes = parseNotes(release.notes);
								let publishedAt = new Date(release.publishedAt);

								return (
									<section key={release.version} mix={[mf("h-entry"), vstack({ gap: 4 })]}>
										{index > 0 ? <Separator /> : null}

										<div mix={[vstack({ gap: 1 })]}>
											<h2
												id={release.version}
												mix={[
													mf("p-name"),
													m(0),
													font("mono"),
													text("2xl"),
													weight("bold"),
													tracking("tight"),
												]}
											>
												{release.version}
											</h2>

											<div mix={[hstack({ gap: 3, align: "center" }), text("sm")]}>
												<span mix={[fg("neutral.muted")]}>
													<MicroTime property="dt-published" value={publishedAt}>
														{formatDate(publishedAt, {
															locale: "en-US",
															timeZone: TIME_ZONE,
															dateStyle: "long",
														})}
													</MicroTime>
												</span>
												<a
													href={release.href}
													mix={[mf("u-url", "u-uid"), fg("brand")]}
													rel="noreferrer"
												>
													On GitHub
												</a>
											</div>
										</div>

										<div mix={[mf("e-content")]}>
											{notes ? (
												<Typeset preset="docs">
													{toRemix(notes, { components: DOCS_COMPONENTS })}
												</Typeset>
											) : (
												<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
													This release went out with no notes.
												</p>
											)}
										</div>
									</section>
								);
							})}
						</div>
					)}
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return response;
});
