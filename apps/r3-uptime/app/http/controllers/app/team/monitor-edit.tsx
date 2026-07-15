/**
 * Edit HTTP monitor page controller: general settings form (posts to
 * `update-monitor`), the content-checks section, and the SSL monitoring settings
 * form. Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong
 * to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import type { SelectMonitor, SelectMonitorContentCheck } from "~/database/schema";

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import Field from "~/resources/components/field";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { mixForSelect } from "~/resources/mix-for-select";
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
						css({
							fontSize: "0.8125rem",
							color: neutral[500],
							"@media (prefers-color-scheme: dark)": { color: neutral[400] },
						}),
					]}
				>
					{i18next.t("contentMonitoring.description")}
				</p>

				{contentChecks.length > 0 && (
					<div mix={[css({ overflowX: "auto" })]}>
						<table
							mix={[
								css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.875rem",
									"& th, & td": {
										textAlign: "left",
										padding: "12px 16px",
										borderBottom: `1px solid ${neutral[200]}`,
									},
									"@media (prefers-color-scheme: dark)": {
										"& th, & td": { borderColor: neutral[800] },
									},
								}),
							]}
						>
							<thead>
								<tr>
									<th>Type</th>
									<th>{i18next.t("contentMonitoring.form.value.label")}</th>
									<th>{i18next.t("contentMonitoring.item.caseSensitive")}</th>
									<th>Status</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{contentChecks.map((check) => (
									<tr key={check.id}>
										<td>{contentCheckTypeLabel(i18next, check.type)}</td>
										<td>
											<code>{check.value}</code>
										</td>
										<td>{check.case_sensitive ? "Yes" : "No"}</td>
										<td>{check.is_enabled ? "Enabled" : "Disabled"}</td>
										<td>
											<Button
												type="button"
												color="danger"
												commandfor={`delete-content-check-${check.id}`}
												command="show-modal"
											>
												{i18next.t("contentMonitoring.item.delete")}
											</Button>

											<dialog
												id={`delete-content-check-${check.id}`}
												mix={[
													css({
														padding: 24,
														borderRadius: 8,
														border: `1px solid ${neutral[300]}`,
														maxWidth: 400,
														"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
														"@media (prefers-color-scheme: dark)": {
															borderColor: neutral[700],
															background: neutral[900],
															color: neutral[50],
														},
													}),
												]}
											>
												<h3>Delete this content check?</h3>
												<form method="post" action={deleteAction}>
													<input type="hidden" name="_method" value="DELETE" />
													<input type="hidden" name="content_check_id" value={check.id} />
													<input type="hidden" name="monitor_id" value={monitorId} />
													<div mix={[css({ display: "flex", gap: 8, justifyContent: "flex-end" })]}>
														<Button
															type="button"
															variant="outline"
															commandfor={`delete-content-check-${check.id}`}
															command="close"
														>
															{i18next.t("contentMonitoring.form.cancel")}
														</Button>
														<Button type="submit" color="danger">
															{i18next.t("contentMonitoring.item.delete")}
														</Button>
													</div>
												</form>
											</dialog>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<form
					method="post"
					action={routes.actions.monitor.http.createContentCheck.href({ team: team.slug })}
				>
					<input type="hidden" name="monitor_id" value={monitorId} />

					<Field label={i18next.t("contentMonitoring.form.checkType.label")}>
						<select
							name="type"
							defaultValue="contains"
							mix={[
								mixForSelect(
									css({
										padding: "8px 12px",
										borderRadius: 6,
										border: `1px solid ${neutral[200]}`,
										fontSize: "0.875rem",
										fontFamily: "inherit",
										background: neutral[50],
										color: "inherit",
										"@media (prefers-color-scheme: dark)": {
											borderColor: neutral[700],
											background: neutral[900],
										},
									}),
								),
							]}
						>
							<option value="contains">
								{i18next.t("contentMonitoring.form.checkType.options.contains")}
							</option>
							<option value="not_contains">
								{i18next.t("contentMonitoring.form.checkType.options.notContains")}
							</option>
							<option value="regex">
								{i18next.t("contentMonitoring.form.checkType.options.regex")}
							</option>
						</select>
					</Field>

					<Field label={i18next.t("contentMonitoring.form.value.label")}>
						<input
							type="text"
							name="value"
							required
							mix={[
								css({
									padding: "8px 12px",
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
							]}
						/>
					</Field>

					<label
						mix={[
							css({
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginBottom: 16,
								fontSize: "0.875rem",
							}),
						]}
					>
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
				<h2>SSL certificate monitoring</h2>
				<form
					method="post"
					action={routes.actions.monitor.http.updateSsl.href({ team: team.slug })}
				>
					<input type="hidden" name="monitor_id" value={monitor.id} />

					<label
						mix={[
							css({
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginBottom: 16,
								fontSize: "0.875rem",
							}),
						]}
					>
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
								css({
									padding: "8px 12px",
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
							]}
						/>
					</Field>

					<Field label={i18next.t("page.editMonitor.form.fields.ssl.issuer.label")}>
						<input
							type="text"
							name="ssl_issuer"
							defaultValue={monitor.ssl_issuer ?? ""}
							mix={[
								css({
									padding: "8px 12px",
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
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
								css({
									padding: "8px 12px",
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
							]}
						/>
					</Field>

					<Button type="submit">Save SSL settings</Button>
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
					<div>
						<form
							method="post"
							action={routes.actions.monitor.http.update.href({ team: ctx.team.slug })}
						>
							<input type="hidden" name="monitor_id" value={monitor.id} />
							<MonitorFormFields monitor={monitor} />
							<Button type="submit">{ctx.i18next.t("page.editMonitor.form.cta")}</Button>
						</form>

						<a
							href={routes.app.team.monitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							mix={[
								css({
									color: primary[600],
									textDecoration: "none",
									"&:hover": { textDecoration: "underline" },
									"@media (prefers-color-scheme: dark)": { color: primary[400] },
								}),
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

						<h2>Danger zone</h2>
						<Button type="button" color="danger" commandfor="delete-monitor" command="show-modal">
							Delete monitor
						</Button>
						<dialog
							id="delete-monitor"
							mix={[
								css({
									padding: 24,
									borderRadius: 8,
									border: `1px solid ${neutral[300]}`,
									maxWidth: 400,
									"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
										color: neutral[50],
									},
								}),
							]}
						>
							<h3>
								{ctx.i18next.t("page.httpMonitors.table.confirmation.delete", {
									name: monitor.name,
								})}
							</h3>
							<p
								mix={[
									css({
										fontSize: "0.8125rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								This also deletes its content checks and check-result history. This can't be undone.
							</p>
							<form
								method="post"
								action={routes.actions.monitor.http.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<div mix={[css({ display: "flex", gap: 8, justifyContent: "flex-end" })]}>
									<Button
										type="button"
										variant="outline"
										commandfor="delete-monitor"
										command="close"
									>
										{ctx.i18next.t("page.editMonitor.form.cancel")}
									</Button>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.httpMonitors.table.actions.delete")}
									</Button>
								</div>
							</form>
						</dialog>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
