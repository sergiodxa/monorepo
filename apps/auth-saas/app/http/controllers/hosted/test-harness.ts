/**
 * A fully-provisioned tenant, a registered client, and a real tenant router
 * mapping every hosted-screen and `/authorize` route, for driving the hosted
 * sign-in, sign-up, verify, reset, consent and error flow through real HTTP
 * requests the way `oauth/token.test.ts` drives the token endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import authorize from "~/app/http/controllers/authorize";
import { consentShow, consentSubmit } from "~/app/http/controllers/hosted/consent";
import { errorShow } from "~/app/http/controllers/hosted/error";
import { resetShow, resetSubmit } from "~/app/http/controllers/hosted/reset";
import { signInShow, signInSubmit } from "~/app/http/controllers/hosted/sign-in";
import {
	signInPasskeyOptions,
	signInPasskeyVerify,
} from "~/app/http/controllers/hosted/sign-in-passkey";
import { signUpShow, signUpSubmit } from "~/app/http/controllers/hosted/sign-up";
import { verifyResend, verifyShow } from "~/app/http/controllers/hosted/verify";
import i18n from "~/app/http/middleware/i18n";
import render from "~/app/http/middleware/render";
import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
	tenant,
} from "~/app/http/middleware/tenant";
import Tenant from "~/database/tenant-do";
import routes from "~/routes/tenant";

export const TENANT_ID = "tenant_1";
export const ISSUER = `https://${TENANT_ID}.example.com`;
export const REDIRECT_URI = "https://example.com/callback";

/** Builds the tenant router wired to a constructed Durable Object, mapping every hosted route. */
function buildRouter(tenantDO: Tenant) {
	let middleware: Middleware[] = [
		tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		render as Middleware,
		formData() as Middleware,
		i18n as Middleware,
	];
	let router = createRouter({ middleware });

	router.map(routes.authorize, authorize);
	router.map(routes.hostedSignInShow, signInShow);
	router.map(routes.hostedSignInSubmit, signInSubmit);
	router.map(routes.hostedSignInPasskeyOptions, signInPasskeyOptions);
	router.map(routes.hostedSignInPasskeyVerify, signInPasskeyVerify);
	router.map(routes.hostedConsentShow, consentShow);
	router.map(routes.hostedConsentSubmit, consentSubmit);
	router.map(routes.hostedSignUpShow, signUpShow);
	router.map(routes.hostedSignUpSubmit, signUpSubmit);
	router.map(routes.hostedVerifyShow, verifyShow);
	router.map(routes.hostedVerifyResend, verifyResend);
	router.map(routes.hostedResetShow, resetShow);
	router.map(routes.hostedResetSubmit, resetSubmit);
	router.map(routes.hostedError, errorShow);

	return router;
}

export interface Harness {
	tenantDO: Tenant;
	db: Database;
	router: ReturnType<typeof buildRouter>;
	/** A request already resolved to the fixture tenant, with a `Cookie` header when given one. */
	request(path: string, init?: RequestInit & { cookie?: string }): Request;
}

/** Provisions a fresh tenant and its router, ready for a hosted-flow test. */
export async function buildHarness(): Promise<Harness> {
	let state = createDurableObjectState();
	let tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });
	let db = new Database(createSQLStorageDatabaseAdapter(state.storage.sql));

	return {
		tenantDO,
		db,
		router: buildRouter(tenantDO),
		request(path, init = {}) {
			let { cookie, headers: initHeaders, ...rest } = init;
			let headers = new Headers(initHeaders);
			headers.set(TENANT_ID_HEADER, TENANT_ID);
			headers.set(TENANT_REGION_HEADER, "wnam");
			headers.set(TENANT_ISSUER_HEADER, ISSUER);
			if (cookie) headers.set("Cookie", cookie);

			return new Request(`${ISSUER}${path}`, { ...rest, headers });
		},
	};
}

/** Registers a confidential test client, throwing if the record was refused. */
export async function createTestClient(tenantDO: Tenant, scopes: string[] = ["openid"]) {
	let result = await tenantDO.registerClient({
		name: "Test Client",
		kind: "confidential",
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes,
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!result.ok) throw new Error("unreachable");
	return result.client;
}

/**
 * Creates a subject with a verified email and a set password, ready to sign in
 * with. A username identifier has no ticket to verify it through today —
 * `passwords.test.ts`'s own fixtures sign in against a verified email for the
 * same reason.
 */
export async function createTestSubjectWithPassword(
	tenantDO: Tenant,
	input: { email: string; password: string },
): Promise<string> {
	let created = await tenantDO.createSubject({
		identifiers: [{ kind: "email", value: input.email }],
	});
	if (!created.ok) throw new Error("unreachable");

	let added = await tenantDO.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: input.email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("unreachable");

	await tenantDO.verifyIdentifier({ ticket: added.ticket });

	let written = await tenantDO.setPassword({
		subjectId: created.subjectId,
		password: input.password,
		actor: { kind: "subject" },
	});
	if (!written.ok) throw new Error("unreachable");

	return created.subjectId;
}

/** Reads the `__Host-session` cookie's value out of a `Set-Cookie` header, for a follow-up request. */
export function cookieFrom(response: Response): string {
	let setCookie = response.headers.get("Set-Cookie");
	if (!setCookie) throw new Error("response carried no Set-Cookie header");
	return setCookie.split(";")[0] ?? "";
}
