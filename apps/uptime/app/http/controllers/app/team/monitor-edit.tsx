/**
 * Edit HTTP monitor page controller: general settings, content checks, and
 * SSL monitoring settings. Requires `requireUser` + `requireTeam`; 404s when
 * the monitor doesn't belong to the current team.
 *
 * Each settings group is its own bordered card, posted through its own `<form>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { toDayKey } from "@sdxc/dates";
import { notFound } from "@sdxc/http/response/html";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, gap, items, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, LinkButton, Select, Table } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { SelectMonitor, SelectMonitorContentCheck } from "~/database/schema";

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MonitorFormFields from "~/resources/views/monitors/form";
import routes from "~/routes/web";

function contentCheckTypeLabel(
	intl: ReturnType<typeof getContext>["intl"],
	type: SelectMonitorContentCheck["type"],
): string {
	return intl.t(`contentMonitoring.types.${type === "not_contains" ? "notContains" : type}`);
}

namespace ContentChecksSection {
	export interface Props {
		team: { slug: string };
		monitorId: string;
		contentChecks: SelectMonitorContentCheck[];
		intl: ReturnType<typeof getContext>["intl"];
	}
}

/**
 * Renders the monitor's content checks, each with its own delete-confirmation
 * dialog, plus a form to add one (capped at 10). The type select marks its
 * default via `selected` since `<select>` carries no `defaultValue` attribute.
 */
function ContentChecksSection(handle: Handle<ContentChecksSection.Props>) {
	return () => {
		let { team, monitorId, contentChecks, intl } = handle.props;
		let deleteAction = routes.actions.monitor.http.deleteContentCheck.href({ team: team.slug });

		return (
			<SettingsSection
				id="content-monitoring"
				title={intl.t("contentMonitoring.title")}
				description={intl.t("contentMonitoring.description")}
			>
				<SettingsSection.Card>
					{contentChecks.length > 0 && (
						<div mix={[borderEdge("block-end", { color: "neutral", width: 1 })]}>
							<Table.Container>
								<Table aria-label={intl.t("contentMonitoring.title")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>{intl.t("contentMonitoring.item.type")}</Table.Column>
											<Table.Column>{intl.t("contentMonitoring.form.value.label")}</Table.Column>
											<Table.Column>{intl.t("contentMonitoring.item.caseSensitive")}</Table.Column>
											<Table.Column>{intl.t("contentMonitoring.item.status")}</Table.Column>
											<Table.Column></Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{contentChecks.map((check) => {
											let dialogId = `delete-content-check-${check.id}`;
											let titleId = `${dialogId}-title`;

											return (
												<Table.Row key={check.id}>
													<Table.Cell>{contentCheckTypeLabel(intl, check.type)}</Table.Cell>
													<Table.Cell>
														<code>{check.value}</code>
													</Table.Cell>
													<Table.Cell>
														{check.case_sensitive
															? intl.t("contentMonitoring.item.yes")
															: intl.t("contentMonitoring.item.no")}
													</Table.Cell>
													<Table.Cell>
														{check.is_enabled
															? intl.t("contentMonitoring.item.enabled")
															: intl.t("contentMonitoring.item.disabled")}
													</Table.Cell>
													<Table.Cell>
														<Button
															type="button"
															color="danger"
															commandfor={dialogId}
															command="show-modal"
														>
															{intl.t("contentMonitoring.item.delete")}
														</Button>

														<AlertDialog id={dialogId} aria-labelledby={titleId}>
															<AlertDialog.Header>
																<AlertDialog.Title id={titleId}>
																	{intl.t("contentMonitoring.item.deleteConfirmTitle")}
																</AlertDialog.Title>
															</AlertDialog.Header>
															<form method="post" action={deleteAction}>
																<input type="hidden" name="_method" value="DELETE" />
																<input type="hidden" name="content_check_id" value={check.id} />
																<input type="hidden" name="monitor_id" value={monitorId} />
																<AlertDialog.Footer>
																	<AlertDialog.Cancel type="button" commandfor={dialogId}>
																		{intl.t("contentMonitoring.form.cancel")}
																	</AlertDialog.Cancel>
																	<Button type="submit" color="danger">
																		{intl.t("contentMonitoring.item.delete")}
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
						</div>
					)}

					<form
						method="post"
						action={routes.actions.monitor.http.createContentCheck.href({ team: team.slug })}
					>
						<input type="hidden" name="monitor_id" value={monitorId} />

						<SettingsSection.Header
							title={intl.t("contentMonitoring.form.title")}
							description={intl.t("contentMonitoring.form.description")}
						/>

						<SettingsSection.Body>
							<Field label={intl.t("contentMonitoring.form.checkType.label")}>
								<Select name="type">
									<Select.Option value="contains" selected>
										{intl.t("contentMonitoring.form.checkType.options.contains")}
									</Select.Option>
									<Select.Option value="not_contains">
										{intl.t("contentMonitoring.form.checkType.options.notContains")}
									</Select.Option>
									<Select.Option value="regex">
										{intl.t("contentMonitoring.form.checkType.options.regex")}
									</Select.Option>
								</Select>
							</Field>

							<Field label={intl.t("contentMonitoring.form.value.label")}>
								<input
									type="text"
									name="value"
									required
									mix={[
										p("8px", "12px"),
										rounded("6px"),
										border({ color: "neutral.border", width: 1 }),
										fontSize("0.875rem"),
										font("inherit"),
										bg("neutral.tint"),
										fg("inherit"),
									]}
								/>
							</Field>

							<label mix={[flex(), items("center"), gap("8px"), fontSize("0.875rem")]}>
								<input type="checkbox" name="case_sensitive" value="true" />
								<span>{intl.t("contentMonitoring.form.caseSensitive")}</span>
							</label>
						</SettingsSection.Body>

						<SettingsSection.Footer>
							<Button type="submit" variant="outline">
								{intl.t("contentMonitoring.form.add")}
							</Button>
						</SettingsSection.Footer>
					</form>
				</SettingsSection.Card>
			</SettingsSection>
		);
	};
}

namespace SslSettingsSection {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		intl: ReturnType<typeof getContext>["intl"];
	}
}

/** Renders the SSL monitoring toggle plus manually-entered expiry date/issuer/warning-threshold fields, pre-filled from `monitor`. */
function SslSettingsSection(handle: Handle<SslSettingsSection.Props>) {
	return () => {
		let { team, monitor, intl } = handle.props;
		let expiresAtValue = monitor.ssl_expires_at
			? toDayKey(new Date(monitor.ssl_expires_at), "UTC")
			: "";

		return (
			<SettingsSection
				id="ssl"
				title={intl.t("page.editMonitor.ssl.title")}
				description={intl.t("page.editMonitor.ssl.description")}
			>
				<SettingsSection.Card>
					<form
						method="post"
						action={routes.actions.monitor.http.updateSsl.href({ team: team.slug })}
					>
						<input type="hidden" name="monitor_id" value={monitor.id} />

						<SettingsSection.Body>
							<label mix={[flex(), items("center"), gap("8px"), fontSize("0.875rem")]}>
								<input
									type="checkbox"
									name="ssl_monitoring_enabled"
									value="true"
									defaultChecked={monitor.ssl_monitoring_enabled}
								/>
								<span>{intl.t("page.editMonitor.form.fields.ssl.enabled.label")}</span>
							</label>

							<Field
								label={intl.t("page.editMonitor.form.fields.ssl.expiresAt.label")}
								description={intl.t("page.editMonitor.form.fields.ssl.expiresAt.description")}
							>
								<input
									type="date"
									name="ssl_expires_at"
									defaultValue={expiresAtValue}
									mix={[
										p("8px", "12px"),
										rounded("6px"),
										border({ color: "neutral.border", width: 1 }),
										fontSize("0.875rem"),
										font("inherit"),
										bg("neutral.tint"),
										fg("inherit"),
									]}
								/>
							</Field>

							<Field
								label={intl.t("page.editMonitor.form.fields.ssl.issuer.label")}
								description={intl.t("page.editMonitor.form.fields.ssl.issuer.description")}
							>
								<input
									type="text"
									name="ssl_issuer"
									defaultValue={monitor.ssl_issuer ?? ""}
									mix={[
										p("8px", "12px"),
										rounded("6px"),
										border({ color: "neutral.border", width: 1 }),
										fontSize("0.875rem"),
										font("inherit"),
										bg("neutral.tint"),
										fg("inherit"),
									]}
								/>
							</Field>

							<Field
								label={intl.t("page.editMonitor.form.fields.ssl.warningDays.label")}
								description={intl.t("page.editMonitor.form.fields.ssl.warningDays.description")}
							>
								<input
									type="number"
									name="ssl_expiry_warning_days"
									min={1}
									max={365}
									defaultValue={monitor.ssl_expiry_warning_days}
									mix={[
										p("8px", "12px"),
										rounded("6px"),
										border({ color: "neutral.border", width: 1 }),
										fontSize("0.875rem"),
										font("inherit"),
										bg("neutral.tint"),
										fg("inherit"),
									]}
								/>
							</Field>
						</SettingsSection.Body>

						<SettingsSection.Footer>
							<Button type="submit">{intl.t("page.editMonitor.ssl.cta")}</Button>
						</SettingsSection.Footer>
					</form>
				</SettingsSection.Card>
			</SettingsSection>
		);
	};
}

/** GET /app/:team/monitors/:monitorId/edit — a monitor's edit form. */
export default createAction(routes.app.team.monitors.edit, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let contentChecks = await ContentCheck.listByMonitor(ctx.db, monitor.id);

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
					intl={ctx.intl}
					heading={ctx.intl.t("page.editMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
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
						<div mix={[vstack({ gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.monitor.http.update.href({ team: ctx.team.slug })}
								mix={[vstack({ gap: 12 })]}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

								<SettingsSection
									id="basics"
									title={ctx.intl.t("page.editMonitor.form.sections.basics.title")}
									description={ctx.intl.t("page.editMonitor.form.sections.basics.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<MonitorFormFields
												monitor={monitor}
												intl={ctx.intl}
												page="editMonitor"
												group="basics"
											/>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="checks"
									title={ctx.intl.t("page.editMonitor.form.sections.checks.title")}
									description={ctx.intl.t("page.editMonitor.form.sections.checks.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<MonitorFormFields
												monitor={monitor}
												intl={ctx.intl}
												page="editMonitor"
												group="checks"
											/>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton
												variant="outline"
												href={routes.app.team.monitors.show.href({
													team: ctx.team.slug,
													monitorId: monitor.id,
												})}
											>
												{ctx.intl.t("page.editMonitor.form.cancel")}
											</LinkButton>
											<Button type="submit">{ctx.intl.t("page.editMonitor.form.cta")}</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							<ContentChecksSection
								team={ctx.team}
								monitorId={monitor.id}
								contentChecks={contentChecks}
								intl={ctx.intl}
							/>

							<SslSettingsSection team={ctx.team} monitor={monitor} intl={ctx.intl} />

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.intl.t("page.editMonitor.dangerZone.title")}
								description={ctx.intl.t("page.editMonitor.dangerZone.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.intl.t("page.editMonitor.dangerZone.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor="delete-monitor"
											command="show-modal"
										>
											{ctx.intl.t("page.editMonitor.dangerZone.delete")}
										</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>

							<AlertDialog
								id="delete-monitor"
								aria-labelledby={deleteMonitorTitleId}
								aria-describedby={deleteMonitorDescriptionId}
							>
								<AlertDialog.Header>
									<AlertDialog.Title id={deleteMonitorTitleId}>
										{ctx.intl.t("page.httpMonitors.table.confirmation.delete", {
											name: monitor.name,
										})}
									</AlertDialog.Title>
									<AlertDialog.Description id={deleteMonitorDescriptionId}>
										{ctx.intl.t("page.httpMonitors.table.confirmation.deleteDescription")}
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
											{ctx.intl.t("page.editMonitor.form.cancel")}
										</AlertDialog.Cancel>
										<Button type="submit" color="danger">
											{ctx.intl.t("page.httpMonitors.table.actions.delete")}
										</Button>
									</AlertDialog.Footer>
								</form>
							</AlertDialog>
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
