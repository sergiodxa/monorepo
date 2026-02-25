import { Button, Form, LinkButton, NavLink, Toolbar } from "@pkg/ui";
import { AppWindowIcon, LayoutDashboardIcon, LogOutIcon, UserIcon, UsersIcon } from "lucide-react";
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
				<span className="flex items-center gap-1.5">
					<LayoutDashboardIcon className="size-4" />
					{t("items.dashboard")}
				</span>
			</NavLink>
			<NavLink to="clients" hasBackground>
				<span className="flex items-center gap-1.5">
					<AppWindowIcon className="size-4" />
					{t("items.clients")}
				</span>
			</NavLink>
			<NavLink to="subjects" hasBackground>
				<span className="flex items-center gap-1.5">
					<UsersIcon className="size-4" />
					{t("items.subjects")}
				</span>
			</NavLink>

			<div className="flex-1" />

			<LinkButton href={href("/account/profile")} color="neutral" variant="outline" size="sm">
				<UserIcon className="size-4" />
				{t("items.profile")}
			</LinkButton>

			<Form method="POST" action={href("/oidc/logout")}>
				<Button type="submit" color="neutral" variant="outline" size="sm">
					<LogOutIcon className="size-4" />
					{t("items.logout")}
				</Button>
			</Form>
		</Toolbar>
	);
}
