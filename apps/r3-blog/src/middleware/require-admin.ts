import { redirect } from "@pkg/http/response";
import middleware from "@pkg/remix-helpers/middleware";

import { authState } from "~/middleware/auth-state";
import routes from "~/routes";

export default middleware((_ctx, next) => {
	let user = authState().user;
	if (user?.role === "admin") return next();
	return redirect(routes.feed.href(), { status: redirect.Status.SeeOther });
});
