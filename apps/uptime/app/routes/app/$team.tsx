/**
 * Layout route for the authenticated team area: its middleware chain authenticates the
 * subject, resolves the team by slug, enforces membership, and caches whether the
 * owner has an active subscription, then renders the sidebar shell around child routes.
 * It exists as the guarded parent for every per-team page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Sidebar, useSidebar } from "@pkg/ui";
import { waitUntil } from "cloudflare:workers";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { href, Outlet, redirect, useNavigation } from "react-router";
import { z } from "zod/v4";

import { AppSidebar } from "~/components/sidebar";
import { SubjectProvider } from "~/hooks/use-subject";
import { TeamProvider } from "~/hooks/use-team";
import { CustomerSubscriptionContext } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { getSession } from "~/middleware/session";
import { SubjectContext, subject } from "~/middleware/subject";
import { type Team, TeamContext, team } from "~/middleware/team";
import Customer from "~/models/customer";
import { Cache } from "~/modules/cache";

import type { Route } from "./+types/$team";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export const middleware: Route.MiddlewareFunction[] = [
	// Read subject from session and ensure it's authenticated
	async ({ context }, next) => {
		let session = getSession();

		// User is not authenticated, go to login
		if (!session.has("id")) throw redirect(href("/auth"));

		let subject = z
			.object({
				id: z.string(),
				name: z.string(),
				avatar: z.url(),
				email: z.email(),
				idToken: z.string(),
			})
			.parse(session.data);

		context.set(SubjectContext, subject);

		return await next();
	},

	// Find the team by slug and set it in the context
	async ({ request, params, context }, next) => {
		if (z.uuid().safeParse(params.team).success) {
			let team = await db().query.teams.findFirst({
				columns: { slug: true },
				where(fields, operators) {
					return operators.eq(fields.id, params.team);
				},
			});

			if (!team) throw redirect(href("/"));
			throw redirect(request.url.replace(params.team, team.slug));
		}
		let team = await db().query.teams.findFirst({
			where(fields, operators) {
				return operators.eq(fields.slug, params.team);
			},
			with: {
				memberships: {
					columns: { subjectId: true, role: true },
					where(fields, operators) {
						return operators.eq(fields.subjectId, subject().id);
					},
				},
			},
		});

		if (!team) throw redirect(href("/"));
		context.set(TeamContext, team as Team);
		return await next();
	},

	// Ensure the subject is a member of the team
	async (_, next) => {
		if (team().memberships.some((m) => m.subjectId === subject().id)) {
			return await next();
		}

		let membership = await db().query.memberships.findFirst({
			where(fields, operators) {
				return operators.eq(fields.subjectId, subject().id);
			},
			with: {
				team: {
					columns: { slug: true },
				},
			},
		});

		if (membership) {
			throw redirect(href("/app/:team", { team: membership.team.slug }));
		}

		console.error(`The subject ${subject().id} does not have any team membership`);

		throw redirect(href("/auth"));
	},

	// Check if the customer has an active subscription and store the promise
	async ({ context }, next) => {
		let promise = (async () => {
			let hasSubscription = await Cache.getOrSet(
				`customer:${team().ownerId}:has-subscription`,
				async () => {
					let result = await Customer.hasActiveSubscription(team().ownerId);
					return result.toString();
				},
				{ ttl: 60, waitUntil },
			);

			return hasSubscription === "true";
		})().catch((error) => {
			console.error("Error checking subscription:", error);
			return false;
		});

		context.set(CustomerSubscriptionContext, promise);
		return await next();
	},
];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	logger().info("team.loader.start", {
		route: "$team",
		teamId: team().id,
		subjectId: subject().id,
	});

	let memberships = await db().query.memberships.findMany({
		where(fields, operators) {
			return operators.eq(fields.subjectId, subject().id);
		},
		with: { team: true },
	});

	logger().info("team.loader.complete", {
		route: "$team",
		teamId: team().id,
		membershipCount: memberships.length,
	});

	return {
		viewer: {
			...subject(),
			isAdmin: team()
				.memberships.map((m) => m.role)
				.includes("admin"),
		},
		team: {
			id: team().id,
			slug: team().slug,
			name: team().name,
			logo: team().logo,
			ownerId: team().ownerId,
		},
		memberships,
		meta: [
			{ title: t("app.meta.title") },
			{ name: "description", content: t("app.meta.description") },
			{ name: "og:title", content: t("app.meta.title") },
			{ name: "og:description", content: t("app.meta.description") },
			{ name: "og:type", content: "website" },
			{ name: "og:url", content: request.url },
			{ name: "twitter:card", content: "summary" },
		] satisfies Route.MetaDescriptors,
	};
}

function CloseSidebarOnNavigation() {
	let navigation = useNavigation();
	let { setOpenMobile, isMobile } = useSidebar();

	useEffect(() => {
		if (isMobile && navigation.state === "loading") {
			setOpenMobile(false);
		}
	}, [navigation.state, isMobile, setOpenMobile]);

	return null;
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let teams = loaderData.memberships.map((it) => it.team);
	return (
		<TeamProvider team={loaderData.team}>
			<SubjectProvider subject={loaderData.viewer}>
				<Sidebar.Provider defaultOpen>
					<CloseSidebarOnNavigation />
					<div className="flex min-h-screen w-full font-mono">
						<div className="sticky top-0 h-screen">
							<AppSidebar team={loaderData.team} teams={teams} viewer={loaderData.viewer} />
						</div>
						<Sidebar.Inset>
							<main className="flex-1">
								<Outlet />
							</main>
						</Sidebar.Inset>
					</div>
				</Sidebar.Provider>
			</SubjectProvider>
		</TeamProvider>
	);
}

export function ErrorBoundary(props: Route.ErrorBoundaryProps) {
	let { t } = useTranslation("translation", { keyPrefix: "app.errors" });

	console.error(props.error);

	return (
		<main>
			<h1>{t("notFound.title")}</h1>
			<p>{t("notFound.description")}</p>
		</main>
	);
}
