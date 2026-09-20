/**
 * Proves the cross-module cleanup `tenant-do.ts` performs before delegating a delete:
 * removing a subject or a client also removes the grants naming it, so neither leaves an
 * orphaned row a later `listGrants` or `revokeGrant` would trip over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test } from "vitest";

import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

async function createSubjectAndConfidentialClient() {
	let subject = await tenant.createSubject({});
	if (!subject.ok) throw new Error("setup failed");

	let client = await tenant.registerClient({
		name: "Acme",
		kind: "confidential",
		redirectUris: ["https://acme.example/callback"],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["openid"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: true,
	});
	if (!client.ok) throw new Error("setup failed");

	await tenant.recordConsentDecision({
		subjectId: subject.subjectId,
		clientId: client.client.id,
		approved: true,
		scopes: ["openid"],
	});

	return { subjectId: subject.subjectId, clientId: client.client.id };
}

describe("deleteSubject", () => {
	test("removes the subject's grants", async () => {
		let { subjectId, clientId } = await createSubjectAndConfidentialClient();

		await tenant.deleteSubject({ subjectId });

		expect(await tenant.revokeGrant({ subjectId, clientId })).toMatchObject({ kind: "unknown" });
	});
});

describe("deleteClient", () => {
	test("removes grants naming the client", async () => {
		let { subjectId, clientId } = await createSubjectAndConfidentialClient();

		await tenant.deleteClient({ clientId });

		expect(await tenant.revokeGrant({ subjectId, clientId })).toMatchObject({ kind: "unknown" });
	});
});
