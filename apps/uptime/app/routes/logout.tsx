import { useTranslation } from "react-i18next";
import { Form, href, redirect } from "react-router";

import { Button } from "~/components/ui/button";
import { getSession } from "~/middleware/session";
import { logout } from "~/modules/auth";

import type { Route } from "./+types/logout";

export async function loader(_: Route.LoaderArgs) {
	if (getSession().has("id")) return null;
	return redirect(href("/"));
}

export async function action(_: Route.ActionArgs) {
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
