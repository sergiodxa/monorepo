/**
 * The whole authorization model as a table of cases: what a `user` and an `admin` may do,
 * that a session belonging to someone else answers as missing, and that the server's own
 * client stays out of reach of every role.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Decision } from "@sdxc/authz";

import { testAccess } from "@sdxc/authz/testing";
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import abilities from "~/app/authz/abilities";
import policy from "~/app/authz/policy";
import { AUTH_SERVER_CLIENT_ID } from "~/app/config";

const SUBJECT_ID = "subject-1";
const OTHER_SUBJECT_ID = "subject-2";

const OWN_SESSION = { id: "session-1", subject_id: SUBJECT_ID };
const OTHER_SESSION = { id: "session-2", subject_id: OTHER_SUBJECT_ID };

const RELYING_PARTY = { id: "relying-party" };
const OWN_CLIENT = { id: AUTH_SERVER_CLIENT_ID };

/** Every decision the table reaches, so the last test can name grants no case exercised. */
const DECISIONS: Decision[] = [];

/** Binds the subject holding `role`, recording each decision for the coverage check. */
function accessAs(role: "user" | "admin") {
	return testAccess(policy, {
		roles: [role],
		facts: { actor: { id: SUBJECT_ID } },
		onDecision: (decision) => DECISIONS.push(decision),
	});
}

/** One row of the table: who checks, what, against which record, and the answer. */
interface Case {
	name: string;
	role: "user" | "admin";
	check: (access: ReturnType<typeof accessAs>) => Decision;
	expected: Partial<Decision> & { allowed: boolean };
}

const CASES: Case[] = [
	{
		name: "a user stays out of the admin area",
		role: "user",
		check: (access) => access.check(abilities.admin.access),
		expected: { allowed: false, cause: "ungranted", as: "forbidden" },
	},
	{
		name: "an admin opens the admin area",
		role: "admin",
		check: (access) => access.check(abilities.admin.access),
		expected: { allowed: true },
	},
	{
		name: "a user edits no client",
		role: "user",
		check: (access) => access.check(abilities.admin.client.update, { client: RELYING_PARTY }),
		expected: { allowed: false, cause: "ungranted" },
	},
	{
		name: "an admin edits a relying party",
		role: "admin",
		check: (access) => access.check(abilities.admin.client.update, { client: RELYING_PARTY }),
		expected: { allowed: true },
	},
	{
		name: "an admin deletes a relying party",
		role: "admin",
		check: (access) => access.check(abilities.admin.client.delete, { client: RELYING_PARTY }),
		expected: { allowed: true },
	},
	{
		name: "an admin cannot edit the server's own client",
		role: "admin",
		check: (access) => access.check(abilities.admin.client.update, { client: OWN_CLIENT }),
		expected: { allowed: false, cause: "denied", reason: "own-client", as: "forbidden" },
	},
	{
		name: "an admin cannot delete the server's own client",
		role: "admin",
		check: (access) => access.check(abilities.admin.client.delete, { client: OWN_CLIENT }),
		expected: { allowed: false, cause: "denied", reason: "own-client" },
	},
	{
		name: "a user revokes their own session",
		role: "user",
		check: (access) => access.check(abilities.account.session.revoke, { session: OWN_SESSION }),
		expected: { allowed: true },
	},
	{
		name: "a user's revocation of another subject's session answers as not found",
		role: "user",
		check: (access) => access.check(abilities.account.session.revoke, { session: OTHER_SESSION }),
		expected: { allowed: false, cause: "ungranted", as: "notFound" },
	},
	{
		name: "an admin's account page revokes only their own sessions too",
		role: "admin",
		check: (access) => access.check(abilities.account.session.revoke, { session: OTHER_SESSION }),
		expected: { allowed: false, as: "notFound" },
	},
	{
		name: "a user withdraws consent from a relying party",
		role: "user",
		check: (access) => access.check(abilities.account.grant.revoke, { client: RELYING_PARTY }),
		expected: { allowed: true },
	},
	{
		name: "a user keeps the consent the account area signs in with",
		role: "user",
		check: (access) => access.check(abilities.account.grant.revoke, { client: OWN_CLIENT }),
		expected: { allowed: false, cause: "denied", reason: "own-client" },
	},
	{
		name: "an admin keeps it as well",
		role: "admin",
		check: (access) => access.check(abilities.account.grant.revoke, { client: OWN_CLIENT }),
		expected: { allowed: false, cause: "denied", reason: "own-client" },
	},
];

describe("policy", () => {
	test("compiles", () => {
		expect(isSuccess(policy.compile())).toBe(true);
	});

	test.each(CASES)("$name", ({ role, check, expected }) => {
		expect(check(accessAs(role))).toMatchObject(expected);
	});

	test("a subject holding neither role is refused everything", () => {
		let access = testAccess(policy, { roles: [], facts: { actor: { id: SUBJECT_ID } } });

		expect(access.can(abilities.admin.access)).toBe(false);
		expect(access.can(abilities.account.session.revoke, { session: OWN_SESSION })).toBe(false);
		expect(access.can(abilities.account.grant.revoke, { client: RELYING_PARTY })).toBe(false);
	});

	test("the table reaches every grant the policy writes", () => {
		let unmatched = policy.coverage(DECISIONS);

		expect(isSuccess(unmatched) ? unmatched.data : unmatched.error).toEqual([]);
	});
});
