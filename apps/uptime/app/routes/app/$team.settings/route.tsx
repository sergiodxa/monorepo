import { cn } from "@pkg/cn";
import { forbidden } from "@pkg/response";
import { isFailure, succeeded } from "@pkg/result";
import {
	Alert,
	Avatar,
	Button,
	Card,
	confirm,
	Description,
	FieldError,
	Input,
	Label,
	LinkButton,
	Logo,
	Menu,
	Popover,
	Skeleton,
	Table,
	TextField,
} from "@pkg/ui";
import {
	BadgeMinusIcon,
	BadgePlusIcon,
	ClipboardCopyIcon,
	EllipsisVerticalIcon,
	ExternalLinkIcon,
	HandshakeIcon,
	LoaderIcon,
	RefreshCcwIcon,
	TriangleAlertIcon,
	UserCogIcon,
	UserMinusIcon,
	UserPlusIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

const INVITE_EXPIRATION_DAYS = 7;

function getInviteExpirationDate(createdAt: Date): Date {
	let expirationDate = new Date(createdAt);
	expirationDate.setDate(expirationDate.getDate() + INVITE_EXPIRATION_DAYS);
	return expirationDate;
}

function formatRelativeTime(
	targetDate: Date,
	locale: string,
): { text: string; isExpired: boolean } {
	let now = new Date();
	let diffMs = targetDate.getTime() - now.getTime();
	let isExpired = diffMs <= 0;

	if (isExpired) {
		return { text: "", isExpired: true };
	}

	let diffSeconds = Math.floor(diffMs / 1000);
	let diffMinutes = Math.floor(diffSeconds / 60);
	let diffHours = Math.floor(diffMinutes / 60);
	let diffDays = Math.floor(diffHours / 24);

	let rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

	if (diffDays > 0) {
		return { text: rtf.format(diffDays, "day"), isExpired: false };
	}
	if (diffHours > 0) {
		return { text: rtf.format(diffHours, "hour"), isExpired: false };
	}
	if (diffMinutes > 0) {
		return { text: rtf.format(diffMinutes, "minute"), isExpired: false };
	}
	return { text: rtf.format(diffSeconds, "second"), isExpired: false };
}
import { href, isRouteErrorResponse, Link, Outlet, useFetcher, useFetchers } from "react-router";
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

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
	return await serverLoader();
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return (
		<>
			<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
				<Skeleton className="h-6 w-28" />
			</header>

			<div className="flex flex-col gap-8 p-5 md:gap-16 md:p-12">
				{/* General Section Skeleton */}
				<section className="mx-auto w-full max-w-2xl space-y-6">
					<hgroup>
						<Skeleton className="mb-2 h-6 w-32" />
						<Skeleton className="h-4 w-64" />
					</hgroup>

					<Card className="min-[672px]:-mx-6">
						<Card.Header>
							<Skeleton className="mb-2 h-5 w-32" />
							<Skeleton className="h-4 w-48" />
						</Card.Header>

						<Card.Content className="space-y-6">
							<div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
								<Skeleton className="h-16 w-16 rounded-full" />
								<div className="flex flex-1 flex-col gap-2">
									<Skeleton className="h-4 w-16" />
									<Skeleton className="h-10 w-full rounded-lg" />
									<Skeleton className="h-3 w-48" />
								</div>
							</div>

							<div className="flex flex-col gap-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-10 w-full rounded-lg" />
								<Skeleton className="h-3 w-40" />
							</div>
						</Card.Content>

						<Card.Footer className="justify-end gap-2">
							<Skeleton className="h-10 w-20 rounded-lg" />
							<Skeleton className="h-10 w-24 rounded-lg" />
						</Card.Footer>
					</Card>
				</section>

				{/* Members Section Skeleton */}
				<section className="mx-auto w-full max-w-2xl space-y-6">
					<div className="flex items-start justify-between gap-4">
						<hgroup>
							<Skeleton className="mb-2 h-6 w-24" />
							<Skeleton className="h-4 w-56" />
						</hgroup>
						<Skeleton className="h-10 w-28 rounded-lg" />
					</div>

					<Card className="min-[672px]:-mx-6">
						<Card.Header>
							<Skeleton className="mb-2 h-5 w-28" />
							<Skeleton className="h-4 w-44" />
						</Card.Header>

						<Card.Content className="p-0">
							<MembersTableSkeleton />
						</Card.Content>
					</Card>
				</section>

				{/* Domains Section Skeleton */}
				<section className="mx-auto w-full max-w-2xl space-y-6">
					<hgroup>
						<Skeleton className="mb-2 h-6 w-24" />
						<Skeleton className="h-4 w-48" />
					</hgroup>

					<Card className="min-[672px]:-mx-6">
						<Card.Header>
							<Skeleton className="mb-2 h-5 w-24" />
							<Skeleton className="h-4 w-40" />
						</Card.Header>
						<Card.Content>
							<div className="flex flex-col gap-6">
								<div className="flex flex-col gap-2">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-10 w-full rounded-lg" />
									<Skeleton className="h-3 w-56" />
								</div>
								<Skeleton className="ml-auto h-10 w-28 rounded-lg" />
							</div>
						</Card.Content>
					</Card>
				</section>
			</div>
		</>
	);
}

function MembersTableSkeleton() {
	return (
		<Table aria-label="Loading members">
			<Table.Header>
				<Table.Column isRowHeader>
					<Skeleton className="h-4 w-16" />
				</Table.Column>
				<Table.Column align="right">
					<Skeleton className="ml-auto h-4 w-12" />
				</Table.Column>
				<Table.Column align="center">
					<span className="sr-only">Actions</span>
				</Table.Column>
			</Table.Header>

			<Table.Body items={[{ id: "1" }, { id: "2" }]}>
				{(item) => (
					<Table.Row key={item.id}>
						<Table.Cell>
							<div className="flex items-center gap-3">
								<Skeleton className="h-12 w-12 rounded-full" />
								<div className="flex flex-col gap-1">
									<Skeleton className="h-5 w-32" />
									<Skeleton className="h-4 w-40" />
								</div>
							</div>
						</Table.Cell>
						<Table.Cell className="w-36 text-right">
							<Skeleton className="ml-auto h-4 w-16" />
						</Table.Cell>
						<Table.Cell className="w-17 text-center">
							<Skeleton className="mx-auto h-10 w-10 rounded-lg" />
						</Table.Cell>
					</Table.Row>
				)}
			</Table.Body>
		</Table>
	);
}

function getTeamInitials(name: string): string {
	return name.substring(0, 2).toUpperCase();
}

function getMemberInitials(name: string): string {
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

	if (subjectMembership.role !== "admin") {
		throw forbidden({ hasActiveSubscription: await hasActiveSubscription() });
	}

	let [invitedMembers, members, domains] = await Promise.all([
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

		measure("findTeamDomains", async () => {
			return await db().query.teamDomains.findMany({
				where(fields, operators) {
					return operators.eq(fields.teamId, id);
				},
			});
		}),
	]);

	return {
		invitedMembers,
		members,
		domains,
		hasActiveSubscription: await hasActiveSubscription(),
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings" });
	let teamData = useTeam();
	let subject = useSubject();

	let isOwner = subject.id === teamData.ownerId;

	return (
		<>
			<AppHeader heading={t("header.title")} />

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

			<div className="flex flex-col gap-8 p-5 md:gap-16 md:p-12">
				{/* General Section */}
				<section id="general" className="mx-auto w-full max-w-2xl space-y-6">
					<hgroup>
						<h2 className="text-xl font-semibold tracking-tight">{t("sections.general.title")}</h2>
						<p className="text-sm text-neutral-500 dark:text-neutral-400">
							{t("sections.general.description")}
						</p>
					</hgroup>

					<TeamSettingsForm team={teamData} />
				</section>

				{/* Members Section */}
				<MembersSection
					members={loaderData.members}
					invitedMembers={loaderData.invitedMembers}
					params={params}
				/>

				{/* Domains Section */}
				<DomainsSection domains={loaderData.domains} params={params} />

				{/* Billing Section - Owner only */}
				{isOwner && <BillingSection params={params} />}

				{/* Danger Zone - Owner only */}
				{isOwner && <DangerZoneSection params={params} teamName={teamData.name} />}
			</div>

			<Outlet />
		</>
	);
}

// =============================================================================
// General Section
// =============================================================================

function TeamSettingsForm(props: {
	team: { id: string; slug: string; name: string; logo: string | null };
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings.form" });
	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<Card className="min-[672px]:-mx-6">
			<fetcher.Form
				method="POST"
				action={href("/actions/:team/update-team", { team: props.team.slug })}
			>
				<Card.Header>
					<Card.Title>{t("card.title")}</Card.Title>
					<Card.Description>{t("card.description")}</Card.Description>
				</Card.Header>

				<Card.Content className="space-y-6">
					<div className="flex items-center gap-6">
						<Logo size="lg">
							{props.team.logo ? (
								<Logo.Image src={props.team.logo} alt="" />
							) : (
								<Logo.Fallback>{getTeamInitials(props.team.name)}</Logo.Fallback>
							)}
						</Logo>
						<div className="flex-1">
							<TextField type="url" name="logo" defaultValue={props.team.logo ?? ""}>
								<Label>{t("fields.logo.label")}</Label>
								<Input placeholder={t("fields.logo.placeholder")} />
								<FieldError />
								<Description>{t("fields.logo.description")}</Description>
							</TextField>
						</div>
					</div>

					<TextField type="text" name="name" defaultValue={props.team.name} isRequired>
						<Label>{t("fields.name.label")}</Label>
						<Input placeholder={t("fields.name.placeholder")} />
						<FieldError />
						<Description>{t("fields.name.description")}</Description>
					</TextField>
				</Card.Content>

				<Card.Footer className="justify-end gap-2">
					<Button type="reset" variant="outline" color="neutral">
						{t("actions.cancel")}
					</Button>
					<Button type="submit" isPending={isPending}>
						{t("actions.save")}
					</Button>
				</Card.Footer>
			</fetcher.Form>
		</Card>
	);
}

// =============================================================================
// Members Section
// =============================================================================

type Member = {
	id: string;
	avatar: string;
	name: string;
	email: string;
	role: "member" | "admin" | "owner";
};

type InvitedMember = {
	id: string;
	email: string;
	createdAt: Date;
};

function MembersSection(props: {
	members: Member[];
	invitedMembers: InvitedMember[];
	params: { team: string };
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings.members" });
	let subject = useSubject();
	let id = useId();
	let fetchers = useFetchers();

	// Get IDs of invites being revoked for optimistic UI
	let revokingInviteIds = new Set(
		fetchers
			.filter((f) => f.formAction?.includes("/revoke-invite") && f.formData)
			.map((f) => f.formData?.get("inviteId") as string),
	);

	// Filter out invites that are being revoked
	let visibleInvitedMembers = props.invitedMembers.filter(
		(member) => !revokingInviteIds.has(member.id),
	);

	let membersTableColumns = [
		{ id: "name" as const, name: t("table.columns.name"), align: "left" as const },
		{ id: "role" as const, name: t("table.columns.role"), align: "right" as const },
		{ id: "actions" as const, name: t("table.columns.actions"), align: "center" as const },
	];

	let invitedMembersTableColumns = [
		{ id: "email" as const, name: t("invitedTable.columns.email"), align: "left" as const },
		{ id: "expires" as const, name: t("invitedTable.columns.expires"), align: "right" as const },
		{ id: "actions" as const, name: t("invitedTable.columns.actions"), align: "center" as const },
	];

	return (
		<section id="members" className="mx-auto w-full max-w-2xl space-y-6">
			<div className="flex items-start justify-between gap-4">
				<hgroup>
					<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
					<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
				</hgroup>
				{subject.isAdmin && (
					<LinkButton
						color="neutral"
						href={href("/app/:team/settings/invite", props.params)}
						className="flex-shrink-0"
					>
						<UserPlusIcon className="size-5" aria-hidden />
						<span className="max-sm:sr-only">{t("actions.invite")}</span>
					</LinkButton>
				)}
			</div>

			<Card className="min-[672px]:-mx-6">
				<Card.Header>
					<Card.Title>{t("table.label")}</Card.Title>
					<Card.Description>{t("table.description")}</Card.Description>
				</Card.Header>

				<Card.Content className="p-0">
					<Table aria-labelledby={`${id}-members-table`}>
						<Table.Header columns={membersTableColumns}>
							{(column) => (
								<Table.Column align={column.align} isRowHeader={column.id === "name"}>
									<span className={cn({ "sr-only": column.id === "actions" })}>{column.name}</span>
								</Table.Column>
							)}
						</Table.Header>

						<Table.Body items={props.members}>
							{(member) => <MemberTableRow member={member} />}
						</Table.Body>
					</Table>
				</Card.Content>
			</Card>

			{visibleInvitedMembers.length > 0 && (
				<Card className="min-[672px]:-mx-6">
					<Card.Header>
						<Card.Title>{t("invitedTable.label")}</Card.Title>
						<Card.Description>{t("invitedTable.description")}</Card.Description>
					</Card.Header>

					<Card.Content className="p-0">
						<Table aria-labelledby={`${id}-invited-members-table`}>
							<Table.Header columns={invitedMembersTableColumns}>
								{(column) => (
									<Table.Column align={column.align} isRowHeader={column.id === "email"}>
										<span className={cn({ "sr-only": column.id === "actions" })}>
											{column.name}
										</span>
									</Table.Column>
								)}
							</Table.Header>

							<Table.Body items={visibleInvitedMembers}>
								{(member) => <InvitedMemberTableRow member={member} />}
							</Table.Body>
						</Table>
					</Card.Content>
				</Card>
			)}
		</section>
	);
}

function MemberTableRow(props: { member: Member }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings.members" });

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
						<Avatar.Fallback>{getMemberInitials(props.member.name)}</Avatar.Fallback>
					</Avatar>

					<div className="flex flex-col gap-0.5">
						<span className="text-lg font-medium">{props.member.name}</span>
						<a href={`mailto:${props.member.email}`} className="text-sm hover:underline">
							{props.member.email}
						</a>
					</div>
				</div>
			</Table.Cell>

			<Table.Cell className="w-36 text-right">{t(`table.role.${props.member.role}`)}</Table.Cell>

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
						<span className="sr-only">{t("table.actions.menu")}</span>
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
												action: href("/actions/:team/change-role", { team: team.slug }),
											},
										);
									}}
								>
									<UserCogIcon aria-hidden className="size-5" />
									<span>{t(`table.actions.changeRole.${props.member.role}`)}</span>
									{isChangingRole && (
										<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
									)}
								</Menu.Item>
							)}

							{canRemoveMember && (
								<Menu.Item
									danger
									isDisabled={!canRemoveMember || isRemovingMember}
									onAction={async () => {
										let confirmed = await confirm(
											t("table.confirmation.removeMember", { name: props.member.name }),
										);
										if (confirmed) {
											removeMemberFetcher.submit(
												{
													subjectId: props.member.id,
													name: props.member.name,
													email: props.member.email,
												},
												{
													method: "POST",
													action: href("/actions/:team/remove-member", { team: team.slug }),
												},
											);
										}
									}}
								>
									<UserMinusIcon aria-hidden className="size-5" />
									<span>{t("table.actions.remove")}</span>
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
										<span>{t("table.actions.transfer")}</span>
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

function InvitedMemberTableRow(props: { member: InvitedMember }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.settings.members" });
	let team = useTeam();

	let revokeInviteFetcher = useFetcher();
	let isRevokingInvite = useSpinDelay(revokeInviteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	let invitePath = href("/invite/:inviteId", { inviteId: props.member.id });

	let expirationInfo = useMemo(() => {
		let expirationDate = getInviteExpirationDate(props.member.createdAt);
		return formatRelativeTime(expirationDate, i18n.language);
	}, [props.member.createdAt, i18n.language]);

	return (
		<Table.Row>
			<Table.Cell>{props.member.email}</Table.Cell>

			<Table.Cell className="w-36 text-right">
				{expirationInfo.isExpired ? (
					<span className="text-red-600 dark:text-red-400">
						{t("invitedTable.expires.expired")}
					</span>
				) : (
					<span>{expirationInfo.text}</span>
				)}
			</Table.Cell>

			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" className="ml-auto p-2" color="neutral">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("invitedTable.actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								onAction={() => {
									let url = new URL(invitePath, window.location.href);
									navigator.clipboard.writeText(url.toString());
								}}
							>
								<ClipboardCopyIcon aria-hidden className="size-5" />
								<span>{t("invitedTable.actions.copy")}</span>
							</Menu.Item>
							<Menu.Item
								danger
								isDisabled={isRevokingInvite}
								onAction={async () => {
									let confirmed = await confirm(
										t("invitedTable.confirmation.revokeInvite", { email: props.member.email }),
									);
									if (confirmed) {
										revokeInviteFetcher.submit(
											{ inviteId: props.member.id, email: props.member.email },
											{
												method: "POST",
												action: href("/actions/:team/revoke-invite", { team: team.slug }),
											},
										);
									}
								}}
							>
								<UserMinusIcon aria-hidden className="size-5" />
								<span>{t("invitedTable.actions.revoke")}</span>
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

// =============================================================================
// Domains Section
// =============================================================================

type Domain = {
	id: string;
	hostname: string;
	verifiedAt: Date | null;
};

function DomainsSection(props: { domains: Domain[]; params: { team: string } }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings.domains" });
	let id = useId();

	let columns = [
		{ id: "hostname" as const, name: t("table.columns.hostname"), align: "left" as const },
		{ id: "id" as const, name: t("table.columns.id"), align: "right" as const },
		{ id: "verifiedAt" as const, name: t("table.columns.verifiedAt"), align: "right" as const },
		{ id: "actions" as const, name: t("table.columns.actions"), align: "center" as const },
	];

	let hasPendingVerification = props.domains.some((domain) => !domain.verifiedAt);

	return (
		<section id="domains" className="mx-auto w-full max-w-2xl space-y-6">
			<hgroup>
				<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
				<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
			</hgroup>

			{props.domains.length === 0 ? (
				<Card className="min-[672px]:-mx-6">
					<Card.Header>
						<Card.Title>{t("table.label")}</Card.Title>
						<Card.Description>{t("table.description")}</Card.Description>
					</Card.Header>
					<Card.Content>
						<CreateDomainForm />
					</Card.Content>
				</Card>
			) : (
				<>
					<Card className="min-[672px]:-mx-6">
						<Card.Header className="flex-row items-center justify-between">
							<div>
								<Card.Title>{t("table.label")}</Card.Title>
								<Card.Description>{t("table.description")}</Card.Description>
							</div>
							<LinkButton
								color="neutral"
								href={href("/app/:team/domains/new", props.params)}
								className="flex-shrink-0 px-2"
							>
								<BadgePlusIcon className="size-5" aria-hidden />
								<span className="max-sm:sr-only">{t("actions.addDomain")}</span>
							</LinkButton>
						</Card.Header>

						<Card.Content className="p-0">
							<Table aria-labelledby={`${id}-domains-table`}>
								<Table.Header columns={columns}>
									{(column) => (
										<Table.Column align={column.align} isRowHeader={column.id === "hostname"}>
											<span
												className={cn({
													"sr-only":
														column.id === "actions" ||
														(!hasPendingVerification && column.id === "id"),
												})}
											>
												{column.name}
											</span>
										</Table.Column>
									)}
								</Table.Header>

								<Table.Body items={props.domains}>
									{(domain) => <DomainTableRow domain={domain} />}
								</Table.Body>
							</Table>
						</Card.Content>
					</Card>

					{hasPendingVerification && <DomainInstructions />}
				</>
			)}
		</section>
	);
}

function DomainTableRow(props: { domain: Domain }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.settings.domains" });
	let team = useTeam();

	let verifiedAt = props.domain.verifiedAt
		? new Date(props.domain.verifiedAt).toLocaleString(i18n.language, { dateStyle: "long" })
		: t("table.verifiedAt.pending");

	let removeDomainFetcher = useFetcher();
	let isRemovingDomain = useSpinDelay(removeDomainFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let retryDomainVerificationFetcher = useFetcher();
	let isRetryingDomainVerification = useSpinDelay(retryDomainVerificationFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let verificationId = `ping_${props.domain.id}`;

	return (
		<Table.Row>
			<Table.Cell>{props.domain.hostname}</Table.Cell>
			{props.domain.verifiedAt ? (
				<Table.Cell>{null}</Table.Cell>
			) : (
				<Table.Cell className="w-110 text-right">{verificationId}</Table.Cell>
			)}
			<Table.Cell className="w-60 text-right">{verifiedAt}</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("table.actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							{!props.domain.verifiedAt && (
								<>
									<Menu.Item
										isDisabled={isRetryingDomainVerification}
										onAction={() => {
											retryDomainVerificationFetcher.submit(
												{ domainId: props.domain.id },
												{
													method: "POST",
													action: href("/actions/:team/retry-domain-verification", {
														team: team.slug,
													}),
												},
											);
										}}
									>
										<RefreshCcwIcon aria-hidden className="size-5" />
										<span>{t("table.actions.retryVerification")}</span>
									</Menu.Item>

									<Menu.Item onAction={() => navigator.clipboard.writeText(verificationId)}>
										<ClipboardCopyIcon aria-hidden className="size-5" />
										<span>{t("table.actions.copy")}</span>
										<span className="sr-only">{props.domain.id}</span>
									</Menu.Item>

									<Menu.Separator />
								</>
							)}

							<Menu.Item
								danger
								isDisabled={isRemovingDomain}
								onAction={async () => {
									let confirmed = await confirm(
										t("table.confirmation.removeDomain", { hostname: props.domain.hostname }),
									);
									if (confirmed) {
										removeDomainFetcher.submit(
											{
												domainId: props.domain.id,
												hostname: props.domain.hostname,
											},
											{
												method: "POST",
												action: href("/actions/:team/remove-domain", { team: team.slug }),
											},
										);
									}
								}}
							>
								<BadgeMinusIcon aria-hidden className="size-5" />
								<span>{t("table.actions.remove")}</span>
								{isRemovingDomain && (
									<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
								)}
							</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}

function CreateDomainForm() {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings.domains.form" });
	let team = useTeam();

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<fetcher.Form
			method="POST"
			action={href("/actions/:team/add-domain", { team: team.slug })}
			className="flex flex-col gap-6"
		>
			<TextField type="text" name="hostname" isRequired autoComplete="off">
				<Label>{t("fields.hostname.label")}</Label>
				<Input placeholder={t("fields.hostname.placeholder")} />
				<Description>{t("fields.hostname.description", { team: team.name })}</Description>
				<FieldError />
			</TextField>

			<Button type="submit" className="self-end" isPending={isPending}>
				{t("cta")}
			</Button>
		</fetcher.Form>
	);
}

function DomainInstructions() {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings.domains.instructions" });

	return (
		<aside className="flex flex-col gap-2 rounded-2xl border border-neutral-300 p-4 dark:border-neutral-700">
			<h3 className="text-xl font-semibold">{t("title")}</h3>

			<p>{t("description")}</p>

			<dl className="my-2 flex flex-col gap-2 [&_code]:rounded-lg [&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-sm [&_code]:dark:bg-neutral-800 [&_div]:ml-2 [&_div]:flex [&_div]:gap-2 [&_dt]:font-semibold">
				<div>
					<dt>{t("record.name.label")}</dt>
					<dd>
						<code>{t("record.name.value")}</code>
					</dd>
				</div>

				<div>
					<dt>{t("record.content.label")}</dt>
					<dd>
						<code>{t("record.content.value")}</code>
					</dd>
				</div>
			</dl>

			<Trans
				parent="p"
				t={t}
				i18nKey="note"
				components={{
					code: <code className="rounded-lg bg-neutral-100 px-1.5 py-1 dark:bg-neutral-800" />,
				}}
			/>

			<p className="mt-2">{t("disclaimer")}</p>
		</aside>
	);
}

// =============================================================================
// Billing Section
// =============================================================================

function BillingSection(props: { params: { team: string } }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings.billing" });

	return (
		<section id="billing" className="mx-auto w-full max-w-2xl space-y-6">
			<hgroup>
				<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
				<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
			</hgroup>

			<Card className="min-[672px]:-mx-6">
				<Card.Header>
					<Card.Title>{t("card.title")}</Card.Title>
					<Card.Description>{t("card.description")}</Card.Description>
				</Card.Header>

				<Card.Content>
					<p className="text-sm text-neutral-600 dark:text-neutral-400">{t("card.notice")}</p>
				</Card.Content>

				<Card.Footer className="justify-end">
					<LinkButton href={href("/app/:team/checkout", props.params)}>
						{t("card.cta")}
						<ExternalLinkIcon className="size-4" aria-hidden />
					</LinkButton>
				</Card.Footer>
			</Card>
		</section>
	);
}

// =============================================================================
// Danger Zone Section
// =============================================================================

function DangerZoneSection(props: { params: { team: string }; teamName: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings.danger" });
	let fetcher = useFetcher<{ issues?: { confirmation?: string } }>();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let [confirmationValue, setConfirmationValue] = useState("");
	let isDeleteEnabled = confirmationValue === "DELETE";

	let confirmationError = fetcher.data?.issues?.confirmation;

	return (
		<section id="danger" className="mx-auto w-full max-w-2xl space-y-6">
			<hgroup>
				<h2 className="text-red-600 dark:text-red-500 text-xl font-semibold tracking-tight">
					{t("title")}
				</h2>
				<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
			</hgroup>

			<Card color="danger" className="min-[672px]:-mx-6">
				<fetcher.Form
					method="POST"
					action={href("/actions/:team/delete-team", props.params)}
					onSubmit={async (event) => {
						event.preventDefault();
						let confirmed = await confirm(t("card.title"), {
							description: t("card.warning"),
							confirmLabel: t("card.cta"),
							color: "danger",
						});
						if (confirmed) {
							fetcher.submit(event.currentTarget);
						}
					}}
				>
					<Card.Header>
						<Card.Title className="text-red-600 dark:text-red-500">{t("card.title")}</Card.Title>
						<Card.Description>{t("card.description")}</Card.Description>
					</Card.Header>

					<Card.Content className="space-y-4">
						<p className="text-red-600 dark:text-red-400 text-sm">{t("card.warning")}</p>

						<TextField
							type="text"
							name="confirmation"
							isRequired
							autoComplete="off"
							isInvalid={confirmationError !== undefined}
							value={confirmationValue}
							onChange={setConfirmationValue}
						>
							<Label>{t("card.confirmation.label")}</Label>
							<Input placeholder={t("card.confirmation.placeholder")} />
							<FieldError>{confirmationError}</FieldError>
						</TextField>
					</Card.Content>

					<Card.Footer className="justify-end">
						<Button
							type="submit"
							color="danger"
							isPending={isPending}
							isDisabled={!isDeleteEnabled}
						>
							{t("card.cta")}
						</Button>
					</Card.Footer>
				</fetcher.Form>
			</Card>
		</section>
	);
}

// =============================================================================
// Error Boundary
// =============================================================================

export function ErrorBoundary({ error, params }: Route.ErrorBoundaryProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.settings" });

	if (isRouteErrorResponse(error)) {
		let errorData = error.data as {
			hasActiveSubscription: boolean;
			ok: boolean;
		};

		return (
			<>
				<AppHeader heading={t("header.title")} />

				{errorData.hasActiveSubscription ? null : (
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

				<div className="flex flex-col gap-4 p-5 md:p-12">
					{error.status === 403 ? (
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
			<div className="flex flex-col gap-4 p-5 md:p-12">
				<h2>{t("error.unknown.title")}</h2>
				<p>{t("error.unknown.description")}</p>
			</div>
		</>
	);
}
