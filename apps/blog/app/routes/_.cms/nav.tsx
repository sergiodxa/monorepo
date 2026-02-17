import { NavLink, Toolbar } from "@pkg/ui";
import { useTranslation } from "react-i18next";

export function Navigation() {
	let { t } = useTranslation("translation", { keyPrefix: "cms.layout.nav" });

	let navigation = [
		{ name: t("items.dashboard"), to: "" },
		{ name: t("items.articles"), to: "articles" },
		{ name: t("items.likes"), to: "likes" },
		{ name: t("items.tutorials"), to: "tutorials" },
		{ name: t("items.glossary"), to: "glossary" },
		{ name: t("items.cache"), to: "cache" },
		{ name: t("items.redirects"), to: "redirects" },
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
		</Toolbar>
	);
}
