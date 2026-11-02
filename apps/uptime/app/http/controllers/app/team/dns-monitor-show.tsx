/**
 * DNS monitor detail page controller. Draws the monitor's streamed results, uptime history,
 * tracked records and check log beside its configuration and registration, with the check,
 * edit, review and delete actions in the page header. 404s for another team's monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemanticColor } from "@sdxc/ui/utils";

import { notFound } from "@sdxc/http/response/html";
import { EllipsisIcon, PencilIcon, PlayIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { fontSize, nowrap, overflowWrap, weight } from "@sdxc/u/typography";
import {
	Badge,
	Button,
	Confirm,
	LinkButton,
	Menu,
	PropertyList,
	RelativeTime,
	StatusDot,
} from "@sdxc/ui";
import { Empty, StatCard, Table } from "@sdxc/ui/app";
import { menuKeys } from "@sdxc/ui/mixins";
import { css, Frame } from "remix/component";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { SelectDnsMonitor, SelectDnsMonitorRecord } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import { hiddenByRegistry } from "~/app/services/domain-registration";
import { badgeVariant } from "~/resources/components/badge";
import RegistrationBadge from "~/resources/components/registration-badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The dot color each sweep outcome is drawn in; a monitor never checked reads neutral. */
const STATUS_COLOR: Record<string, SemanticColor> = {
	ok: "success",
	changed: "warning",
	error: "danger",
};

/** `id` shared between the overflow menu and the button that opens it. */
const ACTIONS_MENU_ID = "dns-monitor-actions";

/** `id` shared between the overflow menu's Delete item and the confirmation it opens. */
const DELETE_DIALOG_ID = "delete-dns-monitor";

/**
 * The sentence explaining why there is no current registration data, keyed by the last
 * lookup's error: the two answers about the name each name their own fix, and every other
 * failure is an outage retried on its own. `null` when the last lookup succeeded.
 */
function registrationReasonKey(monitor: SelectDnsMonitor): string | null {
	if (monitor.registration_error === null) return null;
	if (monitor.registration_error === "not-found") return "notFound";
	if (monitor.registration_error === "unsupported-tld") return "unsupportedTld";
	return "failing";
}

/**
 * A disabled record reads neutral, since nobody has committed to watching it, so
 * whatever it currently looks like is expected. A `new` record keeps the attention
 * tone regardless, since it still awaits a person's decision to watch or delete it.
 */
function recordStateTone(record: SelectDnsMonitorRecord): BadgeTone {
	if (record.status === "new") return "degraded";
	if (record.status === "error") return "down";
	if (!record.is_enabled) return "neutral";
	if (record.status === "missing") return "down";
	if (record.status === "changed") return "degraded";
	return "up";
}

/**
 * GET /app/:team/dns/:monitorId — a DNS monitor's detail page.
 *
 * Records arrive already ordered by name, then type, then value, matching the table's
 * display grouping, so edits within one RRset appear together. Delete sits last in the
 * overflow menu and appears only for a member allowed to delete monitors.
 */
export default createAction(routes.app.team.dnsMonitors.show, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first();
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.dnsMonitors.delete);
		let canDelete = ctx.access.can(abilities.dnsMonitors.delete);

		let records = await ctx.models.dnsMonitorRecords.listByMonitor(monitor.id);
		let watchedCount = records.filter((record) => record.is_enabled).length;
		let registrationReason = registrationReasonKey(monitor);
		let monitorParams = { team: ctx.team.slug, monitorId: monitor.id };
		let statusColor = STATUS_COLOR[monitor.last_status ?? ""] ?? "neutral";
		let statusLabel =
			monitor.last_status === null
				? ctx.intl.t("page.dnsMonitorDetail.notChecked")
				: ctx.intl.t(`page.dnsMonitorDetail.records.state.${monitor.last_status}`);

		/** Names the registry chose to withhold, so a blank reads as hidden rather than unpublished. */
		let withheld = (fields: Parameters<typeof hiddenByRegistry>[1]) =>
			ctx.intl.t(
				hiddenByRegistry(monitor.registration_redacted, fields)
					? "page.dnsMonitorDetail.registration.hiddenByRegistry"
					: "page.dnsMonitorDetail.registration.notPublished",
			);

		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={ctx.intl.t("app.titles.record", { team: ctx.team.name, name: monitor.name })}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.dnsMonitorDetail.header.title", { name: monitor.name })}
					description={<code>{monitor.domain}</code>}
					status={<StatusDot color={statusColor}>{statusLabel}</StatusDot>}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
					overflow={
						<>
							<Button
								type="button"
								variant="ghost"
								color="neutral"
								size="sm"
								commandfor={ACTIONS_MENU_ID}
								command="toggle-popover"
								aria-label={ctx.intl.t("page.dnsMonitorDetail.overflow.label")}
							>
								<EllipsisIcon size={16} aria-hidden="true" />
							</Button>
							<Menu
								id={ACTIONS_MENU_ID}
								placement="bottom-end"
								aria-label={ctx.intl.t("page.dnsMonitorDetail.overflow.label")}
								mix={[menuKeys()]}
							>
								<Menu.Item href={routes.app.team.dnsMonitors.review.href(monitorParams)}>
									{ctx.intl.t("page.dnsMonitorDetail.overflow.review")}
								</Menu.Item>
								<Menu.Item href={routes.app.team.dnsMonitors.show.href(monitorParams)}>
									{ctx.intl.t("page.dnsMonitorDetail.header.action.refresh")}
								</Menu.Item>
								{canDelete && (
									<>
										<Menu.Separator />
										<Menu.Item danger commandfor={DELETE_DIALOG_ID} command="show-modal">
											{ctx.intl.t("page.dnsMonitors.table.actions.delete")}
										</Menu.Item>
									</>
								)}
							</Menu>
						</>
					}
					actions={
						<LinkButton
							variant="outline"
							size="sm"
							href={routes.app.team.dnsMonitors.edit.href(monitorParams)}
						>
							<PencilIcon size={16} strokeWidth={1.5} />
							{ctx.intl.t("page.dnsMonitorDetail.header.action.edit")}
						</LinkButton>
					}
					primaryAction={
						<form
							method="post"
							action={routes.actions.monitor.dns.check.href({ team: ctx.team.slug })}
							mix={[m("0")]}
						>
							<input type="hidden" name="monitor_id" value={monitor.id} />
							<Button type="submit" size="sm">
								<PlayIcon size={16} strokeWidth={1.5} />
								{ctx.intl.t("page.dnsMonitorDetail.header.action.check")}
							</Button>
						</form>
					}
				>
					<div
						mix={[
							css({
								display: "grid",
								gap: "2rem",
								gridTemplateColumns: "minmax(0, 1fr)",
								alignItems: "start",
								"@media (min-width: 72rem)": {
									gridTemplateColumns: "minmax(0, 1fr) minmax(16rem, 22rem)",
								},
							}),
						]}
					>
						<div mix={[vstack({ gap: 8 })]}>
							<Frame
								name="dns-monitor-card-results"
								src={routes.app.team.dnsMonitors.cards.results.href(monitorParams)}
								fallback={
									<StatCard.Group columns={2} aria-busy="true">
										<StatCard.Skeleton
											label={ctx.intl.t("page.dnsMonitorDetail.stats.successRate.label")}
											delta={false}
											footer={false}
										/>
										<StatCard.Skeleton
											label={ctx.intl.t("page.dnsMonitorDetail.stats.totalChecks.label")}
											delta={false}
											footer={false}
										/>
									</StatCard.Group>
								}
							/>

							<Frame
								name="dns-monitor-card-uptime-history"
								src={routes.app.team.dnsMonitors.cards.uptimeHistory.href(monitorParams)}
								fallback={
									<StatCard.Group columns={1} aria-busy="true">
										<StatCard.Skeleton delta={false} />
									</StatCard.Group>
								}
							/>

							<section mix={[vstack({ gap: 3 })]}>
								<div mix={[vstack({ gap: 1 })]}>
									<h2 mix={[m(0), fontSize("md"), weight("semibold")]}>
										{ctx.intl.t("page.dnsMonitorDetail.records.title")}
									</h2>
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.intl.t("page.dnsMonitorDetail.records.description")}
									</p>
								</div>

								{records.length === 0 ? (
									<Empty size="compact">
										<Empty.Description>
											{ctx.intl.t("page.dnsMonitorDetail.records.empty")}
										</Empty.Description>
									</Empty>
								) : (
									<Table.Container>
										<Table aria-label={ctx.intl.t("page.dnsMonitorDetail.records.title")}>
											<Table.Header>
												<Table.Row>
													<Table.Column>
														{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.name")}
													</Table.Column>
													<Table.Column>
														{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.type")}
													</Table.Column>
													<Table.Column>
														{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.value")}
													</Table.Column>
													<Table.Column>
														{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.source")}
													</Table.Column>
													<Table.Column>
														{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.state")}
													</Table.Column>
													<Table.Column mix={[is("1%"), nowrap()]}>
														{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.watched")}
													</Table.Column>
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{records.map((record) => (
													<Table.Row key={record.id}>
														<Table.Cell>
															<code>{record.name}</code>
														</Table.Cell>
														<Table.Cell>{record.record_type}</Table.Cell>
														<Table.Cell>
															<code mix={[overflowWrap("anywhere")]}>{record.value}</code>
														</Table.Cell>
														<Table.Cell>
															{ctx.intl.t(`page.dnsMonitorDetail.records.source.${record.source}`)}
														</Table.Cell>
														<Table.Cell>
															<Badge {...badgeVariant(recordStateTone(record))}>
																{ctx.intl.t(`page.dnsMonitorDetail.records.state.${record.status}`)}
															</Badge>
														</Table.Cell>
														<Table.Cell mix={[is("1%"), nowrap()]}>
															<form
																method="post"
																action={routes.actions.monitor.dns.toggleRecord.href({
																	team: ctx.team.slug,
																})}
																mix={[m("0")]}
															>
																<input type="hidden" name="monitor_id" value={monitor.id} />
																<input type="hidden" name="record_id" value={record.id} />
																<input
																	type="hidden"
																	name="is_enabled"
																	value={record.is_enabled ? "false" : "true"}
																/>
																<Button type="submit" variant="outline" size="sm">
																	{record.is_enabled
																		? ctx.intl.t("page.dnsMonitorDetail.records.actions.disable")
																		: ctx.intl.t("page.dnsMonitorDetail.records.actions.enable")}
																</Button>
															</form>
														</Table.Cell>
													</Table.Row>
												))}
											</Table.Body>
										</Table>
									</Table.Container>
								)}
							</section>

							<Frame
								name="dns-monitor-card-check-history"
								src={routes.app.team.dnsMonitors.cards.checkHistory.href(monitorParams)}
								fallback={
									<StatCard.Group columns={1} aria-busy="true">
										<StatCard.Skeleton delta={false} />
									</StatCard.Group>
								}
							/>
						</div>

						<aside mix={[vstack({ gap: 8 })]}>
							<section mix={[vstack({ gap: 3 })]}>
								<h2 mix={[m(0), fontSize("md"), weight("semibold")]}>
									{ctx.intl.t("page.dnsMonitorDetail.configuration")}
								</h2>
								<PropertyList>
									<PropertyList.Item label={ctx.intl.t("page.dnsMonitorDetail.info.domain")}>
										<code>{monitor.domain}</code>
									</PropertyList.Item>
									<PropertyList.Item label={ctx.intl.t("page.dnsMonitorDetail.info.status")}>
										<StatusDot color={statusColor}>{statusLabel}</StatusDot>
									</PropertyList.Item>
									<PropertyList.Item
										label={ctx.intl.t("page.dnsMonitorDetail.info.recordsWatched")}
									>
										{ctx.intl.t("page.dnsMonitorDetail.info.recordsWatchedValue", {
											enabled: watchedCount,
											total: records.length,
										})}
									</PropertyList.Item>
									<PropertyList.Item
										label={ctx.intl.t("page.dnsMonitorDetail.info.zoneFileImported")}
									>
										{monitor.zone_file_imported_at === null ? (
											ctx.intl.t("page.dnsMonitorDetail.info.zoneFileNeverImported")
										) : (
											<RelativeTime
												date={monitor.zone_file_imported_at}
												locale={ctx.locale}
												local
											/>
										)}
									</PropertyList.Item>
								</PropertyList>
							</section>

							<section mix={[vstack({ gap: 3 })]}>
								<div mix={[vstack({ gap: 1 })]}>
									<h2 mix={[m(0), fontSize("md"), weight("semibold")]}>
										{ctx.intl.t("page.dnsMonitorDetail.registration.title")}
									</h2>
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.intl.t("page.dnsMonitorDetail.registration.description", {
											days: monitor.registration_warning_days,
										})}
									</p>
								</div>

								<PropertyList>
									<PropertyList.Item
										label={ctx.intl.t("page.dnsMonitorDetail.registration.status")}
									>
										<RegistrationBadge status={monitor.registration_status} intl={ctx.intl} />
									</PropertyList.Item>
									<PropertyList.Item
										label={ctx.intl.t("page.dnsMonitorDetail.registration.expiresAt")}
									>
										{monitor.registration_expires_at === null ? (
											ctx.intl.t("page.dnsMonitorDetail.registration.notPublished")
										) : (
											<RelativeTime
												date={monitor.registration_expires_at}
												locale={ctx.locale}
												local
											/>
										)}
									</PropertyList.Item>
									<PropertyList.Item
										label={ctx.intl.t("page.dnsMonitorDetail.registration.registrar")}
									>
										{monitor.registrar ?? withheld(["registrar.name", "registrar.organization"])}
									</PropertyList.Item>
									<PropertyList.Item
										label={ctx.intl.t("page.dnsMonitorDetail.registration.registrant")}
									>
										{monitor.registrant ?? withheld(["registrant.name", "registrant.organization"])}
									</PropertyList.Item>
									<PropertyList.Item
										label={ctx.intl.t("page.dnsMonitorDetail.registration.checkedAt")}
									>
										{monitor.registration_checked_at === null ? (
											ctx.intl.t("page.dnsMonitorDetail.registration.never")
										) : (
											<RelativeTime
												date={monitor.registration_checked_at}
												locale={ctx.locale}
												local
											/>
										)}
									</PropertyList.Item>
									{monitor.registration_epp_statuses &&
									monitor.registration_epp_statuses.length > 0 ? (
										<PropertyList.Item
											label={ctx.intl.t("page.dnsMonitorDetail.registration.eppStatuses")}
										>
											<div mix={[flex(), flexWrap(), gap("4px")]}>
												{monitor.registration_epp_statuses.map((status) => (
													<Badge key={status} {...badgeVariant("neutral")}>
														<code>{status}</code>
													</Badge>
												))}
											</div>
										</PropertyList.Item>
									) : null}
								</PropertyList>

								{registrationReason === null ? null : (
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.intl.t(
											`page.dnsMonitorDetail.registration.reasons.${registrationReason}`,
											{
												code: monitor.registration_error ?? "",
											},
										)}
									</p>
								)}
							</section>
						</aside>
					</div>

					{canDelete && (
						<Confirm
							id={DELETE_DIALOG_ID}
							color="danger"
							title={ctx.intl.t("app.confirm.deleteDnsMonitor.title", {
								name: monitor.name,
							})}
							description={ctx.intl.t("page.editDnsMonitor.dangerZone.deleteDescription")}
							confirmLabel={ctx.intl.t("app.confirm.deleteMonitor.action")}
							cancelLabel={ctx.intl.t("page.editDnsMonitor.form.cancel")}
							form={{
								action: routes.actions.monitor.dns.delete.href({ team: ctx.team.slug }),
								method: "post",
								fields: (
									<>
										<input type="hidden" name="_method" value="DELETE" />
										<input type="hidden" name="monitor_id" value={monitor.id} />
									</>
								),
							}}
						/>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
