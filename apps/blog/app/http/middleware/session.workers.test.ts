/**
 * Pins that a session cookie is trusted only under the configured `COOKIE_SESSION_SECRET`:
 * a request arriving without one is refused outright, so a cookie signed with a key
 * anyone could know never signs an admin in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { migratedDatabase } from "~/app/test/d1";
import { seedAdmin, signedInCookie } from "~/app/test/session";
import routes from "~/routes/web";

import createApplication from "../../../bootstrap/app";

/** The secret the app holds when it is configured. */
const SECRET = "configured-secret";

/** The public key the session cookie used to be signed with whenever the secret was unset. */
const PUBLIC_DEFAULT_SECRET = "s3cr3t";

/**
 * A full `App.Env` over the real bindings. `undefined` stands for a binding that was
 * never provisioned, which the type rules out and a misconfigured Worker still produces.
 */
function environment(secret: string | undefined): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: secret as string,
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => {},
	};
}

/** Opens the CMS dashboard as the browser holding `cookie`, empty for one holding none. */
function openDashboard(secret: string | undefined, cookie: string) {
	return createApplication(environment(secret)).fetch(
		new Request(new URL(routes.cms.dashboard.href(), "https://blog.test"), {
			headers: { cookie },
			redirect: "manual",
		}),
	);
}

let adminId = "";

beforeAll(async () => {
	adminId = await seedAdmin(await migratedDatabase());
});

/**
 * The unset case runs first, on an isolate that has built no session middleware yet, which
 * is the state a misconfigured deploy serves its first request in.
 */
describe("the session secret", () => {
	test("refuses the request when unset, so a cookie signed with the public default opens nothing", async () => {
		let response = await openDashboard(
			undefined,
			await signedInCookie(adminId, PUBLIC_DEFAULT_SECRET),
		);

		expect(response.status).toBe(500);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	test("refuses the request when empty, before any page is rendered", async () => {
		let response = await openDashboard("", "");

		expect(response.status).toBe(500);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	test("signs an admin in with a cookie signed under the configured secret", async () => {
		let response = await openDashboard(SECRET, await signedInCookie(adminId, SECRET));

		expect(response.status).toBe(200);
	});
});
