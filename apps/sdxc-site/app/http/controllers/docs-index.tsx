/**
 * `GET /docs` — the hub. A reader arriving here wants one of a small number of
 * different things, and a sidebar with three hundred leaves answers none of them, so
 * the page routes by intent: a path to start on, search, and every section with its size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SearchIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { hover, when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { Keyboard } from "@sdxc/ui";
import { DocsHub } from "@sdxc/ui/docs";
import { keyComboGlyphs } from "@sdxc/ui/utils";
import { isApplePlatform } from "@sdxc/user-agent/helpers";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { describeSection, listGuides } from "~/app/services/docs";
import { buildGuidesNav } from "~/app/services/navigation";
import { readPackageFacts } from "~/app/services/packages";
import { SEARCH_TRIGGER_ATTRIBUTE } from "~/resources/components/search-trigger";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DESCRIPTION =
	"What the collection is, the conventions it keeps, and how to build a Remix app with it, from the router to the jobs behind it.";

/** The hub's block headings. */
const LABELS: DocsHub.Labels = { start: "Start here", sections: "Browse by topic" };

/** A section's count, worded for a reader scanning the cards. */
function formatGuideCount(count: number): string {
	return count === 1 ? "1 guide" : `${count} guides`;
}

/**
 * A field-shaped link to `/search` carrying the header trigger's attribute, so a click opens
 * the site's ⌘K dialog once the page's script runs and lands on the search page before then.
 */
function HubSearch(handle: Handle<{ appleKeyboard: boolean }>) {
	return () => (
		<a
			href={routes.search.href()}
			{...{ [SEARCH_TRIGGER_ATTRIBUTE]: "" }}
			aria-keyshortcuts="Meta+K Control+K /"
			mix={[
				hstack({ gap: 3, align: "center" }),
				raw({ minBlockSize: "3rem", paddingInline: "1rem", textDecoration: "none" }),
				rounded("lg"),
				border({ color: "neutral.border", width: 1, style: "solid" }),
				bg("neutral.bg"),
				text("base"),
				fg("neutral.muted"),
				hover(border("brand.border")),
				when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
				motionSafe(raw({ transition: "border-color 150ms cubic-bezier(0, 0, 0.2, 1)" })),
			]}
		>
			<SearchIcon size={18} aria-hidden="true" />
			<span mix={[raw({ flex: "1 1 auto" })]}>Search guides and packages</span>
			<Keyboard>{keyComboGlyphs("mod+k", handle.props.appleKeyboard).join("")}</Keyboard>
		</a>
	);
}

/**
 * Renders the hub: the first section's guides as the larger "Start here" cards, then every
 * other section entered at its first guide with its guide count, then the package index and
 * the changelog as sections of their own.
 */
export default createAction(routes.docs.index, async (ctx) => {
	let [first, ...rest] = await listGuides();
	let tree = await buildGuidesNav();
	let facts = readPackageFacts();

	let start: DocsHub.StartItem[] = (first?.guides ?? []).map((guide) => ({
		title: guide.frontmatter.title,
		href: routes.docs.show.href({ slug: guide.slug }),
		description: guide.frontmatter.description,
		eyebrow: first?.title,
	}));

	let sections = rest
		.flatMap((section): DocsHub.Section[] => {
			let entry = section.guides.at(0);
			if (!entry) return [];
			return [
				{
					title: section.title,
					href: routes.docs.show.href({ slug: entry.slug }),
					description: describeSection(section),
					count: section.guides.length,
				},
			];
		})
		.concat([
			{
				title: "Package reference",
				href: routes.api.index.href(),
				description: "Every package, grouped by the problem it solves, each with its own page.",
				countLabel: `${facts.published} packages`,
			},
			{
				title: "Changelog",
				href: routes.docs.changelog.href(),
				description: "What each day's release shipped, with the commits that went into it.",
			},
		]);

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Documentation — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
			siteFooter={false}
		>
			<DocsLayout
				tree={tree}
				filterQuery={ctx.url.searchParams.get("filter")}
				activePath={routes.docs.index.href()}
			>
				<DocsHub
					eyebrow="Guides"
					title="Documentation"
					lead={DESCRIPTION}
					search={<HubSearch appleKeyboard={isApplePlatform(ctx)} />}
					start={start}
					sections={sections}
					labels={LABELS}
					formatCount={formatGuideCount}
				/>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
