import { Button } from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { Form, href, redirect } from "react-router";

import { logger } from "~/middleware/logger";
import { getSession } from "~/middleware/session";
import { logout } from "~/modules/auth";

import type { Route } from "./+types/logout";

export async function loader(_: Route.LoaderArgs) {
	logger().info("logout.loader.start", {
		route: "logout",
	});

	if (getSession().has("id")) {
		logger().info("logout.loader.complete", {
			route: "logout",
			hasSession: true,
		});
		return null;
	}

	logger().info("logout.loader.redirect-no-session", {
		route: "logout",
	});

	return redirect(href("/"));
}

export async function action(_: Route.ActionArgs) {
	logger().info("logout.action.start", {
		route: "logout",
	});

	return await logout();
}

export default function Component() {
	let { t } = useTranslation("translation", { keyPrefix: "page.logout" });
	return (
		<Form
			method="POST"
			className="mx-auto flex max-w-screen-sm flex-col items-center gap-10 pt-10"
			reloadDocument
		>
			<header className="sm:mx-auto sm:w-full sm:max-w-lg">
				<h2 className="text-center text-3xl font-bold tracking-tight">{t("title")}</h2>
			</header>

			<Button type="submit">{t("cta")}</Button>
		</Form>
	);
}
