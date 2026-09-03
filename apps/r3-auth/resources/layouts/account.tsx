/**
 * The chrome every signed-in account page wears: a sticky header carrying the page's
 * breadcrumb trail and heading, a toolbar of navigation links whose active one is
 * marked with `aria-current`, and the sign-out form. It exists so each page describes
 * only its own content while the way out and the way between pages stays in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, borderEdge, fg, translucent } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexCol, flexWrap, gap, grow, insBs, items, justify, sticky } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, m, maxIs, mbe, mi, p, pb, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Breadcrumbs, Button, Form, Heading, LinkButton, NavLink, Toolbar } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Container step at which the page gains the roomier padding of a desktop window. */
const WIDE_WIDTH = "lg";

export namespace AccountLayout {
	/** Which navigation link is the page currently being rendered. */
	export type Page = "profile" | "sessions" | "grants";

	/** One segment of the header's breadcrumb trail; the last one carries no link. */
	export interface Crumb {
		label: string;
		href?: string;
	}

	/** Copy for the navigation toolbar, translated by the controller that renders it. */
	export interface Nav {
		/** Accessible name for the toolbar itself. */
		label: string;
		profile: string;
		sessions: string;
		grants: string;
		/** Label of the link to the admin area, offered only to an admin. */
		admin: string;
		logout: string;
	}

	export interface Props {
		/** Text for the `<title>` element. */
		documentTitle: string;
		/** The page's own heading, shown in the sticky header. */
		heading: string;
		/** Accessible name for the breadcrumb trail. */
		breadcrumbsLabel: string;
		/** The trail of the page's ancestors, outermost first; never the page itself. */
		breadcrumbs: Crumb[];
		/** Which navigation link this page is, so exactly one is marked current. */
		current: Page;
		/** Whether to offer the link into the admin area. */
		isAdmin: boolean;
		nav: Nav;
		children: RemixNode;
	}
}

/**
 * One navigation tab. The filled pill sits on top of the library's own
 * `aria-current` styling, which is only a foreground-color change and reads
 * as muted on the toolbar's tinted panel in a dark scheme.
 */
function AccountNavLink(handle: Handle<{ href: string; label: string; isCurrent: boolean }>) {
	return () => {
		let { href, label, isCurrent } = handle.props;

		return (
			<NavLink
				href={href}
				hasBackground
				aria-current={isCurrent ? "page" : undefined}
				mix={[
					pi(3),
					pb(2),
					rounded("md"),
					when('&[aria-current="page"]', [bg("brand.tint"), fg("brand.emphasis")]),
				]}
			>
				{label}
			</NavLink>
		);
	};
}

/**
 * Renders the header, navigation and page frame around an account page's
 * content. Nav links read `aria-current` from the server, and the sign-out
 * button submits to the logout endpoint, which owns session cleanup.
 */
export default function AccountLayout(handle: Handle<AccountLayout.Props>) {
	return () => {
		let { documentTitle, heading, breadcrumbsLabel, breadcrumbs, current, isAdmin, nav, children } =
			handle.props;

		return (
			<DocumentLayout title={documentTitle}>
				<header
					mix={[
						sticky(),
						insBs(0),
						z(10),
						flex(),
						items("center"),
						gap(2),
						bs("4rem"),
						p(0, 4),
						translucent(),
						bg("neutral.tint"),
						borderEdge("block-end", { color: "neutral.border", width: 1 }),
					]}
				>
					<div mix={[flex(), flexCol(), justify("center"), gap(0.5)]}>
						{breadcrumbs.length > 0 && (
							<Breadcrumbs aria-label={breadcrumbsLabel}>
								<Breadcrumbs.List>
									{breadcrumbs.map((crumb) => (
										<Breadcrumbs.Item key={crumb.label}>
											<Breadcrumbs.Link href={crumb.href}>{crumb.label}</Breadcrumbs.Link>
										</Breadcrumbs.Item>
									))}
								</Breadcrumbs.List>
							</Breadcrumbs>
						)}

						<Heading level={1} mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
							{heading}
						</Heading>
					</div>
				</header>

				<main mix={[mi("auto"), maxIs("64rem"), p(6), at(WIDE_WIDTH, p(10))]}>
					<Toolbar aria-label={nav.label} mix={[mbe(6), flexWrap("wrap"), items("center"), gap(2)]}>
						<AccountNavLink
							href={routes.account.profile.href()}
							label={nav.profile}
							isCurrent={current === "profile"}
						/>
						<AccountNavLink
							href={routes.account.sessions.index.href()}
							label={nav.sessions}
							isCurrent={current === "sessions"}
						/>
						<AccountNavLink
							href={routes.account.grants.index.href()}
							label={nav.grants}
							isCurrent={current === "grants"}
						/>

						<span aria-hidden="true" mix={[grow()]} />

						{isAdmin && (
							<LinkButton
								href={routes.admin.dashboard.href()}
								color="neutral"
								variant="outline"
								size="sm"
							>
								{nav.admin}
							</LinkButton>
						)}

						<Form method="post" action={routes.oidc.logout.action.href()}>
							<Button type="submit" color="neutral" variant="outline" size="sm">
								{nav.logout}
							</Button>
						</Form>
					</Toolbar>

					{children}
				</main>
			</DocumentLayout>
		);
	};
}
