/**
 * The shell every admin page renders inside: a centered column holding the section
 * toolbar, a sticky page header carrying the breadcrumb trail, the heading and the
 * page's own actions, and then the page body. Keeping it in one place is what makes the
 * admin area read as one screen with a changing middle rather than eight pages.
 *
 * Navigation is plain links whose current state is the `aria-current` attribute the
 * server sets, so nothing here needs a line of script to know where it is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Breadcrumbs, Button, Form, Heading, LinkButton, NavLink, Toolbar } from "@pkg/r3-ui";
import { bg, borderEdge, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexCol, flexWrap, grow, insBs, items, justify, sticky } from "@pkg/u/layout";
import { at, dark } from "@pkg/u/responsive";
import { is, m, maxIs, mbs, mis, p } from "@pkg/u/size";
import { z } from "@pkg/u/stacking";
import { when } from "@pkg/u/state";
import { text } from "@pkg/u/typography";

import type { AdminView } from "~/app/http/view-models/admin";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Container step at which the page gains its wider gutters. */
const WIDE_STEP = "lg";

namespace AdminLayout {
	export interface Props {
		/** Title, trail, heading and navigation copy for this page. */
		chrome: AdminView.Chrome;
		/** Controls belonging to the page itself, rendered at the header's inline end. */
		actions?: RemixNode;
		children: RemixNode;
	}
}

/**
 * One admin navigation link, marked current through `aria-current` when its section is
 * the one being rendered. The pill background is the only thing added on top of the
 * component's own treatment, because a toolbar tab needs a hit area a bare text link
 * does not.
 */
function SectionLink(
	handle: Handle<{ href: string; label: string; current: boolean }>,
): () => RemixNode {
	return () => {
		let { href, label, current } = handle.props;

		return (
			<NavLink
				href={href}
				hasBackground
				aria-current={current ? "page" : undefined}
				mix={[
					p(1.5, 3),
					rounded("md"),
					text("sm"),
					// The library's own `aria-current` treatment is a foreground change alone,
					// which over the toolbar's tinted panel in a dark scheme reads as muted
					// rather than as selected. The filled pill plus the brand foreground is what
					// makes the current tab read as current in both schemes.
					when('&[aria-current="page"]', [bg("brand.tint"), fg("brand.emphasis")]),
				]}
			>
				{label}
			</NavLink>
		);
	};
}

/** Wraps an admin page in the document shell, the section toolbar and the page header. */
export default function AdminLayout(handle: Handle<AdminLayout.Props>) {
	return () => {
		let { chrome, actions, children } = handle.props;
		let { nav, breadcrumbs } = chrome;

		return (
			<DocumentLayout title={chrome.documentTitle}>
				<main
					mix={[
						is("100%"),
						maxIs("64rem"),
						m(0, "auto"),
						p(6),
						at(WIDE_STEP, p(10)),
						flex(),
						flexCol(),
					]}
				>
					<Toolbar aria-label={nav.label} mix={[flexWrap("wrap"), items("center")]}>
						<SectionLink
							href={routes.admin.dashboard.href()}
							label={nav.dashboard}
							current={chrome.section === "dashboard"}
						/>
						<SectionLink
							href={routes.admin.clients.index.href()}
							label={nav.clients}
							current={chrome.section === "clients"}
						/>
						<SectionLink
							href={routes.admin.subjects.href()}
							label={nav.subjects}
							current={chrome.section === "subjects"}
						/>

						<div mix={[grow()]} />

						<LinkButton
							href={routes.account.profile.href()}
							size="sm"
							color="neutral"
							variant="outline"
						>
							{nav.profile}
						</LinkButton>

						<Form method="post" action={routes.oidc.logout.action.href()}>
							<Button type="submit" size="sm" color="neutral" variant="outline">
								{nav.logout}
							</Button>
						</Form>
					</Toolbar>

					{/* Sticky so the trail and heading stay readable while a long table scrolls. */}
					<header
						mix={[
							sticky(),
							insBs(0),
							z(10),
							mbs(6),
							flex(),
							items("center"),
							p(3, 0),
							bg("color.neutral.50"),
							dark(bg("color.neutral.950")),
							borderEdge("block-end", { color: "neutral.border", width: 1 }),
						]}
					>
						<div mix={[flex(), flexCol(), justify("center")]}>
							{breadcrumbs.length > 0 && (
								<Breadcrumbs aria-label={chrome.breadcrumbsLabel}>
									<Breadcrumbs.List>
										{/* No segment carries `aria-current`: the trail holds the page's
										ancestors only, and the heading beneath it is the current page. A
										segment for the page itself would print its name twice. */}
										{breadcrumbs.map((crumb) => (
											<Breadcrumbs.Item key={crumb.label}>
												<Breadcrumbs.Link href={crumb.href}>{crumb.label}</Breadcrumbs.Link>
											</Breadcrumbs.Item>
										))}
									</Breadcrumbs.List>
								</Breadcrumbs>
							)}

							{/* The heading keeps the component's own size and weight: overriding a
							component's type mixin through `mix` resolves by stylesheet order, not
							by which array came last. */}
							<Heading level={1} mix={[m(0)]}>
								{chrome.heading}
							</Heading>
						</div>

						{actions && <aside mix={[mis("auto"), flex(), items("center")]}>{actions}</aside>}
					</header>

					<div mix={[mbs(6)]}>{children}</div>
				</main>
			</DocumentLayout>
		);
	};
}
