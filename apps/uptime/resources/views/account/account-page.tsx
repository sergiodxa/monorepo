/**
 * The account page: the viewer's profile, language, emails, teams, data export and account
 * deletion, laid out as a settings area inside the URL team's shell. Drawn by the account
 * route and again by the create-team action when it refuses a name, with that dialog open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { formatDate } from "@sdxc/dates";
import { PlusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, maxIs, minIs, p, pis } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { fontSize, pretty, textDecoration, weight } from "@sdxc/u/typography";
import { Alert, Button, Confirm, Dialog, Select, Switch, TextField } from "@sdxc/ui";
import { DangerZone, Empty, SettingsLayout, SettingsSection, Table } from "@sdxc/ui/app";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { AccountOverview } from "~/app/services/account-overview";
import type { OptionalEmail } from "~/database/schema";

import { EMAIL_PREFERENCES_ANCHOR } from "~/app/emails/shared/team-digest";
import { getViewer } from "~/app/http/middleware/auth";
import { fieldIssue, submittedText } from "~/app/http/validators/form-submission";
import { wantsEmail } from "~/app/models/user-preferences";
import { optionalEmails, supportedLanguages } from "~/database/schema";
import Avatar from "~/resources/components/avatar";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The phrase that unlocks account deletion, which the request-deletion action checks again. */
const DELETE_PHRASE = "DELETE";

/** The flash an account action left for this page, shown as one toast. */
export interface AccountToast {
	intent: "success" | "error";
	message: string;
}

/** DOM id of one email's switch, which its row's label points at. */
function emailSwitchId(email: OptionalEmail) {
	return `email-${email}`;
}

/** DOM id of one email's description, wired to its switch through `aria-describedby`. */
function emailDescriptionId(email: OptionalEmail) {
	return `email-${email}-description`;
}

export namespace AccountPage {
	export interface Props {
		/** What the page shows, read through `loadAccountOverview`. */
		overview: AccountOverview;
		/** The flash an account action left for this page, shown as one toast. */
		toast?: AccountToast;
		/** The team the create-team action refused, which opens its dialog on load. */
		createTeamSubmission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function AccountPage(handle: Handle<AccountPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { overview, toast, createTeamSubmission } = handle.props;
		let { memberships, preferences, plan, queuedDeletion } = overview;

		let t = ctx.intl.t;
		let preferredLanguage = preferences?.preferred_language ?? null;
		let cancelLabel = t("page.account.form.actions.cancel");
		let saveLabel = t("page.account.language.form.cta");

		let ownedTeamLines =
			plan.ownedTeams.length === 0
				? [t("page.account.deleteAccount.card.noOwnedTeams")]
				: plan.ownedTeams.map((team) =>
						team.otherMemberCount === 0
							? t("page.account.deleteAccount.card.ownedTeamAlone", { name: team.name })
							: t("page.account.deleteAccount.card.ownedTeam", {
									name: team.name,
									count: team.otherMemberCount,
								}),
					);

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${t("page.account.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.account.href({ team: ctx.team.slug })}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={t("page.account.header.title")}
					toast={toast}
				>
					<SettingsLayout
						sections={[
							{
								items: [
									{ href: "#profile", label: t("page.account.profile.title") },
									{ href: "#language", label: t("page.account.language.title") },
									{ href: `#${EMAIL_PREFERENCES_ANCHOR}`, label: t("page.account.emails.title") },
									{ href: "#teams", label: t("page.account.teams.title") },
									{ href: "#data", label: t("page.account.dataExport.title") },
									{ href: "#delete-account", label: t("page.account.deleteAccount.title") },
								],
							},
						]}
						labels={{ nav: t("page.account.nav"), back: t("page.account.header.title") }}
					>
						<SettingsSection
							id="profile"
							save="instant"
							title={t("page.account.profile.title")}
							description={t("page.account.profile.description")}
							labels={{ save: saveLabel }}
						>
							<SettingsSection.Row
								label={t("page.account.profile.card.title")}
								description={t("page.account.profile.card.description")}
							>
								<div mix={[hstack({ gap: 3, align: "center" })]}>
									<Avatar src={viewer.avatar || null} name={viewer.name} size={40} />
									<div mix={[vstack({ gap: 0, align: "start" }), minIs(0)]}>
										<span mix={[weight("medium")]}>{viewer.name}</span>
										<a
											href={`mailto:${viewer.email}`}
											mix={[
												fontSize("sm"),
												fg("neutral.muted"),
												textDecoration("none"),
												hover(textDecoration("underline")),
											]}
										>
											{viewer.email}
										</a>
									</div>
								</div>
							</SettingsSection.Row>
						</SettingsSection>

						<SettingsSection
							id="language"
							title={t("page.account.language.title")}
							description={t("page.account.language.description")}
							form={{ action: routes.accountActions.updateLanguage.href() }}
							labels={{ save: saveLabel }}
						>
							<SettingsSection.Row
								label={t("page.account.language.form.fields.language.label")}
								description={t("page.account.language.form.fields.language.description")}
								htmlFor="account-language"
							>
								<Select
									id="account-language"
									name="language"
									/**
									 * `<select>` has no `defaultValue` attribute, so the saved preference is marked
									 * `selected` on its own `<option>` instead — spelling it on the host would
									 * render as inert markup and leave "Automatic" showing.
									 */
								>
									<Select.Option value="auto" selected={preferredLanguage === null}>
										{t("page.account.language.form.fields.language.options.auto")}
									</Select.Option>
									{supportedLanguages.map((code) => (
										<Select.Option key={code} value={code} selected={code === preferredLanguage}>
											{t(`page.account.language.form.fields.language.options.${code}`)}
										</Select.Option>
									))}
								</Select>
							</SettingsSection.Row>
						</SettingsSection>

						<SettingsSection
							id={EMAIL_PREFERENCES_ANCHOR}
							save="instant"
							title={t("page.account.emails.title")}
							description={t("page.account.emails.card.description")}
							form={{ action: routes.accountActions.updateEmails.href() }}
							labels={{ save: t("page.account.emails.form.cta") }}
						>
							{optionalEmails.map((email) => (
								<SettingsSection.Row
									key={email}
									layout="inline-switch"
									label={t(`page.account.emails.list.${email}.name`)}
									description={t(`page.account.emails.list.${email}.description`)}
									htmlFor={emailSwitchId(email)}
									descriptionId={emailDescriptionId(email)}
								>
									<Switch
										id={emailSwitchId(email)}
										name="emails"
										value={email}
										/**
										 * Checked means subscribed; every switch defaults to checked because the
										 * stored preference lists only the emails a member turned off, so an absent
										 * email means they still want it.
										 */
										defaultChecked={wantsEmail(preferences, email)}
										aria-describedby={emailDescriptionId(email)}
									/>
								</SettingsSection.Row>
							))}
						</SettingsSection>

						<SettingsSection
							id="teams"
							save="instant"
							title={t("page.account.teams.title")}
							description={t("page.account.teams.description")}
							labels={{ save: saveLabel }}
						>
							<SettingsSection.Row
								layout="inline-switch"
								label={t("page.account.teams.table.label")}
								description={t("page.account.teams.table.description")}
							>
								<Button
									type="button"
									size="sm"
									variant="outline"
									commandfor="create-team"
									command="show-modal"
								>
									<PlusIcon size={16} strokeWidth={1.5} />
									<span>{t("page.account.teams.actions.createTeam")}</span>
								</Button>
							</SettingsSection.Row>

							{memberships.length === 0 ? (
								<Empty kind="first-run" size="compact">
									<Empty.Title>{t("page.account.teams.empty.title")}</Empty.Title>
									<Empty.Description>{t("page.account.teams.empty.description")}</Empty.Description>
								</Empty>
							) : (
								<Table.Container>
									<Table aria-label={t("page.account.teams.table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>{t("page.account.teams.table.columns.team")}</Table.Column>
												<Table.Column>{t("page.account.teams.table.columns.role")}</Table.Column>
												<Table.ActionsColumn
													label={t("page.account.teams.table.columns.actions")}
												/>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{memberships.map(({ team, role, isOwner }) => {
												let canLeave = !isOwner && role === "member";
												let leaveDialogId = `leave-team-${team.id}`;

												return (
													<Table.Row key={team.id}>
														<Table.Cell>
															<Table.RowLink
																href={routes.app.team.dashboard.index.href({ team: team.slug })}
															>
																{team.name}
															</Table.RowLink>
														</Table.Cell>
														<Table.Cell>
															{t(`page.account.teams.table.role.${isOwner ? "owner" : role}`)}
														</Table.Cell>
														<Table.Actions>
															{canLeave && (
																<>
																	<Button
																		type="button"
																		size="sm"
																		variant="ghost"
																		color="danger"
																		commandfor={leaveDialogId}
																		command="show-modal"
																	>
																		{t("page.account.teams.table.actions.leave")}
																	</Button>
																	<Confirm
																		id={leaveDialogId}
																		title={t("page.account.teams.table.confirmation.leaveTeam", {
																			name: team.name,
																		})}
																		confirmLabel={t("page.account.teams.table.actions.leave")}
																		cancelLabel={cancelLabel}
																		form={{
																			action: routes.accountActions.leaveTeam.href(),
																			fields: (
																				<input type="hidden" name="team_id" value={team.id} />
																			),
																		}}
																	/>
																</>
															)}
														</Table.Actions>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table>
								</Table.Container>
							)}
						</SettingsSection>

						<Dialog
							id="create-team"
							aria-labelledby="create-team-title"
							open={createTeamSubmission !== undefined}
						>
							<form
								method="post"
								action={routes.accountActions.createTeam.href()}
								mix={[vstack({ gap: 5, align: "stretch" })]}
							>
								<Dialog.Header>
									<Dialog.Title id="create-team-title">
										{t("page.createTeam.header.title")}
									</Dialog.Title>
								</Dialog.Header>
								<TextField
									label={t("page.createTeam.form.fields.name.label")}
									type="text"
									name="name"
									required
									defaultValue={submittedText(createTeamSubmission, "name", "")}
									errorMessage={fieldIssue(createTeamSubmission, "name")}
									placeholder={t("page.createTeam.form.fields.name.placeholder")}
								/>
								{/** Names the shell to draw the page in again when the action refuses the name. */}
								<input type="hidden" name="team" value={ctx.team.slug} />
								<Dialog.Footer>
									<Button type="button" variant="outline" commandfor="create-team" command="close">
										{t("page.createTeam.form.cancel")}
									</Button>
									<Button type="submit">{t("page.createTeam.form.cta")}</Button>
								</Dialog.Footer>
							</form>
						</Dialog>

						<SettingsSection
							id="data"
							title={t("page.account.dataExport.title")}
							description={t("page.account.dataExport.description")}
							form={{
								/**
								 * Uses POST so cross-origin protections apply: safe methods like GET carry
								 * none, and this action returns the viewer's entire account export.
								 */
								action: routes.accountActions.exportData.href(),
							}}
							labels={{ save: t("page.account.dataExport.form.cta") }}
						>
							<SettingsSection.Row
								layout="stacked"
								label={t("page.account.dataExport.card.title")}
								description={t("page.account.dataExport.card.description")}
							>
								<div mix={[vstack({ gap: 2, align: "stretch" }), fontSize("sm")]}>
									<p mix={[m(0), pretty()]}>{t("page.account.dataExport.card.includes")}</p>
									<p mix={[m(0), fg("neutral.muted"), pretty()]}>
										{t("page.account.dataExport.card.excludes")}
									</p>
								</div>
							</SettingsSection.Row>
						</SettingsSection>

						{queuedDeletion ? (
							<SettingsSection
								id="delete-account"
								title={t("page.account.deleteAccount.title")}
								description={t("page.account.deleteAccount.description")}
								form={{
									action: routes.accountActions.cancelDeletion.href(),
									fields: <input type="hidden" name="_method" value="DELETE" />,
								}}
								labels={{ save: t("page.account.deleteAccount.queued.cta") }}
							>
								<SettingsSection.Row
									layout="stacked"
									label={t("page.account.deleteAccount.queued.title")}
									description={t("page.account.deleteAccount.queued.requestedAt", {
										date: formatDate(new Date(queuedDeletion.requested_at), {
											locale: ctx.locale,
											timeZone: "UTC",
										}),
									})}
								>
									<p mix={[m(0), fontSize("sm"), pretty()]}>
										{t("page.account.deleteAccount.queued.description")}
									</p>
								</SettingsSection.Row>
							</SettingsSection>
						) : (
							<DangerZone
								id="delete-account"
								title={t("page.account.deleteAccount.title")}
								description={t("page.account.deleteAccount.description")}
							>
								<DangerZone.Action
									id="request-account-deletion"
									title={t("page.account.deleteAccount.card.title")}
									description={
										<div
											mix={[vstack({ gap: 3, align: "stretch" }), maxIs("65ch"), fontSize("sm")]}
										>
											<p mix={[m(0)]}>{t("page.account.deleteAccount.card.whatHappens")}</p>
											{plan.ownedTeams.length > 0 ? (
												<div mix={[vstack({ gap: 1, align: "stretch" })]}>
													<p mix={[m(0)]}>{t("page.account.deleteAccount.card.ownedTeamsIntro")}</p>
													<ul
														mix={[
															m(0),
															pis(5),
															listStyle("disc"),
															vstack({ gap: 1, align: "stretch" }),
														]}
													>
														{ownedTeamLines.map((line) => (
															<li key={line}>{line}</li>
														))}
													</ul>
												</div>
											) : (
												<p mix={[m(0)]}>{ownedTeamLines[0]}</p>
											)}
											{plan.othersLosingAccess > 0 ? (
												<Alert color="danger">
													<Alert.Content>
														<Alert.Description>
															{t("page.account.deleteAccount.card.othersWarning", {
																count: plan.othersLosingAccess,
															})}
														</Alert.Description>
													</Alert.Content>
												</Alert>
											) : null}
										</div>
									}
									buttonLabel={t("page.account.deleteAccount.card.cta")}
									confirm={{
										title: t("page.account.deleteConfirm.title"),
										description: t("page.account.deleteAccount.card.description"),
										confirmLabel: t("page.account.deleteAccount.card.cta"),
										cancelLabel,
										typeToConfirm: {
											value: DELETE_PHRASE,
											label: t("page.account.deleteAccount.card.confirmation.label"),
											name: "confirmation",
										},
										form: { action: routes.accountActions.requestDeletion.href() },
									}}
								/>
								<div
									mix={[
										p(4),
										vstack({ gap: 1, align: "stretch" }),
										fontSize("sm"),
										fg("neutral.muted"),
									]}
								>
									<p mix={[m(0)]}>{t("page.account.deleteAccount.card.retained.intro")}</p>
									<ul mix={[m(0), pis(5), listStyle("disc"), vstack({ gap: 1, align: "stretch" })]}>
										<li>{t("page.account.deleteAccount.card.retained.billing")}</li>
										<li>{t("page.account.deleteAccount.card.retained.analytics")}</li>
										<li>{t("page.account.deleteAccount.card.retained.logs")}</li>
										<li>{t("page.account.deleteAccount.card.retained.identity")}</li>
									</ul>
								</div>
							</DangerZone>
						)}
					</SettingsLayout>
				</AppShell>
			</DocumentLayout>
		);
	};
}
