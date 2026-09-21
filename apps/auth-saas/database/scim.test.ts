/**
 * Proves the SCIM provisioning mechanism this pass builds: a connection's token is
 * minted once and stored only as its digest, a rotation keeps the outgoing token
 * valid for its 72-hour grace window and refuses it after, provisioning adopts an
 * unlinked subject rather than duplicating it and refuses a folded address already
 * linked elsewhere, a replace whose mapped attributes have not changed writes
 * nothing, `active: false` blocks a subject and revokes its sessions in the same
 * call, delete follows the connection's own policy, group provisioning and
 * membership patches work, `mapScimGroup` records a mapping without validating the
 * target, and a bad token or an unsupported filter/patch form refuses cleanly.
 *
 * Drives everything through the `Tenant` object, the way `totp.test.ts` and
 * `cascade-deletes.test.ts` drive their own RPC surfaces, reaching into the
 * underlying storage directly only for what the RPC surface itself does not answer
 * (a stored token digest, a session's `revoked_at`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { ScimUserResource } from "./scim";

import { passwords } from "./passwords";
import { scimConnections } from "./scim";
import { openSession, sessions } from "./sessions";
import { subjects } from "./subjects";
import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

let platformActor = { type: "platform", id: "admin_1" } as const;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

let nextSuffix = 0;

/** Reads straight off storage for what the RPC surface itself does not answer. */
function testDb(): Database {
	return new Database(createSQLStorageDatabaseAdapter(state.storage.sql));
}

/** Creates a SCIM connection, throwing if the call was refused, for tests that need one already made. */
async function createConnection(
	overrides: { onDelete?: "block" | "delete"; groupSync?: boolean } = {},
) {
	let created = await tenant.createScimConnection({
		name: "Test IdP",
		actor: platformActor,
		...overrides,
	});
	if (!created.ok) throw new Error("setup failed");
	return created;
}

/** Provisions a user with a fresh email, throwing if the call was refused. */
async function provisionUser(token: string, overrides: Partial<ScimUserResource> = {}) {
	let externalId = overrides.externalId ?? `ext-${nextSuffix++}`;
	let result = await tenant.scimProvisionUser({
		token,
		resource: {
			externalId,
			emails: [{ value: `user-${nextSuffix++}@example.com`, primary: true }],
			...overrides,
		},
	});
	if (!result.ok) throw new Error("setup failed");
	return result;
}

describe("createScimConnection", () => {
	test("mints a real token and stores only its digest", async () => {
		let created = await createConnection();

		expect(created.token.startsWith("scim_")).toBe(true);
		expect(created.connection).not.toHaveProperty("tokenHash");
		expect(created.connection).not.toHaveProperty("token_hash");
		expect(created.connection.onDelete).toBe("block");
		expect(created.connection.groupSync).toBe(false);

		let row = await testDb().find(scimConnections, { id: created.connection.id });
		expect(row).not.toBeNull();
		expect(row?.token_hash).not.toBe(created.token);
		expect(row?.token_hash).toHaveLength(64);
	});

	test("honors an explicit delete policy and group sync flag", async () => {
		let created = await createConnection({ onDelete: "delete", groupSync: true });

		expect(created.connection.onDelete).toBe("delete");
		expect(created.connection.groupSync).toBe(true);
	});
});

describe("rotateScimToken", () => {
	test("keeps the outgoing token valid until its 72-hour window, then refuses it after", async () => {
		let start = 1_700_000_000_000;
		let connection = await createConnection();

		let rotated = await tenant.rotateScimToken({
			connectionId: connection.connection.id,
			now: start,
		});
		if (!rotated.ok) throw new Error("unreachable");
		expect(rotated.token.startsWith("scim_")).toBe(true);
		expect(rotated.token).not.toBe(connection.token);
		expect(rotated.previousTokenExpiresAt).toBe(start + 72 * 60 * 60 * 1000);

		let justBeforeExpiry = start + 72 * 60 * 60 * 1000 - 1_000;
		let stillGood = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Still good", externalId: "grp-grace" },
			at: justBeforeExpiry,
		});
		expect(stillGood.ok).toBe(true);

		let afterExpiry = start + 72 * 60 * 60 * 1000 + 1_000;
		let refused = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Too late", externalId: "grp-too-late" },
			at: afterExpiry,
		});
		expect(refused).toMatchObject({ ok: false, reason: "invalid-token" });

		let withNewToken = await tenant.scimProvisionGroup({
			token: rotated.token,
			resource: { displayName: "New token works", externalId: "grp-new" },
			at: afterExpiry,
		});
		expect(withNewToken.ok).toBe(true);
	});

	test("refuses a connection that does not exist", async () => {
		let result = await tenant.rotateScimToken({ connectionId: "scimc_missing" });
		expect(result).toMatchObject({ ok: false, reason: "not-found" });
	});
});

describe("deleteScimConnection and describeScimConnections", () => {
	test("removes a connection so its token no longer resolves", async () => {
		let connection = await createConnection();

		let deleted = await tenant.deleteScimConnection({ connectionId: connection.connection.id });
		expect(deleted).toMatchObject({ ok: true });

		let refused = await tenant.scimReadUserPage({ token: connection.token });
		expect(refused).toMatchObject({ ok: false, reason: "invalid-token" });
	});

	test("lists every connection's public record, oldest first, never the token digest", async () => {
		let first = await createConnection();
		let second = await createConnection();

		let described = await tenant.describeScimConnections({});

		expect(described.connections.map((row) => row.id)).toEqual([
			first.connection.id,
			second.connection.id,
		]);
		for (let row of described.connections) {
			expect(row).not.toHaveProperty("tokenHash");
			expect(row).not.toHaveProperty("token_hash");
		}
	});
});

describe("scimProvisionUser", () => {
	test("a brand-new email creates a subject", async () => {
		let connection = await createConnection();

		let result = await tenant.scimProvisionUser({
			token: connection.token,
			resource: {
				externalId: "ext-fresh",
				userName: "jane@example.com",
				emails: [{ value: "jane@example.com", primary: true }],
				name: { givenName: "Jane", familyName: "Doe" },
			},
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.created).toBe(true);
		expect(result.representation.userName).toBe("jane@example.com");
		expect(result.representation.emails).toEqual([{ value: "jane@example.com", primary: true }]);
		expect(result.representation.active).toBe(true);
	});

	test("matching an existing unlinked subject adopts it instead of creating a second one", async () => {
		let existing = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "bob@example.com" }],
		});
		if (!existing.ok) throw new Error("setup failed");

		let connection = await createConnection();
		let result = await tenant.scimProvisionUser({
			token: connection.token,
			resource: { externalId: "ext-bob", emails: [{ value: "bob@example.com", primary: true }] },
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.created).toBe(false);
		expect(result.representation.id).toBe(existing.subjectId);

		let allSubjects = await testDb().findMany(subjects);
		expect(allSubjects).toHaveLength(1);
	});

	test("a folded email already linked to a different externalId refuses with a uniqueness conflict", async () => {
		let connection = await createConnection();
		await provisionUser(connection.token, {
			externalId: "ext-first",
			emails: [{ value: "carol@example.com", primary: true }],
		});

		let conflicted = await tenant.scimProvisionUser({
			token: connection.token,
			resource: {
				externalId: "ext-second",
				emails: [{ value: "carol@example.com", primary: true }],
			},
		});

		expect(conflicted).toMatchObject({ ok: false, reason: "uniqueness-conflict" });
	});

	test("refuses a bad token cleanly", async () => {
		let result = await tenant.scimProvisionUser({
			token: "scim_not-a-real-token",
			resource: { externalId: "ext-x", emails: [{ value: "nobody@example.com", primary: true }] },
		});

		expect(result).toMatchObject({ ok: false, reason: "invalid-token" });
	});
});

describe("scimReplaceUser", () => {
	test("writes nothing when the mapped attributes have not changed", async () => {
		let connection = await createConnection();
		let resource: ScimUserResource = {
			externalId: "ext-dana",
			emails: [{ value: "dana@example.com", primary: true }],
			name: { givenName: "Dana" },
		};
		let provisioned = await provisionUser(connection.token, resource);

		let replayed = await tenant.scimReplaceUser({
			token: connection.token,
			id: provisioned.representation.id,
			resource,
		});

		expect(replayed.ok).toBe(true);
		if (!replayed.ok) throw new Error("unreachable");
		expect(replayed.unchanged).toBe(true);
		expect(replayed.cost.rowsWritten).toBe(0);
	});

	test("applies a real change and updates the stored digest", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token, {
			externalId: "ext-earl",
			emails: [{ value: "earl@example.com", primary: true }],
			name: { givenName: "Earl" },
		});

		let replaced = await tenant.scimReplaceUser({
			token: connection.token,
			id: provisioned.representation.id,
			resource: {
				externalId: "ext-earl",
				emails: [{ value: "earl@example.com", primary: true }],
				name: { givenName: "Earl", familyName: "Grey" },
			},
		});

		expect(replaced.ok).toBe(true);
		if (!replaced.ok) throw new Error("unreachable");
		expect(replaced.unchanged).toBe(false);
		expect(replaced.representation.name.familyName).toBe("Grey");
		expect(replaced.cost.rowsWritten).toBeGreaterThan(0);
	});

	test("refuses a subject this connection never linked", async () => {
		let connection = await createConnection();

		let result = await tenant.scimReplaceUser({
			token: connection.token,
			id: "sub_missing",
			resource: { externalId: "ext-missing" },
		});

		expect(result).toMatchObject({ ok: false, reason: "not-found" });
	});
});

describe("scimPatchUser", () => {
	test("active: false blocks the subject and revokes its sessions in the same call", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token);

		let db = testDb();
		let opened = await openSession(db, {
			subjectId: provisioned.representation.id,
			amr: ["pwd"],
			remembered: false,
		});

		let patched = await tenant.scimPatchUser({
			token: connection.token,
			id: provisioned.representation.id,
			operations: [{ op: "replace", attribute: "active", value: false }],
		});

		expect(patched.ok).toBe(true);
		if (!patched.ok) throw new Error("unreachable");
		expect(patched.representation.active).toBe(false);

		let subjectRow = await testDb().find(subjects, { id: provisioned.representation.id });
		expect(subjectRow?.status).toBe("blocked");

		let sessionRow = await testDb().find(sessions, { id: opened.sessionId });
		expect(sessionRow?.revoked_at).not.toBeNull();
	});

	test("applies a plain attribute change", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token);

		let patched = await tenant.scimPatchUser({
			token: connection.token,
			id: provisioned.representation.id,
			operations: [{ op: "replace", attribute: "displayName", value: "New Display Name" }],
		});

		expect(patched.ok).toBe(true);
		if (!patched.ok) throw new Error("unreachable");
		expect(patched.representation.displayName).toBe("New Display Name");
	});

	test("refuses an unsupported operation form cleanly", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token);

		let result = await tenant.scimPatchUser({
			token: connection.token,
			id: provisioned.representation.id,
			operations: [
				// @ts-expect-error - "remove" is not a supported user-patch operation.
				{ op: "remove", attribute: "givenName", value: null },
			],
		});

		expect(result).toMatchObject({ ok: false, reason: "unsupported-operation", index: 0 });
	});
});

describe("scimDeleteUser", () => {
	test("blocks the subject when the connection's policy is block (the default)", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token);

		let deleted = await tenant.scimDeleteUser({
			token: connection.token,
			id: provisioned.representation.id,
		});

		expect(deleted).toMatchObject({ ok: true, action: "blocked" });

		let row = await testDb().find(subjects, { id: provisioned.representation.id });
		expect(row?.status).toBe("blocked");
	});

	test("retires the subject outright when the connection's policy is delete", async () => {
		let connection = await createConnection({ onDelete: "delete" });
		let provisioned = await provisionUser(connection.token);

		let deleted = await tenant.scimDeleteUser({
			token: connection.token,
			id: provisioned.representation.id,
		});

		expect(deleted).toMatchObject({ ok: true, action: "deleted" });
		expect(await testDb().find(subjects, { id: provisioned.representation.id })).toBeNull();
	});

	test("refuses a subject this connection never linked", async () => {
		let connection = await createConnection();

		let result = await tenant.scimDeleteUser({ token: connection.token, id: "sub_missing" });

		expect(result).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("a delete-policy outcome also clears the subject's other credentials", async () => {
		let connection = await createConnection({ onDelete: "delete" });
		let provisioned = await provisionUser(connection.token);

		let written = await tenant.setPassword({
			subjectId: provisioned.representation.id,
			password: "correct horse battery staple",
			actor: { kind: "admin" },
		});
		if (!written.ok) throw new Error("setup failed");

		await tenant.scimDeleteUser({ token: connection.token, id: provisioned.representation.id });

		let db = testDb();
		let passwordRows = await db.findMany(passwords, {
			where: { subject_id: provisioned.representation.id },
		});
		expect(passwordRows).toHaveLength(0);
	});
});

describe("scimReadUser and scimReadUserPage", () => {
	test("reads one user by id", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token, {
			emails: [{ value: "frank@example.com", primary: true }],
		});

		let read = await tenant.scimReadUser({
			token: connection.token,
			id: provisioned.representation.id,
		});

		expect(read).toMatchObject({ ok: true, representation: { id: provisioned.representation.id } });
	});

	test("pages users ordered by creation, with an exact total", async () => {
		let connection = await createConnection();
		await provisionUser(connection.token);
		await provisionUser(connection.token);
		await provisionUser(connection.token);

		let page = await tenant.scimReadUserPage({ token: connection.token, count: 2 });

		expect(page.ok).toBe(true);
		if (!page.ok) throw new Error("unreachable");
		expect(page.totalResults).toBe(3);
		expect(page.representations).toHaveLength(2);
		expect(page.startIndex).toBe(1);
	});

	test("filters by userName with eq", async () => {
		let connection = await createConnection();
		await provisionUser(connection.token, {
			userName: "match@example.com",
			emails: [{ value: "match@example.com", primary: true }],
		});
		await provisionUser(connection.token, {
			userName: "other@example.com",
			emails: [{ value: "other@example.com", primary: true }],
		});

		let page = await tenant.scimReadUserPage({
			token: connection.token,
			filter: 'userName eq "match@example.com"',
		});

		expect(page.ok).toBe(true);
		if (!page.ok) throw new Error("unreachable");
		expect(page.representations).toHaveLength(1);
		expect(page.representations[0]?.userName).toBe("match@example.com");
	});

	test("refuses an unsupported filter cleanly", async () => {
		let connection = await createConnection();

		let result = await tenant.scimReadUserPage({
			token: connection.token,
			filter: 'userName co "jane"',
		});

		expect(result).toMatchObject({ ok: false, reason: "unsupported-filter" });
	});
});

describe("group provisioning", () => {
	async function createMember() {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: `member-${nextSuffix++}@example.com` }],
		});
		if (!created.ok) throw new Error("setup failed");
		return created.subjectId;
	}

	test("provisions a group with its starting membership", async () => {
		let connection = await createConnection();
		let memberId = await createMember();

		let result = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: {
				displayName: "Engineering",
				externalId: "grp-eng",
				members: [{ value: memberId }],
			},
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.representation.displayName).toBe("Engineering");
		expect(result.representation.members).toEqual([memberId]);
	});

	test("refuses a member that does not name an existing subject", async () => {
		let connection = await createConnection();

		let result = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: {
				displayName: "Ghosts",
				externalId: "grp-ghosts",
				members: [{ value: "sub_missing" }],
			},
		});

		expect(result).toMatchObject({ ok: false, reason: "unknown-member", subjectId: "sub_missing" });
	});

	test("membership PATCH adds and removes members", async () => {
		let connection = await createConnection();
		let memberA = await createMember();
		let memberB = await createMember();

		let provisioned = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Team", externalId: "grp-team", members: [{ value: memberA }] },
		});
		if (!provisioned.ok) throw new Error("setup failed");

		let added = await tenant.scimPatchGroup({
			token: connection.token,
			id: provisioned.representation.id,
			operations: [{ op: "add", attribute: "members", values: [memberB] }],
		});
		expect(added.ok).toBe(true);
		if (!added.ok) throw new Error("unreachable");
		expect(new Set(added.representation.members)).toEqual(new Set([memberA, memberB]));

		let removed = await tenant.scimPatchGroup({
			token: connection.token,
			id: provisioned.representation.id,
			operations: [{ op: "remove", attribute: "members", value: memberA }],
		});
		expect(removed.ok).toBe(true);
		if (!removed.ok) throw new Error("unreachable");
		expect(removed.representation.members).toEqual([memberB]);
	});

	test("replaces a group's display name and whole membership set", async () => {
		let connection = await createConnection();
		let memberA = await createMember();
		let memberB = await createMember();

		let provisioned = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: {
				displayName: "Old Name",
				externalId: "grp-replace",
				members: [{ value: memberA }],
			},
		});
		if (!provisioned.ok) throw new Error("setup failed");

		let replaced: { ok: boolean } & Record<string, unknown> = await tenant.scimReplaceGroup({
			token: connection.token,
			id: provisioned.representation.id,
			resource: {
				displayName: "New Name",
				externalId: "grp-replace",
				members: [{ value: memberB }],
			},
		});

		expect(replaced).toMatchObject({
			ok: true,
			representation: { displayName: "New Name", members: [memberB] },
		});
	});

	test("deletes a group without touching the subjects that belonged to it", async () => {
		let connection = await createConnection();
		let memberId = await createMember();

		let provisioned = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Doomed", externalId: "grp-doomed", members: [{ value: memberId }] },
		});
		if (!provisioned.ok) throw new Error("setup failed");

		let deleted = await tenant.scimDeleteGroup({
			token: connection.token,
			id: provisioned.representation.id,
		});
		expect(deleted).toMatchObject({ ok: true });

		expect(await testDb().find(subjects, { id: memberId })).not.toBeNull();

		let read = await tenant.scimReadGroup({
			token: connection.token,
			id: provisioned.representation.id,
		});
		expect(read).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("refuses an unsupported PATCH operation form cleanly", async () => {
		let connection = await createConnection();
		let provisioned = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Team", externalId: "grp-bad-patch" },
		});
		if (!provisioned.ok) throw new Error("setup failed");

		let result = await tenant.scimPatchGroup({
			token: connection.token,
			id: provisioned.representation.id,
			operations: [
				// @ts-expect-error - "remove" on "displayName" is not a supported group-patch operation.
				{ op: "remove", attribute: "displayName", value: "x" },
			],
		});

		expect(result).toMatchObject({ ok: false, reason: "unsupported-operation", index: 0 });
	});

	test("pages groups, filtered by displayName with eq", async () => {
		let connection = await createConnection();
		await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Sales", externalId: "grp-sales" },
		});
		await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Support", externalId: "grp-support" },
		});

		let page = await tenant.scimReadGroupPage({
			token: connection.token,
			filter: 'displayName eq "Sales"',
		});

		expect(page.ok).toBe(true);
		if (!page.ok) throw new Error("unreachable");
		expect(page.totalResults).toBe(1);
		expect(page.representations[0]?.displayName).toBe("Sales");
	});
});

describe("mapScimGroup", () => {
	test("records the mapping without validating or acting on the target", async () => {
		let connection = await createConnection();
		let group = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Eng", externalId: "grp-map" },
		});
		if (!group.ok) throw new Error("setup failed");

		let mapped = await tenant.mapScimGroup({
			connectionId: connection.connection.id,
			groupId: group.representation.id,
			targetKind: "role",
			targetId: "role_admin_that_does_not_exist",
		});

		expect(mapped).toMatchObject({ ok: true });
	});

	test("refuses a group that does not belong to the named connection", async () => {
		let connection = await createConnection();

		let mapped = await tenant.mapScimGroup({
			connectionId: connection.connection.id,
			groupId: "scimg_missing",
			targetKind: "role",
			targetId: "role_admin",
		});

		expect(mapped).toMatchObject({ ok: false, reason: "not-found" });
	});
});

describe("bad tokens across operations", () => {
	test("every read and write refuses a token that resolves to no connection", async () => {
		let bad = "scim_not-a-real-token";

		expect(await tenant.scimReadUser({ token: bad, id: "sub_x" })).toMatchObject({
			ok: false,
			reason: "invalid-token",
		});
		expect(await tenant.scimReadUserPage({ token: bad })).toMatchObject({
			ok: false,
			reason: "invalid-token",
		});
		expect(
			await tenant.scimReplaceUser({ token: bad, id: "sub_x", resource: { externalId: "x" } }),
		).toMatchObject({ ok: false, reason: "invalid-token" });
		expect(await tenant.scimPatchUser({ token: bad, id: "sub_x", operations: [] })).toMatchObject({
			ok: false,
			reason: "invalid-token",
		});
		expect(await tenant.scimDeleteUser({ token: bad, id: "sub_x" })).toMatchObject({
			ok: false,
			reason: "invalid-token",
		});
		expect(
			await tenant.scimProvisionGroup({
				token: bad,
				resource: { displayName: "x", externalId: "x" },
			}),
		).toMatchObject({ ok: false, reason: "invalid-token" });
		expect(await tenant.scimReadGroupPage({ token: bad })).toMatchObject({
			ok: false,
			reason: "invalid-token",
		});
	});
});
