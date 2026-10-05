/**
 * The bar every page ends on: the collection's name, the places a reader reaches once —
 * the argument for the packages, the applications built on them, the policies, the
 * source — and the author: where to follow them, and how to fund the work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { borderEdge, fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { is, m, maxIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text, tracking, weight } from "@sdxc/u/typography";

import type { Sponsor } from "~/app/services/sponsors";

import { AUTHOR_NAME, AUTHOR_URL, AUTHOR_X_URL, SPONSOR_URL } from "~/app/services/site";
import Sponsors from "~/resources/components/sponsors";
import routes from "~/routes/web";

/** Where the collection is read and its issues are filed. */
const REPOSITORY_HREF = "https://github.com/sergiodxa/monorepo";

/** Where every package is published. */
const NPM_HREF = "https://www.npmjs.com/org/sdxc";

namespace SiteFooter {
	export interface Props {
		/** The people to name, empty while the list is unknown. */
		sponsors: Sponsor[];
	}

	/** One link in a column. */
	export interface Link {
		label: string;
		href: string;
		/** Marks a destination that is a file rather than a page, which the browser loads itself. */
		file?: boolean;
	}

	/** One titled column of links. */
	export interface ColumnProps {
		title: string;
		links: Link[];
	}
}

/** Renders the closing bar. */
export default function SiteFooter(handle: Handle<SiteFooter.Props>) {
	return () => (
		<footer
			mix={[
				vstack({ align: "center" }),
				is("100%"),
				overflow("hidden"),
				borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
			]}
		>
			<div
				mix={[
					vstack({ gap: 12, align: "stretch" }),
					is("100%"),
					maxIs("76rem"),
					p(14, 5),
					media("(min-width: 48rem)", p(16, 12)),
				]}
			>
				<div
					mix={[
						grid(),
						gap(10),
						gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
						media(
							"(min-width: 64rem)",
							gridTemplate({ columns: "minmax(0, 2fr) repeat(5, minmax(0, 1fr))" }),
						),
					]}
				>
					<div
						mix={[
							vstack({ gap: 4, align: "start" }),
							raw({ gridColumn: "1 / -1" }),
							media("(min-width: 64rem)", raw({ gridColumn: "auto" })),
						]}
					>
						{/* Set the way the landing's hero sets the name, so the page opens and closes on it. */}
						<p
							mix={[
								m(0),
								text("4xl"),
								weight("medium"),
								tracking("-0.04em"),
								leading("none"),
								fg("neutral.emphasis"),
							]}
						>
							sdxc
						</p>
						<p mix={[m(0), text("sm"), fg("neutral")]}>
							MIT licensed, and written by{" "}
							<a href={AUTHOR_URL} mix={[fg("neutral.emphasis"), when("&:hover", fg("brand"))]}>
								{AUTHOR_NAME}
							</a>
							.
						</p>
					</div>

					<Column
						title="Docs"
						links={[
							{ label: "Guides", href: routes.docs.index.href() },
							{
								label: "Conventions",
								href: routes.docs.show.href({ slug: "conventions/result-everywhere" }),
							},
							{ label: "Versioning", href: routes.docs.show.href({ slug: "releases/versioning" }) },
							{ label: "Changelog", href: routes.docs.changelog.href() },
						]}
					/>
					<Column
						title="API"
						links={[
							{ label: "Every package", href: routes.api.index.href() },
							{ label: "Utilities", href: routes.api.show.href({ name: "u" }) },
							{ label: "Components", href: routes.api.show.href({ name: "ui" }) },
							{ label: "MCP server", href: routes.mcp.href() },
						]}
					/>
					<Column
						title="Project"
						links={[
							{ label: "Philosophy", href: routes.philosophy.href() },
							{ label: "Showcase", href: routes.showcase.href() },
							{ label: "Maintenance", href: routes.maintenance.href() },
							{ label: "Security", href: routes.security.href() },
						]}
					/>
					<Column
						title="Elsewhere"
						links={[
							{ label: "GitHub", href: REPOSITORY_HREF },
							{ label: "npm", href: NPM_HREF },
							{ label: "llms.txt", href: routes.llms.href(), file: true },
							{ label: "RSS", href: routes.feed.href(), file: true },
						]}
					/>
					{/* Present on every page, so a reader can fund the work before anyone else has. */}
					<Column
						title="Author"
						links={[
							{ label: "Blog", href: AUTHOR_URL },
							{ label: "X", href: AUTHOR_X_URL },
							{ label: "Sponsor", href: SPONSOR_URL },
						]}
					/>
				</div>

				<Sponsors sponsors={handle.props.sponsors} />
			</div>
		</footer>
	);
}

/** Renders one column of the footer's links. */
function Column(handle: Handle<SiteFooter.ColumnProps>) {
	return () => (
		<nav aria-label={handle.props.title} mix={[vstack({ gap: 4, align: "start" })]}>
			<h2 mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
				{handle.props.title}
			</h2>
			<ul mix={[vstack({ gap: 3, align: "start" }), m(0), p(0), listStyle("none")]}>
				{handle.props.links.map((link) => (
					<li key={link.href}>
						<a
							href={link.href}
							rel={link.href.startsWith("http") ? "noreferrer" : undefined}
							data-rmx-document={link.file ? true : undefined}
							mix={[text("sm"), fg("neutral"), when("&:hover", fg("neutral.emphasis"))]}
						>
							{link.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
