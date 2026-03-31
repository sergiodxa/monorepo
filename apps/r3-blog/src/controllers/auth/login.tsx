import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { authState } from "~/middleware/auth-state";
import { authenticate } from "~/modules/oauth";
import { LoginView } from "~/views/auth/login";

export default controller<typeof routes.auth.login>({
	middleware: [
		async () => {
			if (authState().isAuthenticated) {
				return redirect("/cms", { status: redirect.Status.SeeOther });
			}
		},
	],
	actions: {
		async index() {
			if (authState().isAuthenticated) {
				return redirect("/cms", { status: redirect.Status.SeeOther });
			}

			let body = await renderToString(
				<BlogLayout
					title="Login"
					description="Authenticate to access CMS tools"
					activePath="/login"
				>
					<LoginView />
				</BlogLayout>,
			);

			return ok(body);
		},

		async action(ctx) {
			let response = await authenticate(ctx.request);
			if (response instanceof Response) return response;
			return redirect("/login", { status: redirect.Status.SeeOther });
		},
	},
});
