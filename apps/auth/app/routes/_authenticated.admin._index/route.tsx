import { ok } from "@pkg/response";
import { KeyRoundIcon, UsersIcon, ZapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppHeader } from "~/components/app-header";
import { StatCard } from "~/components/stat-card";
import { db } from "~/middleware/drizzle";

import type { Route } from "./+types/route";

import { getDashboardStats } from "./query.server";

export async function loader(_: Route.LoaderArgs) {
	let stats = await getDashboardStats(db());
	return ok({ stats });
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "admin.dashboard" });
	let { stats } = loaderData;

	return (
		<>
			<AppHeader heading={t("title")} />

			<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard
					icon={<KeyRoundIcon className="size-4" />}
					label={t("stats.clients.label")}
					value={stats.clients}
					description={t("stats.clients.description")}
				/>
				<StatCard
					icon={<UsersIcon className="size-4" />}
					label={t("stats.subjects.label")}
					value={stats.subjects}
					description={t("stats.subjects.description")}
				/>
				<StatCard
					icon={<ZapIcon className="size-4" />}
					label={t("stats.sessions.label")}
					value={stats.activeSessions}
					description={t("stats.sessions.description")}
				/>
			</div>
		</>
	);
}
