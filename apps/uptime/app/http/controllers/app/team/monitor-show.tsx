/**
 * HTTP monitor detail page controller. Shows the monitor's stat cards, its 90-day status
 * strip, its configuration and SSL certificate as property lists, plus run/edit/delete
 * actions in the page header; 404s when the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { formatDate } from "@sdxc/dates";
import { notFound } from "@sdxc/http/response/html";
import { IntlProvider } from "@sdxc/i18n/ui";
import { EllipsisIcon, PencilIcon, RefreshCwIcon, TrashIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { gap, grid, gridTemplate, hstack, justify, vstack } from "@sdxc/u/layout";
import { bs, m } from "@sdxc/u/size";
import { font, fontSize, text, weight } from "@sdxc/u/typography";
import {
	AlertDialog,
	Badge,
	Button,
	LinkButton,
	Menu,
	PropertyList,
	RelativeTime,
	StatusDot,
} from "@sdxc/ui";
import { Skeleton, StatCard } from "@sdxc/ui/app";
import { menuKeys } from "@sdxc/ui/mixins";
import { Frame } from "remix/component";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { SslStatus } from "~/app/services/ssl-info";
import type { SelectMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import { teamAccess } from "~/app/http/middleware/access";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import { calculateSslStatus } from "~/app/services/ssl-info";
import { badgeVariant } from "~/resources/components/badge";
import RunMonitorButton from "~/resources/components/run-monitor-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { LOCATION_HINT_EMOJI } from "~/resources/views/monitors/form";
import routes from "~/routes/web";

/** The request's translator, as every section below receives it. */
type Intl = ReturnType<typeof getContext>["intl"];

/** The dot the header draws for each cached check outcome; a never-checked monitor is neutral. */
const STATUS_COLOR = {
	up: "success",
	degraded: "warning",
	down: "danger",
	unknown: "neutral",
} as const;

/** Narrows the cached `last_status` column to a state the header draws. */
function cachedStatus(monitor: SelectMonitor): keyof typeof STATUS_COLOR {
	let status = monitor.last_status;
	return status === "up" || status === "degraded" || status === "down" ? status : "unknown";
}

/** The id the overflow menu's Delete item opens, unique on the page. */
const DELETE_DIALOG_ID = "delete-monitor";

/** The overflow menu's popover id, which its trigger toggles. */
const OVERFLOW_MENU_ID = "monitor-overflow";

/**
 * GET /app/:team/monitors/:monitorId — a monitor's detail page. `RunMonitorButton`
 * is a `clientEntry` island rendered server-side too, so its `IntlProvider` wrapper
 * supplies the request-scoped `intl` its client-only module default lacks during SSR.
 * Delete sits last in the overflow menu, and only for a member allowed to delete.
 */
export default createAction(routes.app.team.monitors.show, {
	middleware: [requireUser, requireTeam, teamAccess],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.monitors.inTeam(ctx.team.id).find(monitorId);
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.monitors.delete);
		let canDelete = ctx.access.can(abilities.monitors.delete);

		let t = ctx.intl.t;
		let params = { team: ctx.team.slug, monitorId: monitor.id };
		let status = cachedStatus(monitor);

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={monitor.name}
					breadcrumbs={[
						{
							label: t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: t("page.httpMonitors.header.title"),
							href: routes.app.team.monitors.index.href({ team: ctx.team.slug }),
						},
					]}
					description={<code mix={[font("mono"), fontSize("sm")]}>{monitor.url}</code>}
					status={
						monitor.enabled_at === null ? (
							<StatusDot color="neutral">{t("page.httpMonitors.table.disabled")}</StatusDot>
						) : (
							<StatusDot color={STATUS_COLOR[status]}>
								{t(`page.httpMonitors.table.status.${status}`)}
							</StatusDot>
						)
					}
					overflow={
						<OverflowMenu
							intl={ctx.intl}
							refreshHref={ctx.url.pathname}
							deleteForm={
								canDelete ? (
									<DeleteMonitorDialog
										intl={ctx.intl}
										action={routes.actions.monitor.http.delete.href({ team: ctx.team.slug })}
										monitor={monitor}
									/>
								) : null
							}
						/>
					}
					actions={
						<IntlProvider intl={ctx.intl}>
							<RunMonitorButton
								action={routes.actions.monitor.http.play.href({ team: ctx.team.slug })}
								monitorId={monitor.id}
								name={monitor.name}
								statusUrl={routes.app.team.monitors.runStatus.href(params)}
							/>
						</IntlProvider>
					}
					primaryAction={
						<LinkButton href={routes.app.team.monitors.edit.href(params)}>
							<PencilIcon size={16} strokeWidth={1.5} />
							{t("page.monitor.header.action.edit")}
						</LinkButton>
					}
				>
					<div mix={[vstack({ gap: 8, align: "stretch" })]}>
						<StatCard.Group aria-label={t("page.monitorDetail.statsLabel")}>
							<Frame
								name="monitor-card-usage"
								src={routes.app.team.monitors.cards.usage.href(params)}
								fallback={<StatCard.Skeleton footer />}
							/>
							<Frame
								name="monitor-card-slowest-result"
								src={routes.app.team.monitors.cards.slowestResult.href(params)}
								fallback={<StatCard.Skeleton footer />}
							/>
							<Frame
								name="monitor-card-p99-response-time"
								src={routes.app.team.monitors.cards.p99ResponseTime.href(params)}
								fallback={<StatCard.Skeleton footer />}
							/>
							<Frame
								name="monitor-card-uptime"
								src={routes.app.team.monitors.cards.uptime.href(params)}
								fallback={<StatCard.Skeleton footer />}
							/>
						</StatCard.Group>

						<Section title={t("page.monitorDetail.history.title")}>
							<Frame
								name="monitor-card-uptime-history"
								src={routes.app.team.monitors.cards.uptimeHistory.href(params)}
								fallback={<Skeleton mix={[bs("4.5rem")]} />}
							/>
						</Section>

						<div
							mix={[
								grid(),
								gridTemplate({ columns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))" }),
								gap(8),
							]}
						>
							<ConfigurationSection monitor={monitor} intl={ctx.intl} locale={ctx.locale} />
							<SslSection team={ctx.team} monitor={monitor} intl={ctx.intl} locale={ctx.locale} />
						</div>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	},
});

namespace Section {
	export interface Props {
		title: string;
		/** Drawn at the end of the heading's line, such as the certificate's status badge. */
		aside?: RemixNode;
		children: RemixNode;
	}
}

/** One titled block of the detail page; its heading sits under the page title's level. */
function Section(handle: Handle<Section.Props>) {
	return () => {
		let { title, aside, children } = handle.props;
		return (
			<section mix={[vstack({ gap: 3, align: "stretch" })]}>
				<div mix={[hstack({ gap: 2, align: "center" }), justify("between")]}>
					<h2 mix={[m(0), text("base"), weight("semibold")]}>{title}</h2>
					{aside}
				</div>
				{children}
			</section>
		);
	};
}

namespace OverflowMenu {
	export interface Props {
		intl: Intl;
		refreshHref: string;
		/** The delete confirmation, or `null` for a member who cannot delete, which hides the item. */
		deleteForm: RemixNode;
	}
}

/**
 * The header's "More actions" menu: Refresh, then Delete last in the danger tone. Delete
 * opens a confirmation naming the monitor rather than deleting on click.
 */
function OverflowMenu(handle: Handle<OverflowMenu.Props>) {
	return () => {
		let { intl, refreshHref, deleteForm } = handle.props;
		let label = intl.t("page.monitorDetail.more");

		return (
			<>
				<Button
					type="button"
					variant="ghost"
					color="neutral"
					aria-label={label}
					commandfor={OVERFLOW_MENU_ID}
					command="toggle-popover"
				>
					<EllipsisIcon size={16} strokeWidth={1.5} />
				</Button>
				<Menu id={OVERFLOW_MENU_ID} placement="bottom-end" aria-label={label} mix={[menuKeys()]}>
					<Menu.Item href={refreshHref}>
						<RefreshCwIcon size={16} strokeWidth={1.5} />
						{intl.t("page.monitor.header.action.refresh")}
					</Menu.Item>
					{deleteForm ? (
						<>
							<Menu.Separator />
							<Menu.Item danger commandfor={DELETE_DIALOG_ID} command="show-modal">
								<TrashIcon size={16} strokeWidth={1.5} />
								{intl.t("page.httpMonitors.table.actions.delete")}
							</Menu.Item>
						</>
					) : null}
				</Menu>
				{deleteForm}
			</>
		);
	};
}

namespace DeleteMonitorDialog {
	export interface Props {
		intl: Intl;
		action: string;
		monitor: SelectMonitor;
	}
}

/** The delete confirmation: names the monitor and what goes with it, then posts the delete. */
function DeleteMonitorDialog(handle: Handle<DeleteMonitorDialog.Props>) {
	return () => {
		let { intl, action, monitor } = handle.props;
		let titleId = `${DELETE_DIALOG_ID}-title`;
		let descriptionId = `${DELETE_DIALOG_ID}-description`;

		return (
			<AlertDialog id={DELETE_DIALOG_ID} aria-labelledby={titleId} aria-describedby={descriptionId}>
				<AlertDialog.Header>
					<AlertDialog.Title id={titleId}>
						{intl.t("page.httpMonitors.table.confirmation.delete", { name: monitor.name })}
					</AlertDialog.Title>
					<AlertDialog.Description id={descriptionId}>
						{intl.t("page.httpMonitors.table.confirmation.deleteDescription")}
					</AlertDialog.Description>
				</AlertDialog.Header>
				<form method="post" action={action}>
					<input type="hidden" name="_method" value="DELETE" />
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<AlertDialog.Footer>
						<AlertDialog.Cancel type="button" commandfor={DELETE_DIALOG_ID}>
							{intl.t("page.editMonitor.form.cancel")}
						</AlertDialog.Cancel>
						<Button type="submit" color="danger">
							{intl.t("page.httpMonitors.table.actions.delete")}
						</Button>
					</AlertDialog.Footer>
				</form>
			</AlertDialog>
		);
	};
}

namespace ConfigurationSection {
	export interface Props {
		monitor: SelectMonitor;
		intl: Intl;
		locale: string;
	}
}

/**
 * The monitor's configuration as label/value rows: what it checks, how often, what it
 * expects and from where, plus the last check's outcome. A never-checked monitor names
 * that in words instead of leaving the row blank.
 */
function ConfigurationSection(handle: Handle<ConfigurationSection.Props>) {
	return () => {
		let { monitor, intl, locale } = handle.props;
		let t = intl.t;
		let hint = monitor.location_hint;

		return (
			<Section title={t("page.monitorDetail.properties.title")}>
				<PropertyList>
					<PropertyList.Item label={t("page.monitorDetail.properties.url")}>
						<code mix={[font("mono"), fontSize("sm")]}>{monitor.url}</code>
					</PropertyList.Item>
					<PropertyList.Item label={t("page.monitorDetail.properties.interval")}>
						{t("page.monitorDetail.properties.intervalValue", {
							minutes: Math.round(monitor.interval_seconds / 60),
						})}
					</PropertyList.Item>
					<PropertyList.Item label={t("page.monitorDetail.properties.expectedStatus")}>
						{monitor.expected_status}
					</PropertyList.Item>
					<PropertyList.Item
						label={t("page.monitorDetail.properties.region")}
						empty={t("page.monitorDetail.properties.noRegion")}
					>
						{hint && hint in LOCATION_HINT_EMOJI
							? t(`page.createMonitor.form.fields.region.options.${hint}`, {
									emoji: LOCATION_HINT_EMOJI[hint as keyof typeof LOCATION_HINT_EMOJI],
								})
							: undefined}
					</PropertyList.Item>
					<PropertyList.Item
						label={t("page.monitorDetail.properties.lastResponse")}
						empty={t("page.httpMonitors.table.neverChecked")}
					>
						{monitor.last_response_time_ms === null
							? undefined
							: new Intl.NumberFormat(locale, {
									style: "unit",
									unit: "millisecond",
									unitDisplay: "narrow",
								}).format(monitor.last_response_time_ms)}
					</PropertyList.Item>
					<PropertyList.Item
						label={t("page.monitorDetail.properties.lastChecked")}
						empty={t("page.httpMonitors.table.neverChecked")}
					>
						{monitor.last_checked_at === null ? undefined : (
							<RelativeTime date={monitor.last_checked_at} locale={locale} local />
						)}
					</PropertyList.Item>
				</PropertyList>
			</Section>
		);
	};
}

/** The badge tone each certificate classification draws in. */
const SSL_TONE: Record<SslStatus, BadgeTone> = {
	valid: "up",
	expiring: "degraded",
	expired: "down",
	unknown: "neutral",
};

namespace SslSection {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		intl: Intl;
		locale: string;
	}
}

/**
 * Where the section's certificate comes from: a typed date, or the last Certificate
 * Transparency lookup, `pending` until the first one answers.
 */
function certificateSource(monitor: SelectMonitor) {
	if (monitor.ssl_expiry_source === "manual") return "manual";
	return monitor.ssl_transparency_status ?? "pending";
}

/**
 * The SSL certificate section: a "not configured" prompt, or the certificate's expiry,
 * issuer and last lookup as property rows, badged by {@link calculateSslStatus}'s
 * classification. Its configure link leads to the edit page, where the settings live.
 */
function SslSection(handle: Handle<SslSection.Props>) {
	return () => {
		let { team, monitor, intl, locale } = handle.props;
		let t = intl.t;
		let editHref = routes.app.team.monitors.edit.href({ team: team.slug, monitorId: monitor.id });
		let configure = (
			<LinkButton href={editHref} variant="outline" color="neutral" size="sm">
				{t("page.monitor.ssl.configure")}
			</LinkButton>
		);

		if (!monitor.ssl_monitoring_enabled) {
			return (
				<Section
					title={t("page.monitor.ssl.title")}
					aside={<Badge {...badgeVariant("neutral")}>{t("page.monitor.ssl.status.unknown")}</Badge>}
				>
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{t("page.monitor.ssl.notConfigured")}</p>
					<div>{configure}</div>
				</Section>
			);
		}

		let { status, daysUntilExpiry } = calculateSslStatus(
			monitor.ssl_expires_at,
			monitor.ssl_expiry_warning_days,
		);

		return (
			<Section
				title={t("page.monitor.ssl.title")}
				aside={
					<Badge {...badgeVariant(SSL_TONE[status] ?? "neutral")}>
						{t(`page.monitor.ssl.status.${status}`)}
					</Badge>
				}
			>
				<PropertyList>
					<PropertyList.Item label={t("page.monitor.ssl.expiresAt")} empty="—">
						{monitor.ssl_expires_at === null ? undefined : (
							<>
								{formatDate(new Date(monitor.ssl_expires_at), { locale, timeZone: "UTC" })}
								{daysUntilExpiry === null ? null : (
									<span mix={[fg("neutral.muted")]}>
										{" · "}
										{t("page.monitor.ssl.expiresIn", { days: daysUntilExpiry })}
									</span>
								)}
							</>
						)}
					</PropertyList.Item>
					<PropertyList.Item label={t("page.monitor.ssl.issuer")} empty="—">
						{monitor.ssl_issuer ?? undefined}
					</PropertyList.Item>
					<PropertyList.Item label={t("page.monitor.ssl.lastChecked")} empty="—">
						{monitor.ssl_last_checked_at === null ? undefined : (
							<RelativeTime date={monitor.ssl_last_checked_at} locale={locale} local />
						)}
					</PropertyList.Item>
				</PropertyList>
				<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
					{t(`page.monitor.ssl.certificate.${certificateSource(monitor)}`)}
				</p>
				<div>{configure}</div>
			</Section>
		);
	};
}
