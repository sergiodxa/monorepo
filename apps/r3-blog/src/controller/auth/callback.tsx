import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { User } from "~/models/user";
import {
	clearAuthFlowCookies,
	exchangeCode,
	fetchUserProfile,
	readAuthNext,
	readAuthState,
} from "~/modules/auth";
import { LoginView } from "~/views/login";

export default action<typeof routes.auth.callback>(async (ctx) => {
	if (ctx.auth.isAuthenticated) {
		return redirect("/cms", { status: redirect.Status.SeeOther });
	}

	let url = new URL(ctx.request.url);
	let code = url.searchParams.get("code");
	let state = url.searchParams.get("state");

	if (!code || !state) {
		return redirect("/login", { status: redirect.Status.SeeOther });
	}

	let expectedState = readAuthState(ctx.request);
	if (!expectedState || expectedState !== state) {
		let body = await renderToString(
			<BlogLayout title="Login" description="Authenticate to access CMS tools" activePath="/login">
				<LoginView next="/cms" error="Authentication state mismatch. Please try again." />
			</BlogLayout>,
		);

		let response = ok(body);

		for (let cookie of clearAuthFlowCookies()) {
			response.headers.append("Set-Cookie", cookie);
		}

		return response;
	}

	let tokens = await exchangeCode(ctx.request, code);
	let profile = await fetchUserProfile(tokens.accessToken);
	let user = await User.findOrCreateFromAuthProfile(db(ctx), {
		subjectId: profile.subjectId,
		email: profile.email,
		avatar: profile.avatar,
		username: profile.username,
		displayName: profile.name,
	});

	ctx.auth.login(user);
	ctx.auth.setIdToken(tokens.idToken);

	let nextPath = readAuthNext(ctx.request);
	let response = redirect(nextPath, { status: redirect.Status.SeeOther });

	for (let cookie of clearAuthFlowCookies()) {
		response.headers.append("Set-Cookie", cookie);
	}

	return response;
});
