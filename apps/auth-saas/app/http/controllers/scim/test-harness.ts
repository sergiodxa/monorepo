/**
 * A fully-provisioned tenant, an entitled or un-entitled `scim` feature, a
 * SCIM connection and its bearer token, and a real tenant router mapping
 * every `/scim/v2/*` route, for driving the SCIM HTTP surface through real
 * requests the way `oauth/token.test.ts` drives the token endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createRouter } from "remix/router";

import {
	scimResourceTypes,
	scimSchemas,
	scimServiceProviderConfig,
} from "~/app/http/controllers/scim/discovery";
import { createScimGroupsController } from "~/app/http/controllers/scim/groups";
import { scimBulk, scimMe } from "~/app/http/controllers/scim/unsupported";
import { createScimUsersController } from "~/app/http/controllers/scim/users";
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

/** A recording fake of a single `RateLimit` binding, the same shape `rate-limit.test.ts` uses for `checkRateLimit`. */
export function fakeLimiter(allow = true) {
	let calls: Array<{ key: string }> = [];
	return {
		calls,
		async limit(options: { key: string }) {
			calls.push(options);
			return { success: allow };
		},
	};
}

/** Records every method called on a Durable Object stub, so a test can assert none ran. */
export function spyOnStub(target: Tenant): { calls: string[]; stub: Tenant } {
	let calls: string[] = [];
	let stub = new Proxy(target, {
		get(object, property, receiver) {
			let value = Reflect.get(object, property, receiver);
			if (typeof value !== "function" || property === "constructor") return value;
			return (...args: unknown[]) => {
				calls.push(String(property));
				return (value as (...a: unknown[]) => unknown).apply(object, args);
			};
		},
	});
	return { calls, stub };
}

/** Builds the tenant router wired to a constructed Durable Object, mapping every `/scim/v2/*` route. */
export function buildScimRouter(
	tenantDO: Tenant,
	limiter: ReturnType<typeof fakeLimiter> = fakeLimiter(),
) {
	let router = createRouter({
		middleware: [tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>)],
	});

	let users = createScimUsersController(limiter as unknown as RateLimit);
	let groups = createScimGroupsController(limiter as unknown as RateLimit);

	router.map(routes.scimUsersCreate, users.create);
	router.map(routes.scimUsersList, users.list);
	router.map(routes.scimUsersRead, users.read);
	router.map(routes.scimUsersReplace, users.replace);
	router.map(routes.scimUsersPatch, users.patch);
	router.map(routes.scimUsersDelete, users.delete);

	router.map(routes.scimGroupsCreate, groups.create);
	router.map(routes.scimGroupsList, groups.list);
	router.map(routes.scimGroupsRead, groups.read);
	router.map(routes.scimGroupsReplace, groups.replace);
	router.map(routes.scimGroupsPatch, groups.patch);
	router.map(routes.scimGroupsDelete, groups.delete);

	router.map(routes.scimServiceProviderConfig, scimServiceProviderConfig);
	router.map(routes.scimResourceTypes, scimResourceTypes);
	router.map(routes.scimSchemas, scimSchemas);
	router.map(routes.scimBulk, scimBulk);
	router.map(routes.scimMe, scimMe);

	return router;
}

export interface ScimHarness {
	tenantDO: Tenant;
	router: ReturnType<typeof buildScimRouter>;
	limiter: ReturnType<typeof fakeLimiter>;
	/** A `/scim/v2/*` request already resolved to the fixture tenant, bearing the given token. */
	request(path: string, token: string, init?: RequestInit): Request;
}

export interface BuildScimHarnessOptions {
	/** A limiter to inject in place of a fresh allowing fake. */
	limiter?: ReturnType<typeof fakeLimiter>;
}

/** Provisions a fresh tenant and its SCIM router, ready for an HTTP-surface test. */
export async function buildScimHarness(
	options: BuildScimHarnessOptions = {},
): Promise<ScimHarness> {
	let state = createDurableObjectState();
	let tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });

	let limiter = options.limiter ?? fakeLimiter();

	return {
		tenantDO,
		router: buildScimRouter(tenantDO, limiter),
		limiter,
		request(path, token, init = {}) {
			let { headers: initHeaders, ...rest } = init;
			let headers = new Headers(initHeaders);
			headers.set(TENANT_ID_HEADER, TENANT_ID);
			headers.set(TENANT_REGION_HEADER, "wnam");
			headers.set(TENANT_ISSUER_HEADER, ISSUER);
			headers.set("Authorization", `Bearer ${token}`);
			if (init.body) headers.set("Content-Type", "application/scim+json");

			return new Request(`${ISSUER}${path}`, { ...rest, headers });
		},
	};
}

/** Grants (or clears) the `scim` entitlement on a provisioned tenant. */
export async function setScimEntitled(tenantDO: Tenant, entitled: boolean): Promise<void> {
	await tenantDO.applyEntitlements({
		plan: "premium",
		features: { scim: entitled },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});
}

/** Creates a SCIM connection and returns its bearer token, on a tenant that already holds the entitlement. */
export async function createScimConnectionToken(
	tenantDO: Tenant,
	name = "Test Directory",
): Promise<string> {
	let result = await tenantDO.createScimConnection({
		name,
		actor: { type: "platform", id: "system" },
	});
	if (!result.ok) throw new Error("unreachable");
	return result.token;
}
