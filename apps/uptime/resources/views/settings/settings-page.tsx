/**
 * The team settings page: a section nav of in-page anchors beside the team's profile, members,
 * invites, domains, billing and danger zone. Drawn by the settings route and again by the
 * profile, invite and domain actions when they refuse a submission, with the refused dialog
 * open and every typed character in place beside the field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { addDays } from "@sdxc/dates";
import { Trans } from "@sdxc/i18n/ui";
import {
	BadgeMinusIcon,
	EllipsisIcon,
	ExternalLinkIcon,
	HandshakeIcon,
	RefreshCcwIcon,
	UserCogIcon,
	UserMinusIcon,
	UserPlusIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { grow, hstack, vstack } from "@sdxc/u/layout";
import { m, minIs } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { fontSize, textDecoration, weight } from "@sdxc/u/typography";
import { Button, Confirm, Dialog, FieldError, Input, LinkButton, Menu, TextField } from "@sdxc/ui";
import { DangerZone, Empty, SettingsLayout, SettingsSection, Table } from "@sdxc/ui/app";
import { menuKeys } from "@sdxc/ui/mixins";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { TeamSettings } from "~/app/services/team-settings";

import { getViewer } from "~/app/http/middleware/auth";
import { fieldIssue, submittedText } from "~/app/http/validators/form-submission";
import { teamLogoUrl } from "~/app/services/team-logo";
import Avatar from "~/resources/components/avatar";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const INVITE_EXPIRATION_DAYS = 7;

/** DOM id of the logo field's error, referenced by the input's `aria-describedby`. */
const LOGO_ERROR_ID = "team-logo-error";

/** DOM id of the name field's error, referenced by the input's `aria-describedby`. */
const NAME_ERROR_ID = "team-name-error";

/** The flash a team action left for this page, shown as one toast. */
export interface TeamSettingsToast {
	intent: "success" | "error";
	message: string;
}

/** When an invite stops working: {@link INVITE_EXPIRATION_DAYS} after it was sent. */
function inviteExpiresAt(createdAt: number): Date {
	return addDays(new Date(createdAt), INVITE_EXPIRATION_DAYS);
}

export namespace TeamSettingsPage {
	export interface Props {
		/** What the page lists, read through `loadTeamSettings`. */
		settings: TeamSettings;
		/** The flash a team action left for this page, shown as one toast. */
		toast?: TeamSettingsToast;
		/** The profile form the update-team action refused; omitted on a first visit. */
		profileSubmission?: FormSubmission;
		/** The invite the create-invite action refused, which opens its dialog on load. */
		inviteSubmission?: FormSubmission;
		/** The domain the add-domain action refused, which opens its dialog on load. */
		domainSubmission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function TeamSettingsPage(handle: Handle<TeamSettingsPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { settings, toast, profileSubmission, inviteSubmission, domainSubmission } = handle.props;

		let { members, pendingInvites, domains, subjectsById } = settings;

		let t = ctx.intl.t;
		let team = ctx.team;
		let teamParams = { team: team.slug };
		let viewerIsOwner = viewer.id === team.owner_id;
		let hasPendingDomainVerification = domains.some((domain) => domain.verified_at === null);
		let now = Date.now();
		let logoError = fieldIssue(profileSubmission, "logo");
		let nameError = fieldIssue(profileSubmission, "name");
		let cancelLabel = t("page.settings.form.actions.cancel");

		let navItems = [
			{ href: "#general", label: t("page.settings.sections.general.title") },
			{ href: "#members", label: t("page.settings.members.title") },
			{ href: "#invites", label: t("page.settings.members.invitedTable.label") },
			{ href: "#domains", label: t("page.settings.domains.title") },
			...(viewerIsOwner
				? [
						{ href: "#billing", label: t("page.settings.billing.title") },
						{ href: "#danger", label: t("page.settings.danger.title") },
					]
				: []),
		];

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${team.name} · ${t("page.settings.header.title")}`}
			>
				<AppShell
					team={team}
					currentPath={routes.app.team.settings.href(teamParams)}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={t("page.settings.header.title")}
					toast={toast}
				>
					<SettingsLayout
						sections={[{ items: navItems }]}
						labels={{ nav: t("page.settings.nav"), back: t("page.settings.header.title") }}
					>
						<SettingsSection
							id="general"
							title={t("page.settings.sections.general.title")}
							description={t("page.settings.sections.general.description")}
							form={{ action: routes.teamAdminActions.team.update.href(teamParams) }}
							labels={{ save: t("page.settings.form.actions.save") }}
						>
							<SettingsSection.Row
								label={t("page.settings.form.fields.logo.label")}
								description={t("page.settings.form.fields.logo.description")}
								htmlFor="team-logo"
							>
								<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
									<div mix={[hstack({ gap: 3, align: "center" })]}>
										<Avatar src={teamLogoUrl(team.logo)} name={team.name} size={36} />
										<Input
											id="team-logo"
											type="url"
											name="logo"
											defaultValue={submittedText(profileSubmission, "logo", team.logo ?? "")}
											placeholder={t("page.settings.form.fields.logo.placeholder")}
											aria-invalid={logoError ? "true" : undefined}
											aria-describedby={logoError ? LOGO_ERROR_ID : undefined}
											mix={[grow(), minIs(0)]}
										/>
									</div>
									{logoError && <FieldError id={LOGO_ERROR_ID}>{logoError}</FieldError>}
								</div>
							</SettingsSection.Row>

							<SettingsSection.Row
								label={t("page.settings.form.fields.name.label")}
								description={t("page.settings.form.fields.name.description")}
								htmlFor="team-name"
							>
								<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
									<Input
										id="team-name"
										type="text"
										name="name"
										required
										defaultValue={submittedText(profileSubmission, "name", team.name)}
										placeholder={t("page.settings.form.fields.name.placeholder")}
										aria-invalid={nameError ? "true" : undefined}
										aria-describedby={nameError ? NAME_ERROR_ID : undefined}
									/>
									{nameError && <FieldError id={NAME_ERROR_ID}>{nameError}</FieldError>}
								</div>
							</SettingsSection.Row>
						</SettingsSection>

						<SettingsSection
							id="members"
							save="none"
							title={t("page.settings.members.title")}
							description={t("page.settings.members.description")}
							actions={
								<Button
									type="button"
									size="sm"
									variant="outline"
									commandfor="invite-member"
									command="show-modal"
								>
									<UserPlusIcon size={16} strokeWidth={1.5} />
									<span>{t("page.settings.members.actions.invite")}</span>
								</Button>
							}
						>
							<Table.Container>
								<Table aria-label={t("page.settings.members.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>{t("page.settings.members.table.columns.name")}</Table.Column>
											<Table.Column>{t("page.settings.members.table.columns.role")}</Table.Column>
											<Table.ActionsColumn
												label={t("page.settings.members.table.columns.actions")}
											/>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{members.map((member) => {
											let subject = subjectsById.get(member.subject_id);
											let memberIsOwner = member.subject_id === team.owner_id;
											let nextRole = member.role === "admin" ? "member" : "admin";
											let displayName = subject?.displayName ?? member.subject_id;
											let removeDialogId = `remove-member-${member.id}`;

											return (
												<Table.Row key={member.id}>
													<Table.Cell>
														<div mix={[hstack({ gap: 3, align: "center" })]}>
															<Avatar src={subject?.avatar || null} name={displayName} size={32} />
															<div mix={[vstack({ gap: 0, align: "start" }), minIs(0)]}>
																<span mix={[weight("medium")]}>{displayName}</span>
																{subject && (
																	<a
																		href={`mailto:${subject.emailAddress}`}
																		mix={[
																			fontSize("xs"),
																			fg("neutral.muted"),
																			textDecoration("none"),
																			hover(textDecoration("underline")),
																		]}
																	>
																		{subject.emailAddress}
																	</a>
																)}
															</div>
														</div>
													</Table.Cell>
													<Table.Cell>
														{t(
															`page.settings.members.table.role.${memberIsOwner ? "owner" : member.role}`,
														)}
													</Table.Cell>
													<Table.Actions>
														{!memberIsOwner && (
															<>
																<RowActions
																	id={`member-menu-${member.id}`}
																	label={t("page.settings.members.table.actions.menu")}
																>
																	<form
																		method="post"
																		action={routes.teamAdminActions.member.changeRole.href(
																			teamParams,
																		)}
																	>
																		<input
																			type="hidden"
																			name="subject_id"
																			value={member.subject_id}
																		/>
																		<input type="hidden" name="role" value={nextRole} />
																		<Menu.Item type="submit">
																			<UserCogIcon size={16} strokeWidth={1.5} />
																			<span>
																				{t(
																					`page.settings.members.table.actions.changeRole.${member.role}`,
																				)}
																			</span>
																		</Menu.Item>
																	</form>
																	{viewerIsOwner && member.role === "admin" && (
																		<Menu.Item disabled>
																			<HandshakeIcon size={16} strokeWidth={1.5} />
																			<span>
																				{t("page.settings.members.table.actions.transfer")}
																			</span>
																		</Menu.Item>
																	)}
																	<Menu.Separator />
																	<Menu.Item
																		danger
																		commandfor={removeDialogId}
																		command="show-modal"
																	>
																		<UserMinusIcon size={16} strokeWidth={1.5} />
																		<span>{t("page.settings.members.table.actions.remove")}</span>
																	</Menu.Item>
																</RowActions>

																<Confirm
																	id={removeDialogId}
																	title={t(
																		"page.settings.members.table.confirmation.removeMember",
																		{
																			name: displayName,
																		},
																	)}
																	confirmLabel={t("page.settings.members.table.actions.remove")}
																	cancelLabel={cancelLabel}
																	form={{
																		action: routes.teamAdminActions.member.remove.href(teamParams),
																		fields: (
																			<>
																				<input type="hidden" name="_method" value="DELETE" />
																				<input
																					type="hidden"
																					name="subject_id"
																					value={member.subject_id}
																				/>
																				<input
																					type="hidden"
																					name="email"
																					value={subject?.emailAddress ?? ""}
																				/>
																			</>
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
						</SettingsSection>

						<Dialog
							id="invite-member"
							aria-labelledby="invite-member-title"
							open={inviteSubmission !== undefined}
						>
							<form
								method="post"
								action={routes.teamAdminActions.invite.create.href(teamParams)}
								mix={[vstack({ gap: 5, align: "stretch" })]}
							>
								<Dialog.Header>
									<Dialog.Title id="invite-member-title">
										{t("page.invite.header.title")}
									</Dialog.Title>
								</Dialog.Header>
								<TextField
									label={t("page.invite.form.fields.email.label")}
									type="email"
									name="email"
									required
									defaultValue={submittedText(inviteSubmission, "email", "")}
									errorMessage={fieldIssue(inviteSubmission, "email")}
									placeholder={t("page.invite.form.fields.email.placeholder")}
								/>
								<Dialog.Footer>
									<Button
										type="button"
										variant="outline"
										commandfor="invite-member"
										command="close"
									>
										{t("page.invite.form.cancel")}
									</Button>
									<Button type="submit">{t("page.invite.form.cta")}</Button>
								</Dialog.Footer>
							</form>
						</Dialog>

						<SettingsSection
							id="invites"
							save="none"
							title={t("page.settings.members.invitedTable.label")}
							description={t("page.settings.members.invitedTable.description")}
						>
							{pendingInvites.length === 0 ? (
								<Empty size="compact">
									<Empty.Description>
										{t("page.settings.members.invitedTable.empty.description")}
									</Empty.Description>
								</Empty>
							) : (
								<Table.Container>
									<Table aria-label={t("page.settings.members.invitedTable.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{t("page.settings.members.invitedTable.columns.email")}
												</Table.Column>
												<Table.Column>
													{t("page.settings.members.invitedTable.columns.expires")}
												</Table.Column>
												<Table.ActionsColumn
													label={t("page.settings.members.invitedTable.columns.actions")}
												/>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{pendingInvites.map((invite) => {
												let expiresAt = inviteExpiresAt(invite.created_at);
												let revokeDialogId = `revoke-invite-${invite.id}`;

												return (
													<Table.Row key={invite.id}>
														<Table.Cell>{invite.email}</Table.Cell>
														{expiresAt.getTime() <= now ? (
															<Table.Cell mix={[fg("danger")]}>
																{t("page.settings.members.invitedTable.expires.expired")}
															</Table.Cell>
														) : (
															<Table.DateCell
																date={expiresAt}
																now={now}
																locale={ctx.locale}
																local
															/>
														)}
														<Table.Actions>
															<Button
																type="button"
																size="sm"
																variant="ghost"
																color="danger"
																commandfor={revokeDialogId}
																command="show-modal"
															>
																{t("page.settings.members.invitedTable.actions.revoke")}
															</Button>
															<Confirm
																id={revokeDialogId}
																title={t(
																	"page.settings.members.invitedTable.confirmation.revokeInvite",
																	{ email: invite.email },
																)}
																confirmLabel={t(
																	"page.settings.members.invitedTable.actions.revoke",
																)}
																cancelLabel={cancelLabel}
																form={{
																	action: routes.teamAdminActions.invite.revoke.href(teamParams),
																	fields: (
																		<>
																			<input type="hidden" name="_method" value="DELETE" />
																			<input type="hidden" name="invite_id" value={invite.id} />
																		</>
																	),
																}}
															/>
														</Table.Actions>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table>
								</Table.Container>
							)}
						</SettingsSection>

						<SettingsSection
							id="domains"
							save="none"
							title={t("page.settings.domains.title")}
							description={t("page.settings.domains.description")}
							actions={
								<Button
									type="button"
									size="sm"
									variant="outline"
									commandfor="add-domain"
									command="show-modal"
								>
									{t("page.settings.domains.actions.addDomain")}
								</Button>
							}
						>
							{domains.length === 0 ? (
								<Empty size="compact">
									<Empty.Description>
										{t("page.settings.domains.table.empty.description")}
									</Empty.Description>
								</Empty>
							) : (
								<Table.Container>
									<Table aria-label={t("page.settings.domains.table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{t("page.settings.domains.table.columns.hostname")}
												</Table.Column>
												<Table.Column>{t("page.settings.domains.table.columns.id")}</Table.Column>
												<Table.Column>
													{t("page.settings.domains.table.columns.verifiedAt")}
												</Table.Column>
												<Table.ActionsColumn
													label={t("page.settings.domains.table.columns.actions")}
												/>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{domains.map((domain) => {
												let removeDialogId = `remove-domain-${domain.id}`;
												let isPending = domain.verified_at === null;

												return (
													<Table.Row key={domain.id}>
														<Table.Cell mix={[weight("medium")]}>{domain.hostname}</Table.Cell>
														<Table.IdCell value={isPending ? `ping_${domain.id}` : null} />
														{domain.verified_at === null ? (
															<Table.Cell mix={[fg("neutral.muted")]}>
																{t("page.settings.domains.table.verifiedAt.pending")}
															</Table.Cell>
														) : (
															<Table.DateCell
																date={domain.verified_at}
																now={now}
																locale={ctx.locale}
																local
															/>
														)}
														<Table.Actions>
															<RowActions
																id={`domain-menu-${domain.id}`}
																label={t("page.settings.domains.table.actions.menu")}
															>
																{isPending && (
																	<>
																		<form
																			method="post"
																			action={routes.teamAdminActions.domain.retryVerification.href(
																				teamParams,
																			)}
																		>
																			<input type="hidden" name="domain_id" value={domain.id} />
																			<Menu.Item type="submit">
																				<RefreshCcwIcon size={16} strokeWidth={1.5} />
																				<span>
																					{t(
																						"page.settings.domains.table.actions.retryVerification",
																					)}
																				</span>
																			</Menu.Item>
																		</form>
																		<Menu.Separator />
																	</>
																)}
																<Menu.Item danger commandfor={removeDialogId} command="show-modal">
																	<BadgeMinusIcon size={16} strokeWidth={1.5} />
																	<span>{t("page.settings.domains.table.actions.remove")}</span>
																</Menu.Item>
															</RowActions>

															<Confirm
																id={removeDialogId}
																title={t("page.settings.domains.table.confirmation.removeDomain", {
																	hostname: domain.hostname,
																})}
																confirmLabel={t("page.settings.domains.table.actions.remove")}
																cancelLabel={cancelLabel}
																form={{
																	action: routes.teamAdminActions.domain.remove.href(teamParams),
																	fields: (
																		<>
																			<input type="hidden" name="_method" value="DELETE" />
																			<input type="hidden" name="domain_id" value={domain.id} />
																		</>
																	),
																}}
															/>
														</Table.Actions>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table>
								</Table.Container>
							)}

							{hasPendingDomainVerification && (
								<SettingsSection.Row
									layout="stacked"
									label={t("page.settings.domains.instructions.title")}
									description={t("page.settings.domains.instructions.description")}
								>
									<div mix={[vstack({ gap: 3, align: "stretch" }), fontSize("sm")]}>
										<dl mix={[m(0), vstack({ gap: 1, align: "stretch" })]}>
											<div mix={[hstack({ gap: 2 })]}>
												<dt mix={[weight("medium")]}>
													{t("page.settings.domains.instructions.record.name.label")}
												</dt>
												<dd mix={[m(0)]}>
													<code>{t("page.settings.domains.instructions.record.name.value")}</code>
												</dd>
											</div>
											<div mix={[hstack({ gap: 2 })]}>
												<dt mix={[weight("medium")]}>
													{t("page.settings.domains.instructions.record.content.label")}
												</dt>
												<dd mix={[m(0)]}>
													<code>
														{t("page.settings.domains.instructions.record.content.value")}
													</code>
												</dd>
											</div>
										</dl>
										<p mix={[m(0)]}>
											<Trans
												intl={ctx.intl}
												i18nKey="page.settings.domains.instructions.note"
												components={{ code: <code /> }}
											/>
										</p>
										<p mix={[m(0), fg("neutral.muted")]}>
											{t("page.settings.domains.instructions.disclaimer")}
										</p>
									</div>
								</SettingsSection.Row>
							)}
						</SettingsSection>

						<Dialog
							id="add-domain"
							aria-labelledby="add-domain-title"
							open={domainSubmission !== undefined}
						>
							<form
								method="post"
								action={routes.teamAdminActions.domain.add.href(teamParams)}
								mix={[vstack({ gap: 5, align: "stretch" })]}
							>
								<Dialog.Header>
									<Dialog.Title id="add-domain-title">
										{t("page.settings.domains.form.title")}
									</Dialog.Title>
								</Dialog.Header>
								<TextField
									label={t("page.settings.domains.form.fields.hostname.label")}
									description={t("page.settings.domains.form.fields.hostname.description", {
										team: team.name,
									})}
									type="text"
									name="hostname"
									required
									defaultValue={submittedText(domainSubmission, "hostname", "")}
									errorMessage={fieldIssue(domainSubmission, "hostname")}
									placeholder={t("page.settings.domains.form.fields.hostname.placeholder")}
								/>
								<Dialog.Footer>
									<Button type="button" variant="outline" commandfor="add-domain" command="close">
										{cancelLabel}
									</Button>
									<Button type="submit">{t("page.settings.domains.form.cta")}</Button>
								</Dialog.Footer>
							</form>
						</Dialog>

						{viewerIsOwner && (
							<SettingsSection
								id="billing"
								save="none"
								title={t("page.settings.billing.title")}
								description={t("page.settings.billing.description")}
							>
								<SettingsSection.Row
									label={t("page.settings.billing.card.title")}
									description={t("page.settings.billing.card.notice")}
								>
									<LinkButton
										href={routes.app.team.checkout.href(teamParams)}
										data-rmx-document=""
										size="sm"
										variant="outline"
									>
										<span>{t("page.settings.billing.card.cta")}</span>
										<ExternalLinkIcon size={16} strokeWidth={1.5} />
									</LinkButton>
								</SettingsSection.Row>
							</SettingsSection>
						)}

						{viewerIsOwner && (
							<DangerZone
								id="danger"
								title={t("page.settings.danger.title")}
								description={t("page.settings.danger.description")}
							>
								<DangerZone.Action
									id="delete-team"
									title={t("page.settings.danger.card.title")}
									description={t("page.settings.danger.card.description")}
									consequences={[t("page.settings.danger.card.warning")]}
									buttonLabel={t("page.settings.danger.card.cta")}
									confirm={{
										title: t("page.settings.deleteConfirm.title", { name: team.name }),
										description: t("page.settings.danger.card.description"),
										confirmLabel: t("page.settings.danger.card.cta"),
										cancelLabel,
										typeToConfirm: {
											value: team.name,
											label: t("page.settings.deleteConfirm.label", { name: team.name }),
											name: "confirmation",
										},
										form: {
											action: routes.teamAdminActions.team.delete.href(teamParams),
											fields: <input type="hidden" name="_method" value="DELETE" />,
										},
									}}
								/>
							</DangerZone>
						)}
					</SettingsLayout>
				</AppShell>
			</DocumentLayout>
		);
	};
}

namespace RowActions {
	export interface Props {
		/** The menu's DOM id, which its trigger opens through `commandfor`. */
		id: string;
		/** Names both the trigger and the menu, such as "Actions Menu". */
		label: string;
		children: RemixNode;
	}
}

/**
 * A row's kebab trigger and the menu it opens, for a row with more than one action. The menu
 * is a popover, so the row's actions stay shown while it is open.
 */
function RowActions(handle: Handle<RowActions.Props>) {
	return () => {
		let { id, label, children } = handle.props;
		return (
			<>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					commandfor={id}
					command="toggle-popover"
					aria-label={label}
				>
					<EllipsisIcon size={16} strokeWidth={1.5} />
				</Button>
				<Menu id={id} placement="bottom-end" aria-label={label} mix={[menuKeys()]}>
					{children}
				</Menu>
			</>
		);
	};
}
