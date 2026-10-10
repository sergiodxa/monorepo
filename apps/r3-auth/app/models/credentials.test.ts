/**
 * Tests for the credentials model: storing a subject's password hash, looking it up again,
 * rewriting it, and setting a verified password whether or not a credential exists yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { AuthModels } from "~/app/models";

import { createTestModels } from "~/app/lib/test/models";

let models: AuthModels;
let subjectId: string;

beforeEach(async () => {
	models = createTestModels().models;
	let subject = unwrap(
		await models.subjects.create({
			email_address: "jane@example.com",
			display_name: "Jane Doe",
			username: "jane",
			avatar: "https://example.com/jane.png",
		}),
	);
	subjectId = subject.id;
});

/** Stores a credential for the test's subject. */
function createCredential(passwordHash: string, verifiedAt: number | null) {
	return models.credentials.create({
		subject_id: subjectId,
		password_hash: passwordHash,
		verified_at: verifiedAt,
	});
}

describe("credentials.create", () => {
	test("persists the credential and returns the stored row", async () => {
		let credential = unwrap(await createCredential("$2a$10$hash", 1_750_000_000_000));

		expect(credential.subject_id).toBe(subjectId);
		expect(credential.password_hash).toBe("$2a$10$hash");
		expect(credential.verified_at).toBe(1_750_000_000_000);

		expect(await models.credentials.findBySubjectId(subjectId)).not.toBeNull();
	});

	test("stores no verification instant when the caller has not established the owner", async () => {
		let credential = unwrap(await createCredential("$2a$10$hash", null));

		expect(credential.verified_at).toBeNull();
	});

	test("refuses a second credential for the same subject", async () => {
		unwrap(await createCredential("$2a$10$first", Date.now()));
		expect(isFailure(await createCredential("$2a$10$second", Date.now()))).toBe(true);
	});
});

describe("credentials.findBySubjectId", () => {
	test("returns the subject's credential", async () => {
		unwrap(await createCredential("$2a$10$hash", Date.now()));
		let found = await models.credentials.findBySubjectId(subjectId);
		expect(found?.password_hash).toBe("$2a$10$hash");
	});

	test("returns null for a subject that signs in another way", async () => {
		expect(await models.credentials.findBySubjectId(subjectId)).toBeNull();
	});
});

describe("credentials.updatePasswordHash", () => {
	test("replaces the stored hash for the subject", async () => {
		unwrap(await createCredential("$2a$10$legacy", Date.now()));

		let rewritten = await models.credentials.updatePasswordHash(subjectId, "$scrypt$upgraded");

		expect(rewritten).toBe(1);
		expect((await models.credentials.findBySubjectId(subjectId))?.password_hash).toBe(
			"$scrypt$upgraded",
		);
	});

	test("creates nothing for a subject with no credential, who must stay without a password", async () => {
		let rewritten = await models.credentials.updatePasswordHash(subjectId, "$scrypt$upgraded");

		expect(rewritten).toBe(0);
		expect(await models.credentials.findBySubjectId(subjectId)).toBeNull();
	});
});

describe("credentials.setVerifiedPassword", () => {
	test("creates a usable credential for a subject without one", async () => {
		let set = await models.credentials.setVerifiedPassword(subjectId, "$scrypt$new", 1_000);

		expect(isSuccess(set)).toBe(true);
		expect(await models.credentials.findBySubjectId(subjectId)).toMatchObject({
			password_hash: "$scrypt$new",
			verified_at: 1_000,
		});
	});

	test("rewrites and verifies the existing credential in place", async () => {
		let existing = unwrap(await createCredential("$scrypt$old", null));

		unwrap(await models.credentials.setVerifiedPassword(subjectId, "$scrypt$new", 2_000));

		expect(await models.credentials.query().count()).toBe(1);
		expect(await models.credentials.findBySubjectId(subjectId)).toMatchObject({
			id: existing.id,
			password_hash: "$scrypt$new",
			verified_at: 2_000,
		});
	});
});
