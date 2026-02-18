import { LinkButton, NavLink, Toolbar } from "@pkg/ui";
import { AppWindowIcon, LayoutDashboardIcon, UserIcon, UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

export function Navigation() {
	let { t } = useTranslation("translation", { keyPrefix: "admin.nav" });

	return (
		<Toolbar
			aria-label={t("label")}
			className="flex-wrap items-center gap-4 border-b border-neutral-200 dark:border-neutral-700"
		>
			<NavLink to="" end hasBackground>
				<LayoutDashboardIcon className="size-4" />
				{t("items.dashboard")}
			</NavLink>
			<NavLink to="clients" hasBackground>
				<AppWindowIcon className="size-4" />
				{t("items.clients")}
			</NavLink>
			<NavLink to="subjects" hasBackground>
				<UsersIcon className="size-4" />
				{t("items.subjects")}
			</NavLink>

			<div className="flex-1" />

			<LinkButton href={href("/profile")} color="neutral" variant="outline" size="sm">
				<UserIcon className="size-4" />
				{t("items.profile")}
			</LinkButton>
		</Toolbar>
	);
}
