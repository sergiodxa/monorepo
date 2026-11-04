/**
 * `GET /api/icons/:icon` and `GET /frames/icons/:icon` — one icon, as a page of its own and
 * as the fragment the gallery's dialog loads. Both draw the same detail, so a reader who
 * opens the link in a tab sees what the dialog showed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { mf } from "@sdxc/microformats/ui";
import { vstack } from "@sdxc/u/layout";
import { DocsPageHeader } from "@sdxc/ui/docs";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { readIconStyle } from "~/app/http/validators/icon-style";
import { pageSchema, seo, trailSchema } from "~/app/initializers/seo";
import { adsDayTag } from "~/app/services/ads";
import { renderIconSvg } from "~/app/services/icon-svg";
import { findIcon } from "~/app/services/icons";
import { buildPackageNav } from "~/app/services/navigation";
import { absoluteUrl } from "~/config/constants";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { EntrySummary, EntryTitle } from "~/resources/components/entry";
import IconDetail from "~/resources/components/icon-detail";
import PageActions from "~/resources/components/page-actions";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The file every icon's drawing is generated into. */
const SOURCE_URL = "https://github.com/sergiodxa/monorepo/blob/main/packages/icons/src/registry.ts";

/** Renders the icon's page, under the package's place in the navigation; an unknown name is a 404. */
export default createAction(routes.api.icon, async (ctx) => {
	let { icon: name } = s.parse(s.object({ icon: s.string() }), ctx.params);
	let tree = await buildPackageNav("icons");

	let icon = findIcon(name);
	if (icon === null) return notFound(ctx, tree);
	let style = readIconStyle(ctx.url.searchParams);

	let markdownHref = routes.markdown.icon.href({ icon: icon.name });
	let activePath = routes.api.icon.href({ icon: icon.name });
	let canonical = seo.canonical(activePath);
	let description = `The ${icon.name} icon from Lucide, rendered with ${icon.component} from @sdxc/icons.`;
	let summary = `Rendered with ${icon.component}, or <Icon name="${icon.name}" /> when the name is data.`;
	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${icon.name} icon — @sdxc/icons`}
			description={description}
			canonical={absoluteUrl(activePath)}
			og={{ type: "article" }}
			schema={[
				pageSchema({
					name: icon.name,
					description,
					url: canonical,
					cardTitle: `${icon.name} icon — @sdxc/icons`,
				}),
				trailSchema(
					[
						{ name: "API", url: routes.api.index.href() },
						{ name: "@sdxc/icons", url: routes.api.icons.href() },
					],
					{ name: icon.name, url: canonical },
				),
			]}
			siteFooter={false}
		>
			<DocsLayout
				tree={tree}
				filterQuery={ctx.url.searchParams.get("filter")}
				activePath={routes.api.icons.href()}
				feedback={{ sent: isFeedbackSent(ctx.url) }}
			>
				<article mix={[mf("h-entry"), vstack({ gap: 6, align: "stretch" })]}>
					<DocsPageHeader
						crumbs={[
							{ label: "API", href: routes.api.index.href() },
							{ label: "@sdxc/icons", href: routes.api.icons.href() },
							{ label: icon.name },
						]}
						title={<EntryTitle href={activePath}>{icon.name}</EntryTitle>}
						mono
						description={<EntrySummary>{summary}</EntrySummary>}
						actions={
							<PageActions
								markdownHref={markdownHref}
								markdownUrl={absoluteUrl(markdownHref)}
								sourceUrl={SOURCE_URL}
							/>
						}
					/>
					<div mix={[mf("e-content")]}>
						<IconDetail icon={icon} style={style} svg={await renderIconSvg(icon.name, style)} />
					</div>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, `${adsDayTag()}:${ctx.url.search}`);
});

/**
 * The icon's detail alone, for a `<Frame>`, streamed as rendered so the frame inlines all of
 * it. A request that is not a frame load, such as the address opened in a tab, is sent to the
 * icon's page, and an unknown name answers `404`.
 */
export const iconFrame = createAction(routes.frames.icon, async (ctx) => {
	let { icon: name } = s.parse(s.object({ icon: s.string() }), ctx.params);
	let icon = findIcon(name);
	let style = readIconStyle(ctx.url.searchParams);

	if (ctx.request.headers.get("X-Remix-Frame") !== "true") {
		return redirect(icon ? routes.api.icon.href({ icon: icon.name }) : routes.api.icons.href());
	}
	if (icon === null) return ctx.render(<p>No icon is called “{name}”.</p>, { status: 404 });

	return ctx.render(
		<IconDetail icon={icon} style={style} svg={await renderIconSvg(icon.name, style)} />,
	);
});
