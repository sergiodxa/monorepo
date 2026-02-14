import type { RouterContextProvider } from "react-router";

import { cn } from "@pkg/cn";
import { isFailure, succeeded } from "@pkg/result";
import {
	Avatar,
	Button,
	Card,
	confirm,
	Description,
	FieldError,
	Label,
	LinkButton,
	ListBox,
	Logo,
	Menu,
	Popover,
	Select,
	Table,
} from "@pkg/ui";
import { EllipsisVerticalIcon, LoaderIcon, LogOutIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { href, Outlet, useFetcher, useFetchers, useParams } from "react-router";
import { useSpinDelay } from "spin-delay";

import type { SupportedLanguage } from "~/db/schema";

import auth from "~/clients/auth";
import { AppHeader } from "~/components/app-header";
import { db } from "~/middleware/drizzle";
import { i18next, languageNames } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { subject } from "~/middleware/subject";

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

interface LoaderData {
	user: {
		id: string;
		name: string;
		email: string;
		avatar: string;
	};
	teams: Array<{
		id: string;
		name: string;
		slug: string;
		logo: string | null;
		role: "member" | "admin" | "owner";
		membershipId: string;
	}>;
	preferredLanguage: SupportedLanguage | null;
	languageNames: Record<string, string>;
	meta: Array<{ title: string } | { name: string; content: string }>;
}

export async function loader({ context }: { context: RouterContextProvider }): Promise<LoaderData> {
	let { t } = i18next(context);
	let subjectId = subject().id;

	logger().info("account.loader.start", { subjectId });

	let [memberships, tokenResult, userPreferences] = await Promise.all([
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
		measure("findUserPreferences", async () => {
			return db().query.userPreferences.findFirst({
				where(fields, operators) {
					return operators.eq(fields.subjectId, subjectId);
				},
			});
		}),
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
		preferredLanguage: userPreferences?.preferredLanguage ?? null,
		languageNames,
		meta: [
			{ title: t("page.account.meta.title") },
			{ name: "description", content: t("page.account.meta.description") },
		],
	};
}

export function meta({ data }: { data?: LoaderData }) {
	return data?.meta ?? [];
}

export default function Component({ loaderData }: { loaderData: LoaderData }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.account" });
	let params = useParams();

	return (
		<>
			<AppHeader heading={t("header.title")}>
				<LinkButton
					href={href("/app/:team/account/create-team", params as { team: string })}
					color="neutral"
					className="shrink-0 px-2"
				>
					<PlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("teams.actions.createTeam")}</span>
				</LinkButton>
			</AppHeader>

			<div className="mx-auto flex w-full max-w-2xl flex-col gap-16 p-5 md:p-12">
				{/* User Profile Section */}
				<ProfileSection user={loaderData.user} />

				{/* Language Preference Section */}
				<LanguageSection
					preferredLanguage={loaderData.preferredLanguage}
					languageNames={loaderData.languageNames}
				/>

				{/* Teams Section */}
				<TeamsSection teams={loaderData.teams} userId={loaderData.user.id} />
			</div>

			{/* Nested route for create team dialog */}
			<Outlet />
		</>
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
					<Avatar size="lg" className="size-16">
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
// Language Section
// =============================================================================

function LanguageSection(props: {
	preferredLanguage: SupportedLanguage | null;
	languageNames: Record<string, string>;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.account.language" });
	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	// Build options: auto-detect + all supported languages
	let languageOptions = [
		{ id: "auto", name: t("form.fields.language.options.auto") },
		...Object.entries(props.languageNames).map(([code, name]) => ({
			id: code,
			name,
		})),
	];

	let currentValue = props.preferredLanguage ?? "auto";

	return (
		<section id="language" className="space-y-6">
			<hgroup>
				<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
				<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
			</hgroup>

			<Card>
				<fetcher.Form method="POST" action={href("/actions/update-language")}>
					<Card.Content className="space-y-6 p-6">
						<Select name="language" defaultSelectedKey={currentValue} className="w-full max-w-xs">
							<Label>{t("form.fields.language.label")}</Label>
							<Select.Trigger />
							<FieldError />
							<Description>{t("form.fields.language.description")}</Description>
							<Popover>
								<ListBox items={languageOptions}>
									{(item) => <Select.Item id={item.id}>{item.name}</Select.Item>}
								</ListBox>
							</Popover>
						</Select>
					</Card.Content>

					<Card.Footer className="justify-end">
						<Button type="submit" isPending={isPending}>
							{t("form.cta")}
						</Button>
					</Card.Footer>
				</fetcher.Form>
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
			<hgroup>
				<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
				<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
			</hgroup>

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
