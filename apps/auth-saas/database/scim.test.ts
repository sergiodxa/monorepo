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
import { unwrap } from "@sdxc/result";
import { parseListQuery, PATCH_OP_SCHEMA } from "@sdxc/scim";
import { parsePatch } from "@sdxc/scim/patch";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { ScimUserResource } from "./scim-resources";

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

/** A list query as `parseListQuery` reads it from a query string such as `count=2`. */
function listQuery(search = "") {
	return unwrap(parseListQuery(new URL(`https://tenant.example.com/scim/v2/Users?${search}`)));
}

/** PATCH operations as `parsePatch` reads them from a request body's `Operations`. */
function patchOperations(operations: unknown[]) {
	return unwrap(parsePatch({ schemas: [PATCH_OP_SCHEMA], Operations: operations }));
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
	let email = `user-${nextSuffix++}@example.com`;
	let result = await tenant.scimProvisionUser({
		token,
		resource: {
			externalId,
			userName: email,
			emails: [{ value: email, primary: true }],
			extensions: {},
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

		let refused = await tenant.scimReadUserPage({ token: connection.token, query: listQuery() });
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
				extensions: {},
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
			resource: {
				userName: "bob@example.com",
				extensions: {},
				externalId: "ext-bob",
				emails: [{ value: "bob@example.com", primary: true }],
			},
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
				userName: "carol@example.com",
				extensions: {},
				externalId: "ext-second",
				emails: [{ value: "carol@example.com", primary: true }],
			},
		});

		expect(conflicted).toMatchObject({ ok: false, reason: "uniqueness-conflict" });
	});

	test("refuses a bad token cleanly", async () => {
		let result = await tenant.scimProvisionUser({
			token: "scim_not-a-real-token",
			resource: {
				userName: "nobody@example.com",
				extensions: {},
				externalId: "ext-x",
				emails: [{ value: "nobody@example.com", primary: true }],
			},
		});

		expect(result).toMatchObject({ ok: false, reason: "invalid-token" });
	});
});

describe("scimReplaceUser", () => {
	test("writes nothing when the mapped attributes have not changed", async () => {
		let connection = await createConnection();
		let resource: ScimUserResource = {
			externalId: "ext-dana",
			userName: "dana@example.com",
			extensions: {},
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
				userName: "earl@example.com",
				extensions: {},
				externalId: "ext-earl",
				emails: [{ value: "earl@example.com", primary: true }],
				name: { givenName: "Earl", familyName: "Grey" },
			},
		});

		expect(replaced.ok).toBe(true);
		if (!replaced.ok) throw new Error("unreachable");
		expect(replaced.unchanged).toBe(false);
		expect(replaced.representation.name?.familyName).toBe("Grey");
		expect(replaced.cost.rowsWritten).toBeGreaterThan(0);
	});

	test("refuses a subject this connection never linked", async () => {
		let connection = await createConnection();

		let result = await tenant.scimReplaceUser({
			token: connection.token,
			id: "sub_missing",
			resource: {
				userName: "missing@example.com",
				extensions: {},
				externalId: "ext-missing",
			},
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
			operations: patchOperations([{ op: "replace", path: "active", value: false }]),
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
			operations: patchOperations([
				{ op: "replace", path: "displayName", value: "New Display Name" },
			]),
		});

		expect(patched.ok).toBe(true);
		if (!patched.ok) throw new Error("unreachable");
		expect(patched.representation.displayName).toBe("New Display Name");
	});

	test("refuses an operation the SCIM rules forbid, writing nothing", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token);

		let result = await tenant.scimPatchUser({
			token: connection.token,
			id: provisioned.representation.id,
			operations: patchOperations([{ op: "replace", path: "id", value: "sub_other" }]),
		});

		expect(result).toMatchObject({ ok: false, reason: "invalid-patch", scimType: "mutability" });
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

		let page = await tenant.scimReadUserPage({
			token: connection.token,
			query: listQuery("count=2"),
		});

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
			query: listQuery(`filter=${encodeURIComponent('userName eq "match@example.com"')}`),
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
			query: listQuery(`filter=${encodeURIComponent('displayName eq "Jane"')}`),
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
		expect(result.representation.members).toEqual([{ value: memberId }]);
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
			operations: patchOperations([{ op: "add", path: "members", value: [{ value: memberB }] }]),
		});
		expect(added.ok).toBe(true);
		if (!added.ok) throw new Error("unreachable");
		expect(new Set(added.representation.members.map((member) => member.value))).toEqual(
			new Set([memberA, memberB]),
		);

		let removed = await tenant.scimPatchGroup({
			token: connection.token,
			id: provisioned.representation.id,
			operations: patchOperations([{ op: "remove", path: `members[value eq "${memberA}"]` }]),
		});
		expect(removed.ok).toBe(true);
		if (!removed.ok) throw new Error("unreachable");
		expect(removed.representation.members).toEqual([{ value: memberB }]);
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
			representation: { displayName: "New Name", members: [{ value: memberB }] },
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
			operations: patchOperations([{ op: "remove", path: "displayName" }]),
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
			query: listQuery(`filter=${encodeURIComponent('displayName eq "Sales"')}`),
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
		expect(await tenant.scimReadUserPage({ token: bad, query: listQuery() })).toMatchObject({
			ok: false,
			reason: "invalid-token",
		});
		expect(
			await tenant.scimReplaceUser({
				token: bad,
				id: "sub_x",
				resource: {
					userName: "missing@example.com",
					extensions: {},
					externalId: "x",
				},
			}),
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
		expect(await tenant.scimReadGroupPage({ token: bad, query: listQuery() })).toMatchObject({
			ok: false,
			reason: "invalid-token",
		});
	});
});

describe("RFC 7643/7644 behaviors", () => {
	test("userName eq folds case, as userName is caseExact: false", async () => {
		let connection = await createConnection();
		await provisionUser(connection.token, {
			userName: "ana@example.com",
			emails: [{ value: "ana@example.com", primary: true }],
		});

		let page = await tenant.scimReadUserPage({
			token: connection.token,
			query: listQuery(`filter=${encodeURIComponent('userName eq "Ana@Example.com"')}`),
		});

		expect(page.ok).toBe(true);
		if (!page.ok) throw new Error("unreachable");
		expect(page.representations.map((user) => user.userName)).toEqual(["ana@example.com"]);
	});

	test("the whole grammar is served on the allowlisted attributes", async () => {
		let connection = await createConnection();
		await provisionUser(connection.token, { externalId: "ext-jane" });
		await provisionUser(connection.token, { externalId: "ext-john" });
		await provisionUser(connection.token, { externalId: "other" });

		let page = await tenant.scimReadUserPage({
			token: connection.token,
			query: listQuery(
				`filter=${encodeURIComponent('externalId sw "ext-" and not (externalId eq "ext-john")')}`,
			),
		});

		expect(page.ok).toBe(true);
		if (!page.ok) throw new Error("unreachable");
		expect(page.representations.map((user) => user.externalId)).toEqual(["ext-jane"]);
	});

	test("a negative count answers an empty page with the exact total", async () => {
		let connection = await createConnection();
		await provisionUser(connection.token);
		await provisionUser(connection.token);

		let page = await tenant.scimReadUserPage({
			token: connection.token,
			query: listQuery("count=-1"),
		});

		expect(page.ok).toBe(true);
		if (!page.ok) throw new Error("unreachable");
		expect(page.representations).toEqual([]);
		expect(page.totalResults).toBe(2);
	});

	test("a PATCH without a path merges its value's members", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token, { name: { givenName: "Old" } });

		let patched = await tenant.scimPatchUser({
			token: connection.token,
			id: provisioned.representation.id,
			operations: patchOperations([
				{ op: "replace", value: { displayName: "Merged", "name.givenName": "New" } },
			]),
		});

		expect(patched.ok).toBe(true);
		if (!patched.ok) throw new Error("unreachable");
		expect(patched.representation.displayName).toBe("Merged");
		expect(patched.representation.name?.givenName).toBe("New");
		expect(patched.representation.emails).toEqual(provisioned.representation.emails);
	});

	test("a PATCH keeps a picture it does not mention", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token, {
			photos: [{ value: "https://example.com/a.png", type: "photo" }],
		});

		let patched = await tenant.scimPatchUser({
			token: connection.token,
			id: provisioned.representation.id,
			operations: patchOperations([{ op: "replace", path: "displayName", value: "Kept" }]),
		});

		expect(patched.ok).toBe(true);
		if (!patched.ok) throw new Error("unreachable");
		expect(patched.representation.photos).toEqual([
			{ value: "https://example.com/a.png", type: "photo" },
		]);
	});

	test("a PATCH that changes nothing writes nothing", async () => {
		let connection = await createConnection();
		let provisioned = await provisionUser(connection.token, { displayName: "Same" });

		let patched = await tenant.scimPatchUser({
			token: connection.token,
			id: provisioned.representation.id,
			operations: patchOperations([{ op: "replace", path: "displayName", value: "Same" }]),
		});

		expect(patched.ok).toBe(true);
		expect(patched.cost.rowsWritten).toBe(0);
	});

	test("group displayName eq folds case in SQL, and a LIKE wildcard falls back in memory", async () => {
		let connection = await createConnection();
		await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Sales_EU", externalId: "grp-eu" },
		});
		await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "SalesXEU", externalId: "grp-x" },
		});

		let folded = await tenant.scimReadGroupPage({
			token: connection.token,
			query: listQuery(`filter=${encodeURIComponent('displayName eq "salesxeu"')}`),
		});
		expect(folded).toMatchObject({ ok: true, totalResults: 1 });

		let wildcard = await tenant.scimReadGroupPage({
			token: connection.token,
			query: listQuery(`filter=${encodeURIComponent('displayName eq "sales_eu"')}`),
		});
		expect(wildcard.ok).toBe(true);
		if (!wildcard.ok) throw new Error("unreachable");
		expect(wildcard.representations.map((group) => group.externalId)).toEqual(["grp-eu"]);
	});

	test("group PATCH replaces the membership and removes members by value list", async () => {
		let connection = await createConnection();
		let ids: string[] = [];
		for (let index = 0; index < 3; index++) {
			let created = await tenant.createSubject({
				identifiers: [{ kind: "email", value: `gm-${nextSuffix++}@example.com` }],
			});
			if (!created.ok) throw new Error("setup failed");
			ids.push(created.subjectId);
		}
		let [a, b, c] = ids as [string, string, string];

		let group = await tenant.scimProvisionGroup({
			token: connection.token,
			resource: { displayName: "Team", externalId: "grp-ops", members: [{ value: a }] },
		});
		if (!group.ok) throw new Error("setup failed");

		let replaced = await tenant.scimPatchGroup({
			token: connection.token,
			id: group.representation.id,
			operations: patchOperations([
				{ op: "replace", path: "members", value: [{ value: b }, { value: c }] },
				{ op: "remove", path: "members", value: [{ value: b }] },
				{ op: "replace", value: { displayName: "Renamed" } },
			]),
		});

		expect(replaced).toMatchObject({
			ok: true,
			representation: { displayName: "Renamed", members: [{ value: c }] },
		});
	});
});
