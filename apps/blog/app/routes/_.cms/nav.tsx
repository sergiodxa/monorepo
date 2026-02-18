import { Button, Form, NavLink, Toolbar } from "@pkg/ui";
import { LogOutIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

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

			<div className="flex-1" />

			<Form method="POST" action={href("/auth/logout")}>
				<Button type="submit" color="neutral" variant="outline" size="sm">
					<LogOutIcon className="size-4" />
					{t("items.logout")}
				</Button>
			</Form>
		</Toolbar>
	);
}
