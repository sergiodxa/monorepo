/**
 * `GET /docs/releases/changelog` — one entry per dated release, newest first, with the
 * notes it went out with. It sits beside the versioning guide because it is what that
 * guide describes actually happening, and it is the one documentation page whose
 * content is fetched rather than read out of the bundle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatDate } from "@sdxc/dates";
import { toRemix } from "@sdxc/markdown/remix";
import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, tracking, weight } from "@sdxc/u/typography";
import { Separator, Typeset } from "@sdxc/ui";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";

import { siteCache } from "~/app/services/cache";
import { parseNotes, readChangelog } from "~/app/services/changelog";
import { buildNavTree } from "~/app/services/navigation";
import { DOCS_COMPONENTS } from "~/resources/components/markdown-components";
import Note from "~/resources/components/note";
import { TableOfContents } from "~/resources/components/table-of-contents";
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
	let tree = await buildNavTree();
	let cache = siteCache();
	let releases = await readChangelog(cache);

	/** The rail lists the dates alone: a release's own headings belong to its notes. */
	let anchors: Anchor[] = releases.map((release) => ({
		id: release.version,
		text: release.version,
		level: 2,
	}));

	let response = await ctx.render(
		<DocumentLayout
			title={`${TITLE} — sdxc`}
			description={DESCRIPTION}
			canonical={ctx.url.href}
			sponsors={ctx.sponsors}
		>
			<DocsLayout
				tree={tree}
				activePath={routes.docs.changelog.href()}
				breadcrumbs={[
					{ label: "Documentation", href: routes.docs.index.href() },
					{ label: "Releases" },
					{ label: TITLE },
				]}
				aside={<TableOfContents anchors={anchors} />}
			>
				<article>
					<header mix={[vstack({ gap: 3 })]}>
						<h1 mix={[m(0), text("4xl"), weight("bold"), tracking("tight")]}>{TITLE}</h1>
						<p mix={[m(0), text("lg"), fg("neutral")]}>{DESCRIPTION}</p>
					</header>

					{releases.length === 0 ? (
						<div mix={[m("2.5rem", 0, 0, 0)]}>
							<Note kind="info">
								<p mix={[m(0)]}>
									The releases could not be read just now. Every one of them is published in full{" "}
									<a href={RELEASES_HREF} mix={[fg("brand")]} rel="noreferrer">
										on GitHub
									</a>
									, and this page fills in again as soon as the call answers.
								</p>
							</Note>
						</div>
					) : (
						<div mix={[vstack({ gap: 10 }), m("2.5rem", 0, 0, 0)]}>
							{releases.map((release, index) => {
								let notes = parseNotes(release.notes);

								return (
									<section key={release.version} mix={[vstack({ gap: 4 })]}>
										{index > 0 ? <Separator /> : null}

										<div mix={[vstack({ gap: 1 })]}>
											<h2
												id={release.version}
												mix={[m(0), font("mono"), text("2xl"), weight("bold"), tracking("tight")]}
											>
												{release.version}
											</h2>

											<div mix={[hstack({ gap: 3, align: "center" }), text("sm")]}>
												<time dateTime={release.publishedAt} mix={[fg("neutral.muted")]}>
													{formatDate(new Date(release.publishedAt), {
														locale: "en-US",
														timeZone: TIME_ZONE,
														dateStyle: "long",
													})}
												</time>
												<a href={release.href} mix={[fg("brand")]} rel="noreferrer">
													On GitHub
												</a>
											</div>
										</div>

										{notes ? (
											<Typeset preset="docs">
												{toRemix(notes, { components: DOCS_COMPONENTS })}
											</Typeset>
										) : (
											<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
												This release went out with no notes.
											</p>
										)}
									</section>
								);
							})}
						</div>
					)}
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	/*
	 * No bundle validator here. Every other page is a function of the deployed bundle, so
	 * one build is one version of it; this page's content arrives from GitHub between
	 * deploys, and a tag naming the build would hold a reader on yesterday's releases
	 * until the next one. The stored copy expiring at midnight is what bounds the work.
	 */
	return response;
});
