import { cn } from "@pkg/cn";
import { isFailure, succeeded } from "@pkg/result";
import { Avatar, Button, Card, confirm, LinkButton, Logo, Menu, Popover, Table } from "@pkg/ui";
import { EllipsisVerticalIcon, LoaderIcon, LogOutIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { href, redirect, useFetcher, useFetchers } from "react-router";
import { useSpinDelay } from "spin-delay";
import { z } from "zod/v4";

import auth from "~/clients/auth";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { getSession } from "~/middleware/session";
import { SubjectContext, subject } from "~/middleware/subject";

import type { Route } from "./+types/route";

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

export const middleware: Route.MiddlewareFunction[] = [
	// Read subject from session and ensure it's authenticated
	async ({ context }, next) => {
		let session = getSession();

		// User is not authenticated, go to login
		if (!session.has("id")) throw redirect(href("/auth"));

		let subjectData = z
			.object({
				id: z.string(),
				name: z.string(),
				avatar: z.url(),
				email: z.email(),
			})
			.parse(session.data);

		context.set(SubjectContext, subjectData);

		return await next();
	},
];

export async function loader({ context }: Route.LoaderArgs) {
	let { t } = i18next(context);
	let subjectId = subject().id;

	logger().info("account.loader.start", { subjectId });

	let [memberships, tokenResult] = await Promise.all([
		measure("findUserMemberships", async () => {
			return db().query.memberships.findMany({
				where(fields, operators) {
					return operators.eq(fields.subjectId, subjectId);
				},
				with: {
					team: true,
				},
			});
		}),
		measure("authenticate", () => auth.authenticate()),
	]);

	succeeded(tokenResult, "Failed to authenticate with auth service");

	// Get user profile info from auth service
	let userProfileResult = await measure("fetchUserProfile", async () => {
		return auth.fetchSubjectById(subjectId, tokenResult.data);
	});

	if (isFailure(userProfileResult)) {
		logger().error("account.loader.profile-fetch-failed", {
			subjectId,
			error: userProfileResult.error.message,
		});
		throw new Error("Failed to fetch user profile");
	}

	// Enrich memberships with team owner info
	let teamsWithRole = await Promise.all(
		memberships.map(async (membership) => {
			let isOwner = membership.team.ownerId === subjectId;
			return {
				id: membership.team.id,
				name: membership.team.name,
				slug: membership.team.slug,
				logo: membership.team.logo,
				role: isOwner ? ("owner" as const) : membership.role,
				membershipId: membership.id,
			};
		}),
	);

	logger().info("account.loader.success", {
		subjectId,
		teamCount: teamsWithRole.length,
	});

	return {
		user: {
			id: userProfileResult.data.id,
			name: userProfileResult.data.displayName,
			email: userProfileResult.data.emailAddress,
			avatar: userProfileResult.data.avatar,
		},
		teams: teamsWithRole,
		meta: [
			{ title: t("page.account.meta.title") },
			{ name: "description", content: t("page.account.meta.description") },
		] satisfies Route.MetaDescriptors,
	};
}

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.account" });

	return (
		<div className="flex min-h-screen w-full flex-col bg-neutral-50 font-mono dark:bg-neutral-950">
			<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
				<h1>{t("header.title")}</h1>
			</header>

			<div className="mx-auto flex w-full max-w-2xl flex-col gap-16 p-12">
				{/* User Profile Section */}
				<ProfileSection user={loaderData.user} />

				{/* Teams Section */}
				<TeamsSection teams={loaderData.teams} userId={loaderData.user.id} />
			</div>
		</div>
	);
}

// =============================================================================
// Profile Section
// =============================================================================

function ProfileSection(props: {
	user: {
		id: string;
		name: string;
		email: string;
		avatar: string;
	};
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.account.profile" });

	return (
		<section id="profile" className="space-y-6">
			<hgroup>
				<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
				<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
			</hgroup>

			<Card>
				<Card.Content className="flex items-center gap-6 p-6">
					<Avatar size="xl">
						{props.user.avatar ? (
							<Avatar.Image src={props.user.avatar} alt="" />
						) : (
							<Avatar.Fallback>{getMemberInitials(props.user.name)}</Avatar.Fallback>
						)}
					</Avatar>

					<div className="flex flex-col gap-1">
						<span className="text-xl font-semibold">{props.user.name}</span>
						<a
							href={`mailto:${props.user.email}`}
							className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
						>
							{props.user.email}
						</a>
					</div>
				</Card.Content>
			</Card>
		</section>
	);
}

// =============================================================================
// Teams Section
// =============================================================================

type Team = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	role: "member" | "admin" | "owner";
	membershipId: string;
};

function TeamsSection(props: { teams: Team[]; userId: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.account.teams" });
	let id = useId();
	let fetchers = useFetchers();

	// Get IDs of teams being left for optimistic UI
	let leavingTeamIds = new Set(
		fetchers
			.filter((f) => f.formAction?.includes("/leave-team") && f.formData)
			.map((f) => f.formData?.get("teamId") as string),
	);

	// Filter out teams that are being left
	let visibleTeams = props.teams.filter((team) => !leavingTeamIds.has(team.id));

	let columns = [
		{ id: "team" as const, name: t("table.columns.team"), align: "left" as const },
		{ id: "role" as const, name: t("table.columns.role"), align: "right" as const },
		{ id: "actions" as const, name: t("table.columns.actions"), align: "center" as const },
	];

	return (
		<section id="teams" className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<hgroup>
					<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
					<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
				</hgroup>
				<LinkButton color="neutral" href={href("/app/account/new-team")} className="flex-shrink-0">
					<PlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("actions.createTeam")}</span>
				</LinkButton>
			</div>

			{visibleTeams.length === 0 ? (
				<Card>
					<Card.Content className="flex flex-col items-center justify-center gap-4 p-12 text-center">
						<UsersIcon className="size-12 text-neutral-400" aria-hidden />
						<div>
							<p className="font-medium">{t("empty.title")}</p>
							<p className="text-sm text-neutral-500 dark:text-neutral-400">
								{t("empty.description")}
							</p>
						</div>
						<LinkButton href={href("/app/account/new-team")}>{t("empty.cta")}</LinkButton>
					</Card.Content>
				</Card>
			) : (
				<Card>
					<Card.Header>
						<Card.Title>{t("table.label")}</Card.Title>
						<Card.Description>{t("table.description")}</Card.Description>
					</Card.Header>

					<Card.Content className="p-0">
						<Table aria-labelledby={`${id}-teams-table`}>
							<Table.Header columns={columns}>
								{(column) => (
									<Table.Column align={column.align} isRowHeader={column.id === "team"}>
										<span className={cn({ "sr-only": column.id === "actions" })}>
											{column.name}
										</span>
									</Table.Column>
								)}
							</Table.Header>

							<Table.Body items={visibleTeams}>
								{(team) => <TeamTableRow team={team} userId={props.userId} />}
							</Table.Body>
						</Table>
					</Card.Content>
				</Card>
			)}
		</section>
	);
}

function TeamTableRow(props: { team: Team; userId: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.account.teams" });

	// User can only leave teams where they're a member (not owner or admin)
	let canLeave = props.team.role === "member";

	let leaveTeamFetcher = useFetcher();
	let isLeavingTeam = useSpinDelay(leaveTeamFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	return (
		<Table.Row>
			<Table.Cell>
				<div className="flex items-center gap-3">
					<Logo size="md">
						{props.team.logo ? (
							<Logo.Image src={props.team.logo} alt="" />
						) : (
							<Logo.Fallback>{getTeamInitials(props.team.name)}</Logo.Fallback>
						)}
					</Logo>

					<a
						href={href("/app/:team", { team: props.team.slug })}
						className="text-lg font-medium hover:underline"
					>
						{props.team.name}
					</a>
				</div>
			</Table.Cell>

			<Table.Cell className="w-36 text-right">{t(`table.role.${props.team.role}`)}</Table.Cell>

			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button
						type="button"
						className={cn("ml-auto p-2", {
							hidden: !canLeave,
						})}
						color="neutral"
					>
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("table.actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							{canLeave && (
								<Menu.Item
									danger
									isDisabled={!canLeave || isLeavingTeam}
									onAction={async () => {
										let confirmed = await confirm(
											t("table.confirmation.leaveTeam", { name: props.team.name }),
										);
										if (confirmed) {
											leaveTeamFetcher.submit(
												{
													teamId: props.team.id,
													teamName: props.team.name,
												},
												{
													method: "POST",
													action: href("/actions/leave-team"),
												},
											);
										}
									}}
								>
									<LogOutIcon aria-hidden className="size-5" />
									<span>{t("table.actions.leave")}</span>
									{isLeavingTeam && (
										<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
									)}
								</Menu.Item>
							)}
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}
