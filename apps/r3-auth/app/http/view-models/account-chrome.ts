/**
 * The props every account page hands its layout: the navigation copy, the breadcrumb
 * trail, and which link is current. It exists so the three pages describe only their
 * own content and none of them re-derives the chrome around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import type { AccountLayout } from "~/resources/layouts/account";

/** What a page contributes to its own chrome; everything else is derived here. */
export interface AccountChromeInput {
	/** Which navigation link this page is. */
	current: AccountLayout.Page;
	/** The page's own heading, and the last breadcrumb segment. */
	heading: string;
	/** Text for the `<title>` element, which may name the app rather than just the page. */
	documentTitle: string;
	/** Whether the page may offer the link into the admin area. */
	isAdmin: boolean;
	/**
	 * Trail segments between "Account" and this page, for a page nested deeper than the
	 * navigation goes — the profile edit form sits under the profile view.
	 */
	parents?: AccountLayout.Crumb[];
}

/** Every layout prop but `children`, ready to spread onto the layout. */
export type AccountChrome = Omit<AccountLayout.Props, "children">;

/**
 * Translates the navigation and breadcrumb copy through the request's own i18next
 * instance. The trail carries only the page's ancestors — the heading beneath it
 * already names the page, so repeating it there would stutter.
 */
export function accountChrome(ctx: RequestContext, input: AccountChromeInput): AccountChrome {
	return {
		documentTitle: input.documentTitle,
		heading: input.heading,
		breadcrumbsLabel: ctx.i18next.t("account.breadcrumbsLabel"),
		breadcrumbs: [{ label: ctx.i18next.t("account.title") }, ...(input.parents ?? [])],
		current: input.current,
		isAdmin: input.isAdmin,
		nav: {
			label: ctx.i18next.t("account.nav.label"),
			profile: ctx.i18next.t("account.nav.items.profile"),
			sessions: ctx.i18next.t("account.nav.items.sessions"),
			grants: ctx.i18next.t("account.nav.items.grants"),
			admin: ctx.i18next.t("account.nav.items.admin"),
			logout: ctx.i18next.t("account.nav.items.logout"),
		},
	};
}
