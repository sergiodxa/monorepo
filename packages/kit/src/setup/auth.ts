/**
 * `sdxc setup auth`: OIDC relying-party wiring against r3-auth (default), reduced to the
 * template's session/`actor` world — initializer, middleware, controllers, routes, secrets and
 * a `signIn()` test helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { CONFIG_FILE, ENV_EXAMPLE_FILE, declaredBindings, exampleKeys } from "../doctor/env.js";

import type { SetupPlan } from "./plan.js";

import { creditSetupFiles } from "./credit.js";
import { readProjectFile } from "./plan.js";

/** Builds the auth setup plan for `provider` (currently only `r3-auth`). */
export async function planAuth(root: string, provider: string): Promise<Result<SetupPlan, Error>> {
	if (provider !== "r3-auth") {
		return failure(
			new Error(`Unknown auth provider "${provider}"; this release ships r3-auth only`),
		);
	}
	let config = await readProjectFile(root, CONFIG_FILE);
	if (isFailure(config)) return config;
	let example = await readProjectFile(root, ENV_EXAMPLE_FILE);
	let exampleText = isFailure(example) ? "" : example.data;
	let bindings = declaredBindings(config.data);
	let listed = exampleKeys(exampleText);
	let secrets = ["CLIENT_ID", "CLIENT_SECRET"] as const;
	let configAfter = config.data;
	let exampleAfter = exampleText;
	let edits: SetupPlan["edits"] = [];
	for (let key of secrets) {
		if (!bindings.has(key)) {
			let inserted = insertSecret(configAfter, key);
			if (isFailure(inserted)) return inserted;
			configAfter = inserted.data;
		}
		if (!listed.has(key)) {
			exampleAfter =
				exampleAfter === ""
					? `${key}=\n`
					: exampleAfter.endsWith("\n")
						? `${exampleAfter}${key}=\n`
						: `${exampleAfter}\n${key}=\n`;
		}
	}
	if (configAfter !== config.data) {
		edits.push({ path: CONFIG_FILE, before: config.data, after: configAfter });
	}
	if (exampleAfter !== exampleText) {
		edits.push({
			path: ENV_EXAMPLE_FILE,
			before: exampleText,
			after: exampleAfter,
		});
	}
	let files = await creditSetupFiles(root, [
		{ path: "app/initializers/issuer.ts", content: ISSUER },
		{ path: "app/initializers/relying-party.ts", content: RELYING_PARTY },
		{ path: "app/http/middleware/auth.ts", content: AUTH_MIDDLEWARE },
		{ path: "app/http/controllers/auth.tsx", content: AUTH_CONTROLLER },
		{ path: "routes/auth.ts", content: AUTH_ROUTES },
		{ path: "app/test/session.ts", content: SESSION_HELPER },
	]);
	return success({
		feature: "auth",
		provider,
		files,
		edits,
		dependencies: ["@sdxc/auth", "@sdxc/jwt"],
		notes: [
			"Map routes/auth.ts in the web router with lazy(() => import(…)).",
			"Point app/initializers/issuer.ts at your r3-auth deployment.",
			"Add CLIENT_ID / CLIENT_SECRET to the issuer's client registration.",
			"Run sdxc run typegen after the secrets land.",
			"Fill signIn() / mapProfile once the local account model exists.",
		],
	});
}

function insertSecret(source: string, key: string): Result<string, Error> {
	let env = /env\s*:\s*\{/.exec(source);
	if (env === null || env.index === undefined) {
		return failure(new Error(`${CONFIG_FILE} has no env: { … } block to edit`));
	}
	let start = env.index + env[0].length;
	return success(
		`${source.slice(0, start)}\n\t\t\t${key}: bindings.secret(),${source.slice(start)}`,
	);
}

const ISSUER = `/**
 * The OpenID Connect issuer this app trusts — the r3-auth deployment that issues ID tokens.
 */

import { Issuer } from "@sdxc/auth/issuer";

/** The issuer URL; replace with the r3-auth origin before the first login. */
const ISSUER_URL = "https://auth.example.com";

/** The issuer every relying-party login verifies tokens against. */
export function issuer(): Issuer {
	return new Issuer(new URL(ISSUER_URL));
}
`;

const RELYING_PARTY = `/**
 * The confidential OIDC client that signs a visitor in: authorization redirect, callback that
 * verifies the ID token, provider logout, and the session scheme auth middleware resolves.
 */

import { RelyingParty } from "@sdxc/auth/relying-party";
import { JWK } from "@sdxc/jwt";

import { getEnv } from "~/app/http/middleware/env";
import { issuer } from "~/app/initializers/issuer";
import routes from "~/routes/auth";

/**
 * The client for the request's own origin. Replace the issuer URL with the r3-auth deployment
 * this app registers against, and map verified claims onto the local session actor.
 *
 * @param url - The current request URL the callback is built against.
 */
export function relyingParty(url: URL | string): RelyingParty<{ id: string }> {
	return new RelyingParty<{ id: string }>(issuer(), {
		clientId: getEnv("CLIENT_ID"),
		clientSecret: getEnv("CLIENT_SECRET"),
		redirectUri: new URL(routes.callback.href(), url),
		clientAuth: "client_secret_basic",
		algorithms: [JWK.Algorithm.ES256],
		fallbackReturnTo: "/",
		mapProfile(claims) {
			let subject = typeof claims.sub === "string" ? claims.sub : null;
			if (subject === null) throw new Error("ID token is missing sub");
			return { id: subject };
		},
	});
}
`;

const AUTH_MIDDLEWARE = `/**
 * Session helpers for the relying party: whether a visitor is signed in, and the login /
 * logout actions controllers call.
 */

import { getContext } from "remix/middleware/async-context";

/** Whether the current session holds an actor. */
export function isAuthenticated(): boolean {
	let ctx = getContext<{ session: { get(key: string): unknown } }>();
	return ctx.session.get("actor") != null;
}

/** Stores \`actor\` on the session after a successful callback. */
export function login(actor: { id: string }): void {
	let ctx = getContext<{ session: { set(key: string, value: unknown): void } }>();
	ctx.session.set("actor", actor);
}

/** Clears the session actor on logout. */
export function logout(): void {
	let ctx = getContext<{ session: { unset(key: string): void } }>();
	ctx.session.unset("actor");
}
`;

const AUTH_CONTROLLER = `/**
 * Login, callback and logout controllers for the OIDC relying party. Fill the views and the
 * return-path helpers for the app's own routes.
 */

import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { createController } from "remix/router";

import { isAuthenticated, login, logout } from "~/app/http/middleware/auth";
import { relyingParty } from "~/app/initializers/relying-party";
import routes from "~/routes/auth";

/** Starts the authorization-code flow, or sends an already-signed-in visitor home. */
export default createController({
	async login(ctx) {
		if (isAuthenticated()) return redirect("/", { status: redirect.Status.SeeOther });
		return relyingParty(ctx.url).authorize(contextOf(ctx));
	},
	async callback(ctx) {
		let grant = await relyingParty(ctx.url).callback(contextOf(ctx));
		login(grant.profile);
		return redirect("/", { status: redirect.Status.SeeOther });
	},
	async logout(ctx) {
		logout();
		return relyingParty(ctx.url).logout(contextOf(ctx), { postLogoutRedirectUri: routes.login.href() });
	},
});
`;

const AUTH_ROUTES = `/**
 * Auth routes the relying-party controllers answer: login, callback and logout.
 */

import { get, routes } from "remix/routes";

export default routes({
	login: get("/login"),
	callback: get("/auth/callback"),
	logout: get("/logout"),
});
`;

const SESSION_HELPER = `/**
 * Test helper that signs a visitor in by setting the session actor the auth middleware reads.
 */

/** Puts \`actor\` on the test session the way a completed login would. */
export function signIn(session: { set(key: string, value: unknown): void }, actor = { id: "user_test" }): void {
	session.set("actor", actor);
}
`;
