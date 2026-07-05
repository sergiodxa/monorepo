/**
 * The platform dashboard document shell rendered with `remix/ui` JSX. Provides the
 * page `<head>`, the top navigation with breadcrumbs and a sign-out control, and an
 * optional past-due subscription warning banner. Replaces the former
 * `resources/layouts/document.ts` `html` template helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import routes from "~/routes/web";

import { CONFIRM_SCRIPT } from "./components";
import * as s from "./styles";

/** A past-due subscription banner descriptor shown above the navigation. */
export interface SubscriptionWarning {
	type: "past_due";
	billingUrl: string;
}

/** Props for the {@link Document} dashboard shell. */
export interface DocumentProps {
	/** Text used for the `<title>` (rendered as `"<title> - Auth SaaS"`). */
	title: string;
	/** Tenant context for the breadcrumb, when the page is tenant-scoped. */
	tenant?: { id: string; name: string };
	/** Explicit breadcrumb href overriding the default tenant/dashboard link. */
	backLink?: string;
	/** Explicit breadcrumb label paired with {@link DocumentProps.backLink}. */
	backText?: string;
	/** Optional past-due subscription warning banner. */
	subscriptionWarning?: SubscriptionWarning;
	/** Page body rendered inside `<main>`. */
	children: RemixNode;
}

/**
 * Renders the full dashboard HTML document around a page's content, matching the
 * behavior of the previous `layout()` helper (breadcrumb precedence, sign-out form,
 * and the optional past-due warning banner).
 *
 * @param handle - Component handle exposing the shell props.
 * @returns A render function producing the dashboard document markup.
 * @example
 * return ctx.render(
 *   <Document title="Users" tenant={tenant}>
 *     <h2 mix={[s.pageTitle]}>Users</h2>
 *   </Document>,
 * );
 */
export function Document(handle: Handle<DocumentProps>) {
	return () => {
		let { title, tenant, backLink, backText, subscriptionWarning, children } = handle.props;

		let breadcrumb: RemixNode;
		if (backLink && backText) {
			breadcrumb = (
				<a mix={[s.breadcrumb]} href={backLink}>
					← {backText}
				</a>
			);
		} else if (tenant) {
			breadcrumb = (
				<a mix={[s.breadcrumb]} href={routes.dashboard.tenants.show.href({ id: tenant.id })}>
					← {tenant.name}
				</a>
			);
		} else {
			breadcrumb = (
				<a mix={[s.breadcrumb]} href={routes.dashboard.index.href()}>
					← Dashboard
				</a>
			);
		}

		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title} - Auth SaaS</title>
					<style>{s.RESET_CSS}</style>
				</head>
				<body mix={[s.body]}>
					{subscriptionWarning?.type === "past_due" && (
						<div mix={[s.warningBanner]}>
							<div mix={[s.warningBannerInner]}>
								<p mix={[s.warningText]}>
									<strong>Payment past due:</strong> Your subscription payment has failed. Please
									update your payment method to avoid service interruption.
								</p>
								<a mix={[s.warningLink]} href={subscriptionWarning.billingUrl}>
									Update Payment
								</a>
							</div>
						</div>
					)}
					<nav mix={[s.nav]}>
						<div mix={[s.navInner]}>
							<div mix={[s.navLeft]}>
								{breadcrumb}
								{tenant && (
									<>
										<span mix={[s.breadcrumbSep]}>/</span>
										<span mix={[s.breadcrumbCurrent]}>{tenant.name}</span>
									</>
								)}
							</div>
							<form mix={[s.inlineFormEl]} method="post" action={routes.logout.href()}>
								<button mix={[s.linkPlain, s.breadcrumb]} type="submit">
									Sign out
								</button>
							</form>
						</div>
					</nav>
					<main mix={[s.main]}>{children}</main>
					<script innerHTML={CONFIRM_SCRIPT} />
				</body>
			</html>
		);
	};
}
