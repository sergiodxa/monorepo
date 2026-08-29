/**
 * Shared chrome for the `/docs` site: a searchable sidebar grouping every
 * doc by section, a topbar with a breadcrumb trail and a dashboard CTA,
 * and the article content column that every doc page composes into. The
 * sidebar stays a custom `<aside popover>` since `@pkg/ui`'s own `Sidebar`
 * assumes a persistent `<aside>`, not a single slide-in drawer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { ArrowRightIcon, MenuIcon } from "@pkg/lucide-remix";
import { bg, border, borderEdge, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import {
	basis,
	fixed,
	flex,
	flexCol,
	gap,
	grow,
	hidden,
	inlineFlex,
	insBottom,
	insLeft,
	insTop,
	items,
	justify,
	shrink,
} from "@pkg/u/layout";
import { overflowY } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { bs, height, m, maxHeight, maxIs, minBs, minIs, p, pb, width } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { fontSize, weight } from "@pkg/u/typography";
import { Breadcrumbs, Sidebar, Typeset } from "@pkg/ui";

import type { DocSection } from "~/app/services/docs";

import DocsNav from "~/resources/components/docs-nav";
import AuthCta from "~/resources/components/marketing/auth-cta";

/**
 * The hamburger button that opens the sidebar on mobile via the native Command
 * Invoker API (`commandfor`/`command="toggle-popover"`). Hidden at ≥768px.
 */
const sidebarToggle = [
	inlineFlex(),
	items("center"),
	justify("center"),
	width("32px"),
	height("32px"),
	p(0),
	rounded("md"),
	border("none"),
	bg("transparent"),
	fg("inherit"),
	cursor("pointer"),
	shrink(0),
	when("&:hover", bg("neutral.bg-tint-hover")),
	media("(min-width: 768px)", hidden()),
];

/** The sidebar's title, e.g. "Documentation". */
const sidebarTitleCss = [weight(600), fontSize("lg"), m(0), fg("neutral.emphasis")];

/** The sidebar's subtitle, e.g. "Guides and reference". */
const sidebarDescriptionCss = [
	fontSize("0.8125rem"),
	/**
	 * Physical 3-value margin shorthand (top / left+right / bottom) —
	 * `@pkg/u`'s `m()` only covers the 1/2/4-value logical form, not a
	 * 3-value one.
	 */
	raw({ margin: "4px 0 0" }),
	fg("neutral.muted"),
];

/** The topbar row: nav toggle + breadcrumb on the left, the dashboard CTA on the right. */
const topbar = [
	flex(),
	items("center"),
	justify("between"),
	gap("16px"),
	p("12px", "24px"),
	bg("oklch(0.98 0.004 250 / 0.5)"),
	borderEdge("bottom", { width: 1, color: "neutral" }),
	media("(prefers-color-scheme: dark)", bg("oklch(0.24 0.008 250 / 0.5)")),
];

const topbarLeft = [flex(), items("center"), gap("12px"), minIs(0)];

namespace DocsLayout {
	export interface Props {
		sections: DocSection[];
		/** Current doc's `/docs/...` path, compared against each nav link to mark it active. */
		activePath?: string;
		/** The `docs > overview`-style breadcrumb trail; the last item renders as plain (non-linked) text. */
		breadcrumbs?: Array<{ label: string; href?: string }>;
		isSignedIn: boolean;
		dashboardLabel: string;
		startLabel: string;
		sidebarTitle: string;
		sidebarDescription: string;
		searchPlaceholder: string;
		toggleNavLabel: string;
		/** Accessible name for the breadcrumb landmark, so screen readers hear it in the reader's own language. */
		breadcrumbLabel: string;
		children: RemixNode;
	}
}

/** Renders the searchable docs sidebar, a breadcrumb + dashboard-CTA topbar, and `children` as the article column. */
export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let {
			sections,
			activePath = "",
			breadcrumbs = [],
			isSignedIn,
			dashboardLabel,
			startLabel,
			sidebarTitle,
			sidebarDescription,
			searchPlaceholder,
			toggleNavLabel,
			breadcrumbLabel,
			children,
		} = handle.props;

		let navSections = sections.map((section) => ({
			title: section.title,
			docs: section.docs.map((doc) => ({ path: doc.path, title: doc.frontmatter.title })),
		}));

		return (
			<div mix={[flex(), flexCol(), height("100dvh"), raw({ overflow: "hidden" })]}>
				<div mix={[flex(), grow(), shrink(), basis("0%"), minBs(0), width("100%")]}>
					<aside
						id="docs-sidebar"
						popover="auto"
						mix={[
							/**
							 * Below 768px the sidebar hides behind a slide-in native popover
							 * drawer opened by the topbar's hamburger; at ≥768px the
							 * `!important`s below reset it to a normal static column.
							 */
							fixed(),
							insTop(0),
							insLeft(0),
							insBottom(0),
							m(0),
							width("min(80vw, 288px)"),
							maxHeight("100vh"),
							p(0),
							border("none"),
							borderEdge("right", { width: 1, color: "neutral" }),
							raw({ background: "#ffffff" }),
							raw({
								boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
							}),
							when("&::backdrop", raw({ background: "rgba(0, 0, 0, 0.4)" })),
							flex(),
							flexCol(),
							minBs(0),
							media("(min-width: 768px)", [
								raw({ display: "flex !important" }),
								raw({ position: "static" }),
								insTop("auto"),
								insLeft("auto"),
								insBottom("auto"),
								width("256px"),
								/**
								 * The UA stylesheet sets `height: fit-content` on every
								 * `[popover]`, so an explicit `height` is required to beat it
								 * once the flex row's stretch alignment resolves it to `auto`.
								 */
								height("auto"),
								maxHeight("none"),
								shrink(0),
								raw({ boxShadow: "none" }),
							]),
							media("(prefers-color-scheme: dark)", bg("neutral.bg-tint")),
						]}
					>
						<Sidebar.Header mix={[flexCol(), items("start"), bs("auto"), pb("1.25rem")]}>
							<p mix={[sidebarTitleCss]}>{sidebarTitle}</p>
							<p mix={[sidebarDescriptionCss]}>{sidebarDescription}</p>
						</Sidebar.Header>

						<Sidebar.Content>
							<DocsNav
								sections={navSections}
								activePath={activePath}
								searchPlaceholder={searchPlaceholder}
							/>
						</Sidebar.Content>
					</aside>

					<div mix={[flex(), flexCol(), grow(), shrink(), basis("0%"), minIs(0), minBs(0)]}>
						<div mix={[topbar]}>
							<div mix={[topbarLeft]}>
								<button
									type="button"
									commandfor="docs-sidebar"
									command="toggle-popover"
									aria-label={toggleNavLabel}
									mix={[sidebarToggle]}
								>
									<MenuIcon size={18} strokeWidth={1.5} />
								</button>

								{breadcrumbs.length > 0 && (
									<Breadcrumbs aria-label={breadcrumbLabel}>
										<Breadcrumbs.List>
											{breadcrumbs.map((crumb, index) => (
												<Breadcrumbs.Item key={`${crumb.label}-${index}`}>
													{crumb.href ? (
														<Breadcrumbs.Link href={crumb.href}>{crumb.label}</Breadcrumbs.Link>
													) : (
														<span>{crumb.label}</span>
													)}
												</Breadcrumbs.Item>
											))}
										</Breadcrumbs.List>
									</Breadcrumbs>
								)}
							</div>

							<AuthCta
								isSignedIn={isSignedIn}
								dashboardLabel={dashboardLabel}
								startLabel={startLabel}
								size="docs"
								icon={<ArrowRightIcon size={16} strokeWidth={1.5} />}
							/>
						</div>

						<div
							mix={[
								grow(),
								shrink(),
								basis("0%"),
								minIs(0),
								minBs(0),
								overflowY("auto"),
								/**
								 * Physical 3-value padding shorthand (top / left+right /
								 * bottom) — `@pkg/u`'s `p()` only covers the 1/2/4-value
								 * logical form.
								 */
								raw({ padding: "32px 24px 80px" }),
							]}
						>
							<Typeset mix={[maxIs("896px"), m(0, "auto")]}>{children}</Typeset>
						</div>
					</div>
				</div>
			</div>
		);
	};
}
