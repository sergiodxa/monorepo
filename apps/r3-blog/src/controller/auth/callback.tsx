import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { verifyIdToken } from "~/entities/id-token";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { User } from "~/models/user";
import { authenticate } from "~/modules/oauth";
import { LoginView } from "~/views/auth/login";

export default action<typeof routes.auth.callback>(async (ctx) => {
	let auth = authState();

	if (auth.isAuthenticated) {
		return redirect("/cms", { status: redirect.Status.SeeOther });
	}

	let tokens = await authenticate(ctx.request);
	if (tokens instanceof Response) {
		let body = await renderToString(
			<BlogLayout title="Login" description="Authenticate to access CMS tools" activePath="/login">
				<LoginView error="Authentication failed. Please try again." />
			</BlogLayout>,
		);

		return ok(body);
	}

	let idToken = await verifyIdToken(tokens.idToken());
	let user = await User.findOrCreateFromAuthProfile(db(ctx), {
		subjectId: idToken.subject,
		email: idToken.email,
		avatar: idToken.picture,
		username: idToken.username,
		displayName: idToken.name,
	});

	auth.login(user);
	auth.setIdToken(tokens.idToken());

	return redirect("/cms", { status: redirect.Status.SeeOther });
});
