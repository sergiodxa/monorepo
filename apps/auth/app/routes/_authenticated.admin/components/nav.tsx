import { Link, NavLink, Toolbar } from "@pkg/ui";
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

			<Link href={href("/profile")} className="ml-auto flex items-center gap-1.5 text-sm">
				<UserIcon className="size-4" />
				{t("items.profile")}
			</Link>
		</Toolbar>
	);
}
