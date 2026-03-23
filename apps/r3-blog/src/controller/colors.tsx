import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { ColorsPage } from "~/components/pages";

export default action<typeof routes.colors>(async () => {
	let body = await renderToString(<ColorsPage />);
	return ok(body);
});
