/**
 * Edit HTTP monitor page controller: general settings form (posts to
 * `update-monitor`), the content-checks section, and the SSL monitoring settings
 * form. Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong
 * to the current team.
 *
 * The content-checks table is `@pkg/r3-ui`'s `Table` compound, and every delete
 * confirmation (a content check's own, and the monitor's own danger-zone one) is
 * `@pkg/r3-ui`'s `AlertDialog` composed directly rather than through the `Confirm`
 * convenience wrapper, since the confirming control in each case is a real
 * `<form method="post">` submit button rather than a `command="close"` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { notFound } from "@pkg/http/response/html";
import { AlertDialog, Select, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import { flex, gap, items } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { mbe, p } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { fontSize, textDecoration } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { SelectMonitor, SelectMonitorContentCheck } from "~/database/schema";

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import MonitorFormFields from "~/resources/views/monitors/form";
import routes from "~/routes/web";

/** Translates a content check's `type` into its display label, aliasing `not_contains` to the `notContains` key. */
function contentCheckTypeLabel(
	i18next: ReturnType<typeof getContext>["i18next"],
	type: SelectMonitorContentCheck["type"],
): string {
	return i18next.t(`contentMonitoring.types.${type === "not_contains" ? "notContains" : type}`);
}

namespace ContentChecksSection {
	export interface Props {
		team: { slug: string };
		monitorId: string;
		contentChecks: SelectMonitorContentCheck[];
		i18next: ReturnType<typeof getContext>["i18next"];
	}
}

/** Renders the monitor's existing content checks (each with its own delete-confirmation dialog) plus a form to add a new one, capped at 10 checks. */
function ContentChecksSection(handle: Handle<ContentChecksSection.Props>) {
	return () => {
		let { team, monitorId, contentChecks, i18next } = handle.props;
		let deleteAction = routes.actions.monitor.http.deleteContentCheck.href({ team: team.slug });

		return (
			<div>
				<h2>{i18next.t("contentMonitoring.title")}</h2>
				<p
					mix={[
						fontSize("0.8125rem"),
						fg(neutral[500]),
						media("(prefers-color-scheme: dark)", fg(neutral[400])),
					]}
				>
					{i18next.t("contentMonitoring.description")}
				</p>

				{contentChecks.length > 0 && (
					<Table.Container>
						<Table aria-label={i18next.t("contentMonitoring.title")}>
							<Table.Header>
								<Table.Row>
									<Table.Column>{i18next.t("contentMonitoring.item.type")}</Table.Column>
									<Table.Column>{i18next.t("contentMonitoring.form.value.label")}</Table.Column>
									<Table.Column>{i18next.t("contentMonitoring.item.caseSensitive")}</Table.Column>
									<Table.Column>{i18next.t("contentMonitoring.item.status")}</Table.Column>
									<Table.Column></Table.Column>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{contentChecks.map((check) => {
									let dialogId = `delete-content-check-${check.id}`;
									let titleId = `${dialogId}-title`;

									return (
										<Table.Row key={check.id}>
											<Table.Cell>{contentCheckTypeLabel(i18next, check.type)}</Table.Cell>
											<Table.Cell>
												<code>{check.value}</code>
											</Table.Cell>
											<Table.Cell>
												{check.case_sensitive
													? i18next.t("contentMonitoring.item.yes")
													: i18next.t("contentMonitoring.item.no")}
											</Table.Cell>
											<Table.Cell>
												{check.is_enabled
													? i18next.t("contentMonitoring.item.enabled")
													: i18next.t("contentMonitoring.item.disabled")}
											</Table.Cell>
											<Table.Cell>
												<Button
													type="button"
													color="danger"
													commandfor={dialogId}
													command="show-modal"
												>
													{i18next.t("contentMonitoring.item.delete")}
												</Button>

												<AlertDialog id={dialogId} aria-labelledby={titleId}>
													<AlertDialog.Header>
														<AlertDialog.Title id={titleId}>
															{i18next.t("contentMonitoring.item.deleteConfirmTitle")}
														</AlertDialog.Title>
													</AlertDialog.Header>
													<form method="post" action={deleteAction}>
														<input type="hidden" name="_method" value="DELETE" />
														<input type="hidden" name="content_check_id" value={check.id} />
														<input type="hidden" name="monitor_id" value={monitorId} />
														<AlertDialog.Footer>
															<AlertDialog.Cancel type="button" commandfor={dialogId}>
																{i18next.t("contentMonitoring.form.cancel")}
															</AlertDialog.Cancel>
															<Button type="submit" color="danger">
																{i18next.t("contentMonitoring.item.delete")}
															</Button>
														</AlertDialog.Footer>
													</form>
												</AlertDialog>
											</Table.Cell>
										</Table.Row>
									);
								})}
							</Table.Body>
						</Table>
					</Table.Container>
				)}

				<form
					method="post"
					action={routes.actions.monitor.http.createContentCheck.href({ team: team.slug })}
				>
					<input type="hidden" name="monitor_id" value={monitorId} />

					<Field label={i18next.t("contentMonitoring.form.checkType.label")}>
						<Select name="type" defaultValue="contains">
							<Select.Option value="contains">
								{i18next.t("contentMonitoring.form.checkType.options.contains")}
							</Select.Option>
							<Select.Option value="not_contains">
								{i18next.t("contentMonitoring.form.checkType.options.notContains")}
							</Select.Option>
							<Select.Option value="regex">
								{i18next.t("contentMonitoring.form.checkType.options.regex")}
							</Select.Option>
						</Select>
					</Field>

					<Field label={i18next.t("contentMonitoring.form.value.label")}>
						<input
							type="text"
							name="value"
							required
							mix={[
								p("8px", "12px"),
								rounded("6px"),
								border({ color: neutral[200], width: 1 }),
								fontSize("0.875rem"),
								raw({ fontFamily: "inherit" }),
								bg(neutral[50]),
								fg("inherit"),
								media("(prefers-color-scheme: dark)", [border(neutral[700]), bg(neutral[900])]),
							]}
						/>
					</Field>

					<label mix={[flex(), items("center"), gap("8px"), mbe("16px"), fontSize("0.875rem")]}>
						<input type="checkbox" name="case_sensitive" value="true" />
						<span>{i18next.t("contentMonitoring.form.caseSensitive")}</span>
					</label>

					<Button type="submit" variant="outline">
						{i18next.t("contentMonitoring.form.add")}
					</Button>
				</form>
			</div>
		);
	};
}

namespace SslSettingsSection {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		i18next: ReturnType<typeof getContext>["i18next"];
	}
}

/** Renders the SSL monitoring toggle plus manually-entered expiry date/issuer/warning-threshold fields, pre-filled from `monitor`. */
function SslSettingsSection(handle: Handle<SslSettingsSection.Props>) {
	return () => {
		let { team, monitor, i18next } = handle.props;
		let expiresAtValue = monitor.ssl_expires_at
			? new Date(monitor.ssl_expires_at).toISOString().slice(0, 10)
			: "";

		return (
			<div>
				<h2>{i18next.t("page.editMonitor.ssl.title")}</h2>
				<form
					method="post"
					action={routes.actions.monitor.http.updateSsl.href({ team: team.slug })}
				>
					<input type="hidden" name="monitor_id" value={monitor.id} />

					<label mix={[flex(), items("center"), gap("8px"), mbe("16px"), fontSize("0.875rem")]}>
						<input
							type="checkbox"
							name="ssl_monitoring_enabled"
							value="true"
							defaultChecked={monitor.ssl_monitoring_enabled}
						/>
						<span>{i18next.t("page.editMonitor.form.fields.ssl.enabled.label")}</span>
					</label>

					<Field label={i18next.t("page.editMonitor.form.fields.ssl.expiresAt.label")}>
						<input
							type="date"
							name="ssl_expires_at"
							defaultValue={expiresAtValue}
							mix={[
								p("8px", "12px"),
								rounded("6px"),
								border({ color: neutral[200], width: 1 }),
								fontSize("0.875rem"),
								raw({ fontFamily: "inherit" }),
								bg(neutral[50]),
								fg("inherit"),
								media("(prefers-color-scheme: dark)", [border(neutral[700]), bg(neutral[900])]),
							]}
						/>
					</Field>

					<Field label={i18next.t("page.editMonitor.form.fields.ssl.issuer.label")}>
						<input
							type="text"
							name="ssl_issuer"
							defaultValue={monitor.ssl_issuer ?? ""}
							mix={[
								p("8px", "12px"),
								rounded("6px"),
								border({ color: neutral[200], width: 1 }),
								fontSize("0.875rem"),
								raw({ fontFamily: "inherit" }),
								bg(neutral[50]),
								fg("inherit"),
								media("(prefers-color-scheme: dark)", [border(neutral[700]), bg(neutral[900])]),
							]}
						/>
					</Field>

					<Field label={i18next.t("page.editMonitor.form.fields.ssl.warningDays.label")}>
						<input
							type="number"
							name="ssl_expiry_warning_days"
							min={1}
							max={365}
							defaultValue={monitor.ssl_expiry_warning_days}
							mix={[
								p("8px", "12px"),
								rounded("6px"),
								border({ color: neutral[200], width: 1 }),
								fontSize("0.875rem"),
								raw({ fontFamily: "inherit" }),
								bg(neutral[50]),
								fg("inherit"),
								media("(prefers-color-scheme: dark)", [border(neutral[700]), bg(neutral[900])]),
							]}
						/>
					</Field>

					<Button type="submit">{i18next.t("page.editMonitor.ssl.cta")}</Button>
				</form>
			</div>
		);
	};
}

/** GET /app/:team/monitors/:monitorId/edit — a monitor's edit form. */
export default createAction(routes.app.team.monitors.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let contentChecks = await ContentCheck.listByMonitor(db, monitor.id);

		let deleteMonitorTitleId = "delete-monitor-title";
		let deleteMonitorDescriptionId = "delete-monitor-description";

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.editMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: monitor.name,
							href: routes.app.team.monitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							}),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.http.update.href({ team: ctx.team.slug })}
						>
							<input type="hidden" name="monitor_id" value={monitor.id} />
							<MonitorFormFields monitor={monitor} i18next={ctx.i18next} page="editMonitor" />
							<Button type="submit">{ctx.i18next.t("page.editMonitor.form.cta")}</Button>
						</form>

						<a
							href={routes.app.team.monitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							mix={[
								fg(primary[600]),
								textDecoration("none"),
								hover(textDecoration("underline")),
								media("(prefers-color-scheme: dark)", fg(primary[400])),
							]}
						>
							{ctx.i18next.t("page.editMonitor.form.cancel")}
						</a>

						<ContentChecksSection
							team={ctx.team}
							monitorId={monitor.id}
							contentChecks={contentChecks}
							i18next={ctx.i18next}
						/>

						<SslSettingsSection team={ctx.team} monitor={monitor} i18next={ctx.i18next} />

						<h2>{ctx.i18next.t("page.editMonitor.dangerZone.title")}</h2>
						<Button type="button" color="danger" commandfor="delete-monitor" command="show-modal">
							{ctx.i18next.t("page.editMonitor.dangerZone.delete")}
						</Button>
						<AlertDialog
							id="delete-monitor"
							aria-labelledby={deleteMonitorTitleId}
							aria-describedby={deleteMonitorDescriptionId}
						>
							<AlertDialog.Header>
								<AlertDialog.Title id={deleteMonitorTitleId}>
									{ctx.i18next.t("page.httpMonitors.table.confirmation.delete", {
										name: monitor.name,
									})}
								</AlertDialog.Title>
								<AlertDialog.Description id={deleteMonitorDescriptionId}>
									{ctx.i18next.t("page.httpMonitors.table.confirmation.deleteDescription")}
								</AlertDialog.Description>
							</AlertDialog.Header>
							<form
								method="post"
								action={routes.actions.monitor.http.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<AlertDialog.Footer>
									<AlertDialog.Cancel type="button" commandfor="delete-monitor">
										{ctx.i18next.t("page.editMonitor.form.cancel")}
									</AlertDialog.Cancel>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.httpMonitors.table.actions.delete")}
									</Button>
								</AlertDialog.Footer>
							</form>
						</AlertDialog>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
