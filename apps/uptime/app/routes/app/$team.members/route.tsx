import { cn } from "@pkg/cn";
import { isFailure, succeeded } from "@pkg/result";
import { Alert, Avatar, Button, LinkButton, Menu, Popover, Table } from "@pkg/ui";
import {
	ClipboardCopyIcon,
	EllipsisVerticalIcon,
	HandshakeIcon,
	LoaderIcon,
	TriangleAlertIcon,
	UserCogIcon,
	UserMinusIcon,
	UserPlusIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { data, href, isRouteErrorResponse, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import auth from "~/clients/auth";
import { AppHeader } from "~/components/app-header";
import { useSubject } from "~/hooks/use-subject";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export async function loader() {
	let { memberships, id, ownerId } = team();
	let subjectMembership = memberships[0];

	if (subjectMembership.role === "member") {
		throw data(
			{ status: 403, hasActiveSubscription: await hasActiveSubscription() },
			{ status: 403, statusText: "Forbidden" },
		);
	}

	let [invitedMembers, members] = await Promise.all([
		measure("findInvitedMembers", async () => {
			return db().query.invites.findMany({
				columns: {
					id: true,
					email: true,
					createdAt: true,
				},
				where(fields, operators) {
					return operators.and(
						operators.eq(fields.teamId, id),
						operators.isNull(fields.acceptedAt),
					);
				},
			});
		}),

		measure("findTeamMembers", async () => {
			let [tokenResult, teamMemberships] = await Promise.all([
				measure("authenticate", () => auth.authenticate()),
				measure("findTeamMemberships", () => {
					return db().query.memberships.findMany({
						where(fields, operators) {
							return operators.eq(fields.teamId, id);
						},
					});
				}),
			]);

			succeeded(tokenResult, "Failed to authenticate with auth service");

			let result = await measure("fetchSubjectsById", async () => {
				return await Promise.allSettled(
					teamMemberships.map(async (membership) => {
						let result = await auth.fetchSubjectById(membership.subjectId, tokenResult.data);
						if (isFailure(result)) throw result.error;

						return {
							id: result.data.id,
							avatar: result.data.avatar,
							name: result.data.displayName,
							email: result.data.emailAddress,
							role: ownerId === result.data.id ? ("owner" as const) : membership.role,
						};
					}),
				);
			});

			return result
				.filter((r) => r.status === "fulfilled")
				.map((r) => r.value)
				.filter(Boolean);
		}),
	]);

	return {
		invitedMembers,
		members,
		hasActiveSubscription: await hasActiveSubscription(),
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.members" });

	let membersTableColumns = [
		{
			id: "name" as const,
			name: t("membersTable.columns.name"),
			align: "left" as const,
		},
		{
			id: "role" as const,
			name: t("membersTable.columns.role"),
			align: "right" as const,
		},
		{
			id: "actions" as const,
			name: t("membersTable.columns.actions"),
			align: "center" as const,
		},
	];

	let invitedMembersTableColumns = [
		{
			id: "email" as const,
			name: t("invitedMembersTable.columns.email"),
			align: "left" as const,
		},
		{
			id: "actions" as const,
			name: t("invitedMembersTable.columns.actions"),
			align: "center" as const,
		},
	];

	let subject = useSubject();

	let id = useId();

	return (
		<>
			<AppHeader heading={t("header.title")}>
				{subject.isAdmin && (
					<LinkButton
						color="neutral"
						href={href("/app/:team/invite", params)}
						className="flex-shrink-0 px-2"
					>
						<UserPlusIcon className="size-5" aria-hidden />
						<span className="max-sm:sr-only">{t("header.action.invite")}</span>
					</LinkButton>
				)}
			</AppHeader>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert color="warning">
						<Alert.Icon>
							<TriangleAlertIcon className="size-5" />
						</Alert.Icon>
						<Alert.Content>
							<Alert.Title>{t("alert.subscription.title")}</Alert.Title>
							<Alert.Description>{t("alert.subscription.description")}</Alert.Description>
						</Alert.Content>
						<Alert.Action>
							<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
						</Alert.Action>
					</Alert>
				</div>
			)}

			<div className="flex flex-col gap-12 p-12">
				<div className="flex flex-col gap-4">
					<h2 id={`${id}-members-table`}>{t("membersTable.label")}</h2>

					<Table aria-labelledby={`{id}-members-table`}>
						<Table.Header columns={membersTableColumns}>
							{(column) => {
								return (
									<Table.Column align={column.align} isRowHeader={column.id === "name"}>
										<span className={cn({ "sr-only": column.id === "actions" })}>
											{column.name}
										</span>
									</Table.Column>
								);
							}}
						</Table.Header>

						<Table.Body items={loaderData.members}>
							{(member) => <MemberTableRow member={member} />}
						</Table.Body>
					</Table>
				</div>

				{loaderData.invitedMembers.length > 0 && (
					<div className="flex flex-col gap-4">
						<h2 id={`${id}-invited-members-table`}>{t("invitedMembersTable.label")}</h2>

						<Table aria-labelledby={`${id}-invited-members-table`}>
							<Table.Header columns={invitedMembersTableColumns}>
								{(column) => {
									return (
										<Table.Column align={column.align} isRowHeader={column.id === "email"}>
											<span className={cn({ "sr-only": column.id === "actions" })}>
												{column.name}
											</span>
										</Table.Column>
									);
								}}
							</Table.Header>

							<Table.Body items={loaderData.invitedMembers}>
								{(member) => <InvitedMemberTableRow member={member} team={params.team} />}
							</Table.Body>
						</Table>
					</div>
				)}
			</div>
		</>
	);
}

function MemberTableRow(props: { member: Route.ComponentProps["loaderData"]["members"][number] }) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.members.membersTable",
	});

	let subject = useSubject();
	let team = useTeam();

	let subjectIsOwner = subject.id === team.ownerId;
	let memberIsOwner = props.member.id === team.ownerId;

	let canChangeRole = !memberIsOwner && subject.isAdmin;
	let changeRoleFetcher = useFetcher();
	let isChangingRole = useSpinDelay(changeRoleFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	let canRemoveMember = !memberIsOwner && subject.isAdmin;
	let removeMemberFetcher = useFetcher();
	let isRemovingMember = useSpinDelay(removeMemberFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	let canTransferOwnership = props.member.role === "admin" && subjectIsOwner;
	let transferOwnershipFetcher = useFetcher();
	let isTransferringOwnership = useSpinDelay(transferOwnershipFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	return (
		<Table.Row>
			<Table.Cell>
				<div className="flex items-center gap-3">
					<Avatar size="lg">
						<Avatar.Image src={props.member.avatar} alt="" />
						<Avatar.Fallback>{getInitials(props.member.name)}</Avatar.Fallback>
					</Avatar>

					<div className="flex flex-col gap-0.5">
						<span className="text-lg font-medium">{props.member.name}</span>
						<a href={`mailto:${props.member.email}`} className="text-sm hover:underline">
							{props.member.email}
						</a>
					</div>
				</div>
			</Table.Cell>

			<Table.Cell className="w-36 text-right">{t(`role.${props.member.role}`)}</Table.Cell>

			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button
						type="button"
						className={cn("ml-auto p-2", {
							hidden: !canTransferOwnership && !canRemoveMember,
						})}
						color="neutral"
					>
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							{canChangeRole && (
								<Menu.Item
									isDisabled={!canChangeRole || isChangingRole}
									onAction={() => {
										changeRoleFetcher.submit(
											{
												currentRole: props.member.role,
												subjectId: props.member.id,
												name: props.member.name,
											},
											{
												method: "POST",
												action: href("/actions/:team/change-role", {
													team: team.slug,
												}),
											},
										);
									}}
								>
									<UserCogIcon aria-hidden className="size-5" />
									<span>{t(`actions.changeRole.${props.member.role}`)}</span>
									{isRemovingMember && (
										<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
									)}
								</Menu.Item>
							)}

							{canRemoveMember && (
								<Menu.Item
									danger
									isDisabled={!canRemoveMember || isRemovingMember}
									onAction={() => {
										if (
											window.confirm(
												t("confirmation.removeMember", {
													name: props.member.name,
												}),
											)
										) {
											removeMemberFetcher.submit(
												{
													subjectId: props.member.id,
													name: props.member.name,
													email: props.member.email,
												},
												{
													method: "POST",
													action: href("/actions/:team/remove-member", {
														team: team.slug,
													}),
												},
											);
										}
									}}
								>
									<UserMinusIcon aria-hidden className="size-5" />
									<span>{t("actions.remove")}</span>
									{isRemovingMember && (
										<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
									)}
								</Menu.Item>
							)}

							{canTransferOwnership && (
								<>
									<Menu.Separator />
									<Menu.Item isDisabled={!canTransferOwnership || isTransferringOwnership}>
										<HandshakeIcon aria-hidden className="size-5" />
										<span>{t("actions.transfer")}</span>
										{isTransferringOwnership && (
											<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
										)}
									</Menu.Item>
								</>
							)}
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}

function InvitedMemberTableRow(props: {
	team: string;
	member: Route.ComponentProps["loaderData"]["invitedMembers"][number];
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.members.invitedMembersTable",
	});

	let revokeInviteFetcher = useFetcher();
	let isRevokingInvite = useSpinDelay(revokeInviteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	let invitePath = href("/invite/:inviteId", { inviteId: props.member.id });

	return (
		<Table.Row>
			<Table.Cell>{props.member.email}</Table.Cell>

			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" className="ml-auto p-2" color="primary">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Popover
						style={{ minWidth: "var(--trigger-width)" }}
						placement="left top"
						className={cn(
							"rounded-lg",
							"border border-neutral-300 shadow shadow-neutral-300",
							"bg-neutral-50 text-neutral-950",
							"dark:border-neutral-700 dark:shadow-neutral-700",
							"dark:bg-neutral-950 dark:text-neutral-50",
						)}
					>
						<Menu>
							<Menu.Item
								onAction={() => {
									let url = new URL(invitePath, window.location.href);
									navigator.clipboard.writeText(url.toString());
								}}
							>
								<ClipboardCopyIcon aria-hidden className="size-5" />
								<span>{t("actions.copy")}</span>
							</Menu.Item>
							<Menu.Item
								danger
								isDisabled={isRevokingInvite}
								onAction={() => {
									if (window.confirm(t("confirmation.revokeInvite", props.member))) {
										revokeInviteFetcher.submit(
											{ inviteId: props.member.id, email: props.member.email },
											{
												method: "POST",
												action: href("/actions/:team/revoke-invite", props),
											},
										);
									}
								}}
							>
								<UserMinusIcon aria-hidden className="size-5" />
								<span>{t("actions.revoke")}</span>
								{isRevokingInvite && (
									<LoaderIcon className="ml-auto size-5 animate-spin" aria-hidden />
								)}
							</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}

export function ErrorBoundary({ error, params }: Route.ErrorBoundaryProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.members" });

	if (isRouteErrorResponse(error)) {
		let data = error.data as {
			hasActiveSubscription: boolean;
			status: number;
		};

		return (
			<>
				<AppHeader heading={t("header.title")} />

				{data.hasActiveSubscription ? null : (
					<div className="p-4">
						<Alert color="warning">
							<Alert.Icon>
								<TriangleAlertIcon className="size-5" />
							</Alert.Icon>
							<Alert.Content>
								<Alert.Title>{t("alert.subscription.title")}</Alert.Title>
								<Alert.Description>{t("alert.subscription.description")}</Alert.Description>
							</Alert.Content>
							<Alert.Action>
								<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
							</Alert.Action>
						</Alert>
					</div>
				)}

				<div className="flex flex-col gap-4 p-12">
					{data.status === 403 ? (
						<>
							<h2>{t("error.forbidden.title")}</h2>
							<p>{t("error.forbidden.description")}</p>
						</>
					) : (
						<>
							<h2>{t("error.unknown.title")}</h2>
							<p>{t("error.unknown.description")}</p>
						</>
					)}
				</div>
			</>
		);
	}

	return (
		<>
			<AppHeader heading={t("header.title")} />
			<div className="flex flex-col gap-4 p-12">
				<h2>{t("error.unknown.title")}</h2>
				<p>{t("error.unknown.description")}</p>
			</div>
		</>
	);
}
