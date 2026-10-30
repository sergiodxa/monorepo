/**
 * The bar every page ends on: the collection's name and what it is, the places a reader
 * reaches once (the argument for the packages, the applications built on them, the
 * policies, the source), and a bottom row with the licence and where to follow the work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { BotIcon, RssIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text, tracking, weight } from "@sdxc/u/typography";
import { SiteFooter as UiSiteFooter } from "@sdxc/ui/patterns";

import { AUTHOR_NAME, AUTHOR_URL, AUTHOR_X_URL } from "~/config/constants";
import routes from "~/routes/web";

/** Where the collection is read and its issues are filed. */
const REPOSITORY_HREF = "https://github.com/sergiodxa/monorepo";

/** Where every package is published. */
const NPM_HREF = "https://www.npmjs.com/org/sdxc";

/** The year the copyright line names. */
const COPYRIGHT_YEAR = 2026;

/**
 * Renders the closing bar. Its column lines up with the page bands above it, and the
 * feed and `llms.txt` links load as documents, since the browser reads those files itself.
 */
export default function SiteFooter(_handle: Handle) {
	return () => (
		<UiSiteFooter
			brand={
				<a
					href={routes.home.href()}
					mix={[
						text("4xl"),
						weight("medium"),
						tracking("-0.04em"),
						leading("none"),
						fg("neutral.emphasis"),
					]}
				>
					sdxc
				</a>
			}
			tagline="TypeScript packages built on web standards, for Cloudflare Workers, Bun, Deno and Node."
			columns={[
				{
					title: "Docs",
					links: [
						{ label: "Guides", href: routes.docs.index.href() },
						{
							label: "Conventions",
							href: routes.docs.show.href({ slug: "conventions/result-everywhere" }),
						},
						{ label: "Versioning", href: routes.docs.show.href({ slug: "releases/versioning" }) },
						{ label: "Changelog", href: routes.docs.changelog.href() },
					],
				},
				{
					title: "API",
					links: [
						{ label: "Every package", href: routes.api.index.href() },
						{ label: "Utilities", href: routes.api.show.href({ name: "u" }) },
						{ label: "Components", href: routes.api.show.href({ name: "ui" }) },
						{ label: "MCP server", href: routes.mcp.href() },
					],
				},
				{
					title: "Project",
					links: [
						{ label: "Philosophy", href: routes.philosophy.href() },
						{ label: "Showcase", href: routes.showcase.href() },
						{ label: "Maintenance", href: routes.maintenance.href() },
						{ label: "Security", href: routes.security.href() },
					],
				},
				{
					title: "Elsewhere",
					links: [
						{ label: "Source on GitHub", href: REPOSITORY_HREF },
						{ label: "Packages on npm", href: NPM_HREF },
						{ label: "The author's blog", href: AUTHOR_URL },
						{ label: "Sponsor the work", href: routes.sponsors.href() },
					],
				},
			]}
			legal={
				<p mix={[m(0)]}>
					© {COPYRIGHT_YEAR}{" "}
					<a href={AUTHOR_URL} mix={[fg("neutral.emphasis"), when("&:hover", fg("brand"))]}>
						{AUTHOR_NAME}
					</a>
					. MIT licensed.
				</p>
			}
			social={
				<>
					<a href={REPOSITORY_HREF} aria-label="GitHub" title="GitHub">
						<GitHubMark />
					</a>
					<a href={AUTHOR_X_URL} aria-label="X" title="X">
						<XMark />
					</a>
					<a href={routes.feed.href()} aria-label="RSS feed" title="RSS feed" data-rmx-document>
						<RssIcon aria-hidden="true" />
					</a>
					<a href={routes.llms.href()} aria-label="llms.txt" title="llms.txt" data-rmx-document>
						<BotIcon aria-hidden="true" />
					</a>
				</>
			}
			mix={[
				raw({ "--site-footer-gutter": "1.25rem" }),
				media("(min-width: 48rem)", raw({ "--site-footer-gutter": "calc(3rem + 1px)" })),
				when(
					'& > div > div:has(> [data-slot="site-footer-main"])',
					raw({ paddingInline: "var(--site-footer-gutter) !important" }),
				),
			]}
		/>
	);
}

/** GitHub's mark, which the icon set leaves out with every other brand. */
function GitHubMark(_handle: Handle) {
	return () => (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.3v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
		</svg>
	);
}

/** X's mark, drawn for the same reason as {@link GitHubMark}. */
function XMark(_handle: Handle) {
	return () => (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M18.9 1.2h3.7l-8 9.2L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5L9 13 0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.3H4.3l13.3 17.3Z" />
		</svg>
	);
}
