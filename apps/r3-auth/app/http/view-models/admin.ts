/**
 * Shapes the admin screens' data for rendering: the chrome every page wears (document
 * title, navigation labels, breadcrumb trail, heading), the pagination links the two
 * listings show, and the row shapes for clients, subjects and sessions. Views receive
 * only what they display, so no database row — and no client secret — reaches JSX.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import type { SessionWithClient } from "~/app/data/session";
import type { SelectClient, SelectConnection, SelectSubject } from "~/database/schema";

import routes from "~/routes/web";

/** How many rows each admin listing shows on a page. */
export const PAGE_SIZE = 10;

/** How long a session may sit unused before the detail page calls it stale. */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export namespace AdminView {
	/** One breadcrumb segment. The last one has no `href`: it is the current page. */
	export interface Crumb {
		label: string;
		href?: string;
	}

	/** Which top-level admin section is current, so its nav link carries `aria-current`. */
	export type Section = "dashboard" | "clients" | "subjects";

	/** Copy for the admin navigation, resolved once per request. */
	export interface Nav {
		label: string;
		dashboard: string;
		clients: string;
		subjects: string;
		profile: string;
		logout: string;
	}

	/** Everything the admin layout needs that is not the page's own body. */
	export interface Chrome {
		/** `<title>` for the document. */
		documentTitle: string;
		/** Visible page heading in the sticky header. */
		heading: string;
		/** Trail above the heading, outermost first. */
		breadcrumbs: Crumb[];
		/** Accessible name for the breadcrumb landmark. */
		breadcrumbsLabel: string;
		/** Navigation copy and which section is current. */
		nav: Nav;
		section: Section;
	}

	/** One page link in a listing's pagination control. */
	export interface PageLink {
		number: number;
		href: string;
		current: boolean;
	}

	/** A listing's pagination state, already resolved to links. */
	export interface Pagination {
		label: string;
		previous: { label: string; href?: string };
		next: { label: string; href?: string };
		pages: PageLink[];
		/** Whether the control is worth rendering at all. */
		visible: boolean;
	}

	/** A client as the list shows it. The secret is deliberately not part of this shape. */
	export interface ClientRow {
		id: string;
		name: string;
		redirectUri: string;
		createdAt: string;
		href: string;
		editHref: string;
	}

	/** A client as the detail page shows it, again without the secret. */
	export interface ClientDetail {
		id: string;
		name: string;
		description: string | null;
		logoUrl: string | null;
		redirectUri: string;
		logoutUri: string;
		backchannelLogoutUri: string | null;
		backchannelLogoutSessionRequired: boolean;
		frontchannelLogoutUri: string | null;
		frontchannelLogoutSessionRequired: boolean;
		createdAt: string;
	}

	/** A subject as the list shows it. */
	export interface SubjectRow {
		id: string;
		displayName: string;
		username: string;
		emailAddress: string;
		avatar: string;
		/** `"user"` or `"admin"`; the column is an enum but reads back as a plain string. */
		role: string;
		initials: string;
		createdAt: string;
		href: string;
		editHref: string;
	}

	/** A subject as the detail and edit pages show it. */
	export interface SubjectDetail {
		id: string;
		displayName: string;
		username: string;
		emailAddress: string;
		avatar: string;
		/** `"user"` or `"admin"`; the column is an enum but reads back as a plain string. */
		role: string;
		initials: string;
		emailVerified: boolean;
		emailVerifiedAt: string | null;
		createdAt: string;
	}

	/**
	 * A session as the subject detail page shows it.
	 *
	 * `id` is that session's refresh token. It is carried here only because revoking
	 * needs something to name the row by, it is never rendered as text, and nothing
	 * logs it.
	 */
	export interface SessionRow {
		id: string;
		device: string;
		ip: string | null;
		clientName: string | null;
		lastUsedAt: string;
		expiresAt: string;
		stale: boolean;
	}

	/** A linked provider identity as the subject detail page shows it. */
	export interface ConnectionRow {
		id: string;
		provider: string;
		externalId: string;
		createdAt: string;
	}
}

/**
 * Reads a listing's page number off the query string, clamped to at least 1.
 *
 * A missing, non-numeric or out-of-range value is page 1 rather than an error: a
 * hand-edited URL should show the first page, not a validation failure.
 */
export function readPageNumber(url: URL): number {
	let raw = Number(url.searchParams.get("page"));
	if (!Number.isFinite(raw)) return 1;
	return Math.max(1, Math.floor(raw));
}

/** Absolute-path URL for one page of a listing, preserving every other query parameter. */
function pageHref(url: URL, page: number): string {
	let params = new URLSearchParams(url.search);
	params.set("page", String(page));
	return `${url.pathname}?${params.toString()}`;
}

/**
 * Builds a listing's pagination links from the current URL and the total row count.
 *
 * Previous and next carry no `href` at the ends of the range, which is what makes the
 * view render them as inert rather than as links that go nowhere.
 */
export function toPagination(
	url: URL,
	page: number,
	totalCount: number,
	labels: { label: string; previous: string; next: string },
): AdminView.Pagination {
	let totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

	return {
		label: labels.label,
		previous: {
			label: labels.previous,
			href: page > 1 ? pageHref(url, page - 1) : undefined,
		},
		next: {
			label: labels.next,
			href: page < totalPages ? pageHref(url, page + 1) : undefined,
		},
		pages: Array.from({ length: totalPages }, (_, index) => ({
			number: index + 1,
			href: pageHref(url, index + 1),
			current: index + 1 === page,
		})),
		visible: totalPages > 1,
	};
}

/**
 * Resolves the admin navigation copy for the current request.
 *
 * @param ctx - The request, for its translator.
 */
export function toNav(ctx: RequestContext): AdminView.Nav {
	return {
		label: ctx.i18next.t("admin.nav.label"),
		dashboard: ctx.i18next.t("admin.nav.items.dashboard"),
		clients: ctx.i18next.t("admin.nav.items.clients"),
		subjects: ctx.i18next.t("admin.nav.items.subjects"),
		profile: ctx.i18next.t("admin.nav.items.profile"),
		logout: ctx.i18next.t("admin.nav.items.logout"),
	};
}

/**
 * Assembles a page's chrome, filling in the navigation copy and the breadcrumb
 * landmark's name so a controller only has to say which section it is in and what the
 * trail reads.
 */
export function toChrome(
	ctx: RequestContext,
	input: {
		documentTitle: string;
		heading: string;
		section: AdminView.Section;
		breadcrumbs: AdminView.Crumb[];
	},
): AdminView.Chrome {
	return {
		documentTitle: input.documentTitle,
		heading: input.heading,
		section: input.section,
		breadcrumbs: input.breadcrumbs,
		breadcrumbsLabel: ctx.i18next.t("admin.breadcrumbs.label"),
		nav: toNav(ctx),
	};
}

/**
 * Formats an epoch-ms column as a readable date and time in the request's language.
 *
 * The views render this string verbatim, so the formatting has to happen here: an ISO
 * timestamp in a table cell is both unreadable and wide enough to wrap the column.
 */
function toDateTime(value: number | null, locale: string): string | null {
	if (value === null) return null;

	return new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

/** First two characters of a name, for the avatar fallback when no image loads. */
function toInitials(displayName: string): string {
	return displayName.slice(0, 2).toUpperCase();
}

/** Shapes a client row for the list, resolving its own links so the view holds no URLs. */
export function toClientRow(client: SelectClient, locale: string): AdminView.ClientRow {
	return {
		id: client.id,
		name: client.name,
		redirectUri: client.redirect_uri,
		createdAt: toDateTime(client.created_at, locale) ?? "",
		href: routes.admin.client.index.href({ clientId: client.id }),
		editHref: routes.admin.clientEdit.index.href({ clientId: client.id }),
	};
}

/**
 * Shapes a client for the detail and edit pages.
 *
 * The `secret` column is not read: an existing client's secret is shown exactly once,
 * when it is generated, and this shape is what guarantees a page cannot leak it later.
 */
export function toClientDetail(client: SelectClient, locale: string): AdminView.ClientDetail {
	return {
		id: client.id,
		name: client.name,
		description: client.description,
		logoUrl: client.logo_url,
		redirectUri: client.redirect_uri,
		logoutUri: client.logout_uri,
		backchannelLogoutUri: client.backchannel_logout_uri,
		backchannelLogoutSessionRequired: client.backchannel_logout_session_required === "true",
		frontchannelLogoutUri: client.frontchannel_logout_uri,
		frontchannelLogoutSessionRequired: client.frontchannel_logout_session_required === "true",
		createdAt: toDateTime(client.created_at, locale) ?? "",
	};
}

/** Shapes a subject row for the list, resolving its own links. */
export function toSubjectRow(subject: SelectSubject, locale: string): AdminView.SubjectRow {
	return {
		id: subject.id,
		displayName: subject.display_name,
		username: subject.username,
		emailAddress: subject.email_address,
		avatar: subject.avatar,
		role: subject.role,
		initials: toInitials(subject.display_name),
		createdAt: toDateTime(subject.created_at, locale) ?? "",
		href: routes.admin.subject.index.href({ subjectId: subject.id }),
		editHref: routes.admin.subjectEdit.index.href({ subjectId: subject.id }),
	};
}

/** Shapes a subject for the detail and edit pages. */
export function toSubjectDetail(subject: SelectSubject, locale: string): AdminView.SubjectDetail {
	return {
		id: subject.id,
		displayName: subject.display_name,
		username: subject.username,
		emailAddress: subject.email_address,
		avatar: subject.avatar,
		role: subject.role,
		initials: toInitials(subject.display_name),
		emailVerified: subject.email_verified_at !== null,
		emailVerifiedAt: toDateTime(subject.email_verified_at, locale),
		createdAt: toDateTime(subject.created_at, locale) ?? "",
	};
}

/**
 * Turns a raw user-agent header into a short device label.
 *
 * Deliberately crude string matching: the label is a recognition aid for whoever is
 * looking at the list, not a fact anything acts on, so an unrecognized agent reading
 * "Unknown" is a better outcome than carrying a parsing library for it.
 */
export function toDeviceLabel(userAgent: string | null, unknownLabel: string): string {
	if (!userAgent) return unknownLabel;

	let browser = unknownLabel;
	if (userAgent.includes("Firefox/")) browser = "Firefox";
	else if (userAgent.includes("Edg/")) browser = "Edge";
	else if (userAgent.includes("OPR/") || userAgent.includes("Opera/")) browser = "Opera";
	else if (userAgent.includes("Chrome/")) browser = "Chrome";
	else if (userAgent.includes("Safari/")) browser = "Safari";

	let os = unknownLabel;
	if (userAgent.includes("Windows")) os = "Windows";
	else if (userAgent.includes("Android")) os = "Android";
	else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";
	else if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) os = "macOS";
	else if (userAgent.includes("Linux")) os = "Linux";

	return `${browser} — ${os}`;
}

/**
 * Shapes a session for the subject detail page's device list.
 *
 * `updated_at` drives the staleness badge because it is touched on every refresh, so
 * it reflects real use rather than when the session was opened.
 */
export function toSessionRow(
	session: SessionWithClient,
	unknownLabel: string,
	locale: string,
): AdminView.SessionRow {
	let lastUsed = session.updated_at ?? session.created_at ?? 0;

	return {
		id: session.id,
		device: toDeviceLabel(session.user_agent, unknownLabel),
		ip: session.ip_address,
		clientName: session.client?.name ?? null,
		lastUsedAt: toDateTime(lastUsed, locale) ?? "",
		expiresAt: toDateTime(session.expires_at, locale) ?? "",
		stale: Date.now() - lastUsed > STALE_AFTER_MS,
	};
}

/** Shapes a provider connection for the subject detail page. */
export function toConnectionRow(
	connection: SelectConnection,
	locale: string,
): AdminView.ConnectionRow {
	return {
		id: connection.id,
		provider: connection.provider,
		externalId: connection.external_id,
		createdAt: toDateTime(connection.created_at, locale) ?? "",
	};
}
