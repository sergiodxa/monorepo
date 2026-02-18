import { LinkButton, NavLink, Toolbar } from "@pkg/ui";
import { UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

export function Navigation() {
	let { t } = useTranslation("translation", { keyPrefix: "admin.nav" });

	let navigation = [
		{ name: t("items.dashboard"), to: "" },
		{ name: t("items.clients"), to: "clients" },
		{ name: t("items.subjects"), to: "subjects" },
	] as const;

	return (
		<Toolbar
			aria-label={t("label")}
			className="flex-wrap items-center gap-4 border-b border-neutral-200 dark:border-neutral-700"
		>
			{navigation.map((link) => (
				<NavLink key={link.name} to={link.to} end={link.to === ""} hasBackground>
					{link.name}
				</NavLink>
			))}

			<div className="flex-1" />

			<LinkButton href={href("/profile")} color="neutral" variant="outline" size="sm">
				<UserIcon className="size-4" />
				{t("items.profile")}
			</LinkButton>
		</Toolbar>
	);
}
