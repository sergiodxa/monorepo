import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import { BlogLayout } from "~/components/layout/blog";
import routes from "~/routes";
import { ColorsView } from "~/views/colors";

export default action<typeof routes.colors>(async () => {
	let body = await renderToString(
		<BlogLayout
			title="Color Palette"
			description="R3 Blog color tokens"
			activePath={routes.colors.href()}
		>
			<ColorsView />
		</BlogLayout>,
	);

	return ok(body);
});
