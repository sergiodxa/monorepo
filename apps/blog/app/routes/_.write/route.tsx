/**
 * Route for the authoring surface at /write, rendering the shared Markdown
 * Editor inside a centered layout. Its loader resolves the localized page title
 * via i18next for the document meta, giving authors a dedicated screen to draft
 * new content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";

import { getI18nextInstance, getLocale } from "~/middleware/i18next";
import { Editor } from "~/routes/components.editor/route";

import type { Route } from "./+types/route";

export async function loader(_: Route.LoaderArgs) {
	let i18n = getI18nextInstance();
	let t = i18n.getFixedT(getLocale());

	let meta: Route.MetaDescriptors = [{ title: t("write.title") }];

	return ok({ meta });
}

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export default function Component() {
	return (
		<main className="mx-auto max-w-7xl">
			<Editor key="editor" />
		</main>
	);
}
