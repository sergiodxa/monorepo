import { Button, Form, LinkButton, NavLink, Toolbar } from "@pkg/ui";
import { LogOutIcon, MonitorSmartphoneIcon, ShieldIcon, UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

interface AccountNavProps {
	isAdmin: boolean;
}

export function AccountNav({ isAdmin }: AccountNavProps) {
	let { t } = useTranslation("translation", { keyPrefix: "account.nav" });

	return (
		<Toolbar
			aria-label={t("label")}
			className="mb-6 flex-wrap items-center gap-4 border-b border-neutral-200 dark:border-neutral-700"
		>
			<NavLink to="/profile" end hasBackground>
				<span className="flex items-center gap-1.5">
					<UserIcon className="size-4" />
					{t("items.profile")}
				</span>
			</NavLink>
			<NavLink to="/sessions" hasBackground>
				<span className="flex items-center gap-1.5">
					<MonitorSmartphoneIcon className="size-4" />
					{t("items.sessions")}
				</span>
			</NavLink>

			<div className="flex-1" />

			{isAdmin && (
				<LinkButton href={href("/admin")} color="neutral" variant="outline" size="sm">
					<ShieldIcon className="size-4" />
					{t("items.admin")}
				</LinkButton>
			)}

			<Form method="POST" action={href("/oidc/logout")}>
				<Button type="submit" color="neutral" variant="outline" size="sm">
					<LogOutIcon className="size-4" />
					{t("items.logout")}
				</Button>
			</Form>
		</Toolbar>
	);
}
