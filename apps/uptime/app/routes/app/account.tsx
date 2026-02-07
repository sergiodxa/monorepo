import type { RouterContextProvider } from "react-router";

import { Sidebar } from "@pkg/ui";
import { ActivityIcon, UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Outlet, redirect, useMatch } from "react-router";
import { z } from "zod/v4";

import { UserMenu } from "~/components/user-menu";
import { SubjectProvider } from "~/hooks/use-subject";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { getSession } from "~/middleware/session";
import { SubjectContext, subject } from "~/middleware/subject";

interface LoaderData {
	viewer: {
		id: string;
		name: string;
		email: string;
		avatar: string;
		isAdmin: boolean;
	};
	teams: Array<{
		id: string;
		name: string;
		slug: string;
		logo: string | null;
	}>;
	meta: Array<{ title: string } | { name: string; content: string }>;
}

export const middleware = [
	// Read subject from session and ensure it's authenticated
	async (
		{ context }: { context: RouterContextProvider },
		next: () => Promise<Response>,
	): Promise<Response> => {
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

export async function loader({ context }: { context: RouterContextProvider }): Promise<LoaderData> {
	let { t } = i18next(context);
	let subjectId = subject().id;

	let memberships = await db().query.memberships.findMany({
		where(fields, operators) {
			return operators.eq(fields.subjectId, subjectId);
		},
		with: {
			team: true,
		},
	});

	let teams = memberships.map((membership) => ({
		id: membership.team.id,
		name: membership.team.name,
		slug: membership.team.slug,
		logo: membership.team.logo,
	}));

	return {
		viewer: {
			id: subject().id,
			name: subject().name,
			email: subject().email,
			avatar: subject().avatar,
			isAdmin: false, // Not team-specific
		},
		teams,
		meta: [
			{ title: t("page.account.meta.title") },
			{ name: "description", content: t("page.account.meta.description") },
		],
	};
}

export function meta({ data }: { data?: LoaderData }) {
	return data?.meta ?? [];
}

export default function AccountLayout({ loaderData }: { loaderData: LoaderData }) {
	return (
		<SubjectProvider subject={loaderData.viewer}>
			<Sidebar.Provider defaultOpen>
				<div className="flex min-h-screen w-full font-mono">
					<div className="sticky top-0 h-screen">
						<AccountSidebar teams={loaderData.teams} viewer={loaderData.viewer} />
					</div>
					<Sidebar.Inset>
						<main className="flex-1">
							<Outlet context={{ teams: loaderData.teams, viewer: loaderData.viewer }} />
						</main>
					</Sidebar.Inset>
				</div>
			</Sidebar.Provider>
		</SubjectProvider>
	);
}

function AccountSidebar(props: {
	teams: Array<{
		id: string;
		slug: string;
		name: string;
		logo: string | null;
	}>;
	viewer: {
		id: string;
		avatar: string;
		name: string;
		email: string;
		isAdmin: boolean;
	};
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar",
	});

	let isAccountActive = useMatch("/app/account") !== null;

	return (
		<Sidebar>
			<Sidebar.Header>
				<div className="flex h-10 items-center gap-2 px-2">
					<UsersIcon size={20} className="flex-shrink-0" />
					<span className="truncate font-semibold">{t("account.title")}</span>
				</div>
			</Sidebar.Header>

			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink
									href={href("/app/account")}
									active={isAccountActive}
									tooltip={t("account.overview")}
								>
									<UsersIcon size={16} />
									<span>{t("account.overview")}</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				{props.teams.length > 0 && (
					<Sidebar.Group>
						<Sidebar.GroupLabel>
							<span>{t("account.teams")}</span>
						</Sidebar.GroupLabel>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								{props.teams.map((team) => (
									<TeamMenuItem key={team.id} team={team} />
								))}
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				)}
			</Sidebar.Content>

			<Sidebar.Footer>
				<UserMenu user={props.viewer} />
			</Sidebar.Footer>
		</Sidebar>
	);
}

function TeamMenuItem(props: {
	team: { id: string; slug: string; name: string; logo: string | null };
}) {
	let teamPath = href("/app/:team/dashboard", { team: props.team.slug });

	return (
		<Sidebar.MenuItem>
			<Sidebar.MenuLink href={teamPath} tooltip={props.team.name}>
				<ActivityIcon size={16} />
				<span>{props.team.name}</span>
			</Sidebar.MenuLink>
		</Sidebar.MenuItem>
	);
}
