/**
 * A fully-provisioned tenant, its control-plane record, an allowing rate
 * limiter, and a real management router mapping every subjects and
 * identifiers route, for driving the HTTP surface through real requests the
 * way `scim/test-harness.ts` drives the SCIM surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { JWK } from "@sdxc/jwt";
import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { createSubjectsBlockAction } from "~/app/http/controllers/management/subjects/block";
import { createSubjectsCreateAction } from "~/app/http/controllers/management/subjects/create";
import { createSubjectsDeleteAction } from "~/app/http/controllers/management/subjects/delete";
import {
	createSubjectIdentifiersAddAction,
	createSubjectIdentifiersRemoveAction,
	createSubjectIdentifiersSetPrimaryAction,
	createSubjectIdentifiersVerifyAction,
} from "~/app/http/controllers/management/subjects/identifiers";
import { createSubjectsListAction } from "~/app/http/controllers/management/subjects/list";
import { createSubjectsReadAction } from "~/app/http/controllers/management/subjects/read";
import { createSubjectsUnblockAction } from "~/app/http/controllers/management/subjects/unblock";
import { createSubjectsUpdateAction } from "~/app/http/controllers/management/subjects/update";
import { database } from "~/app/http/middleware/database";
import { ManagementAccessToken } from "~/app/lib/management-token";
import Customer from "~/app/models/customer";
import Membership from "~/app/models/membership";
import {
	advancePlatformSigningKeys,
	currentPlatformSigningKeyPair,
} from "~/app/models/platform-signing-key";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";
import TenantObject from "~/database/tenant-do";
import routes from "~/routes/management";

export const ISSUER = "https://api.example.com";

/** A fake `RateLimiterBinding` answering the same decision on every call. */
export function fakeLimiter(success = true): RateLimiterBinding {
	return { limit: async () => ({ success }) };
}

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildSubjectsRouter(
	db: Database,
	tenantDO: TenantObject,
	options: {
		resolveDashboardSubjectId?: (
			ctx: import("remix/router").RequestContext,
		) => Promise<string | null>;
		limiter?: RateLimiterBinding;
	} = {},
) {
	let controllerOptions: ManagementControllerOptions = {
		issuer: ISSUER,
		resolveDashboardSubjectId: options.resolveDashboardSubjectId ?? (async () => null),
		limiter: options.limiter ?? fakeLimiter(),
		resolveStub: () => tenantDO as unknown as DurableObjectStub<TenantObject>,
	};

	let router = createRouter({ middleware: [database(() => db)] });

	router.map(routes.subjectsCreate, createSubjectsCreateAction(controllerOptions));
	router.map(routes.subjectsList, createSubjectsListAction(controllerOptions));
	router.map(routes.subjectsRead, createSubjectsReadAction(controllerOptions));
	router.map(routes.subjectsUpdate, createSubjectsUpdateAction(controllerOptions));
	router.map(routes.subjectsBlock, createSubjectsBlockAction(controllerOptions));
	router.map(routes.subjectsUnblock, createSubjectsUnblockAction(controllerOptions));
	router.map(routes.subjectsDelete, createSubjectsDeleteAction(controllerOptions));

	router.map(routes.subjectIdentifiersAdd, createSubjectIdentifiersAddAction(controllerOptions));
	router.map(
		routes.subjectIdentifiersVerify,
		createSubjectIdentifiersVerifyAction(controllerOptions),
	);
	router.map(
		routes.subjectIdentifiersSetPrimary,
		createSubjectIdentifiersSetPrimaryAction(controllerOptions),
	);
	router.map(
		routes.subjectIdentifiersRemove,
		createSubjectIdentifiersRemoveAction(controllerOptions),
	);

	return router;
}

export interface SubjectsHarness {
	db: Database;
	tenantId: string;
	otherTenantId: string;
	tenantDO: TenantObject;
	router: ReturnType<typeof buildSubjectsRouter>;
	/** Signs a management access token the way the token endpoint mints one. */
	signToken(overrides?: Partial<{ tenantId: string; scope: string }>): Promise<string>;
	/** A request against this harness's tenant, bearing the given bearer token. */
	request(path: string, token: string, init?: RequestInit): Request;
}

export interface BuildSubjectsHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (
		ctx: import("remix/router").RequestContext,
	) => Promise<string | null>;
}

/** Provisions a fresh tenant, its control-plane record, and the subjects router, ready for an HTTP-surface test. */
export async function buildSubjectsHarness(
	options: BuildSubjectsHarnessOptions = {},
): Promise<SubjectsHarness> {
	let db = await createTestDatabase();
	await advancePlatformSigningKeys(db, { now: Date.now() });

	let customer = await Customer.create(db, { name: "Acme, Inc." });
	let tenant = await Tenant.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.auth.example.com",
	});

	let other = await Tenant.create(db, {
		customerId: customer.id,
		name: "Other, Inc.",
		slug: "other",
		issuer: "https://other.auth.example.com",
	});

	let state = createDurableObjectState();
	let tenantDO = new TenantObject(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: tenant.id, issuer: "https://acme.auth.example.com" });

	let router = buildSubjectsRouter(db, tenantDO, options);

	return {
		db,
		tenantId: tenant.id,
		otherTenantId: other.id,
		tenantDO,
		router,
		async signToken(overrides = {}) {
			let pair = await currentPlatformSigningKeyPair(db);
			if (!pair) throw new Error("unreachable");

			let now = Math.floor(Date.now() / 1000);
			let tenantId = overrides.tenantId ?? tenant.id;

			return new ManagementAccessToken({
				iss: ISSUER,
				sub: "mgmt_client_1",
				client_id: "mgmt_client_1",
				aud: `${ISSUER}/tenants/${tenantId}`,
				tenant_id: tenantId,
				scope: overrides.scope ?? "subjects:read subjects:write",
				iat: now,
				exp: now + 900,
			}).sign(JWK.Algorithm.ES256, [pair]);
		},
		request(path, token, init = {}) {
			let { headers: initHeaders, ...rest } = init;
			let headers = new Headers(initHeaders);
			headers.set("Authorization", `Bearer ${token}`);
			if (init.body) headers.set("Content-Type", "application/json");

			return new Request(`${ISSUER}${path}`, { ...rest, headers });
		},
	};
}

/** Grants a tenant membership role, for a dashboard-session test. */
export async function grantMembership(
	db: Database,
	tenantId: string,
	subjectId: string,
	role: "owner" | "admin" | "member",
): Promise<void> {
	await Membership.create(db, { tenantId, subjectId, role });
}
