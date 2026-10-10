/**
 * Tests for the subjects model: lookup by email and id, the paginated admin listing and
 * count, and create/update/delete — against an in-memory SQLite database with the real
 * migrations applied.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CreateValues } from "@sdxc/data-model";

import { isFailure, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { AuthModels } from "~/app/models";
import type { Subjects } from "~/app/models/subjects";

import { createTestModels } from "~/app/lib/test/models";

let models: AuthModels;

beforeEach(() => {
	models = createTestModels().models;
});

/** Registers a subject with unique-by-default attributes a test can override. */
async function createSubject(overrides: Partial<CreateValues<typeof Subjects>> = {}) {
	return unwrap(
		await models.subjects.create({
			email_address: "jane@example.com",
			display_name: "Jane Doe",
			username: "jane",
			avatar: "https://example.com/jane.png",
			...overrides,
		}),
	);
}

describe("subjects.create", () => {
	test("stores the subject with epoch-ms timestamps and the default role", async () => {
		let subject = await createSubject();

		expect(subject.id).toBeTypeOf("string");
		expect(subject.role).toBe("user");
		expect(subject.created_at).toBeTypeOf("number");
		expect(subject.updated_at).toBeTypeOf("number");
		expect(subject.created_at).toBeGreaterThan(1_700_000_000_000);
	});

	test("leaves the email unverified unless a verification stamp is given", async () => {
		let unverified = await createSubject();
		expect(unverified.email_verified_at).toBeNull();

		let verified = await createSubject({
			email_address: "sam@example.com",
			username: "sam",
			email_verified_at: 1_750_000_000_000,
		});
		expect(verified.email_verified_at).toBe(1_750_000_000_000);
	});

	test("honors a caller-supplied id so a provisioning flow can pick it", async () => {
		let subject = await createSubject({ id: "subject-1" });
		expect(subject.id).toBe("subject-1");
	});

	test("answers a failure for an address already registered", async () => {
		await createSubject();
		let duplicate = await models.subjects.create({
			email_address: "jane@example.com",
			display_name: "Other Jane",
			username: "other-jane",
			avatar: "https://example.com/other.png",
		});
		expect(isFailure(duplicate)).toBe(true);
	});
});

describe("subjects.findByEmail", () => {
	test("finds the registered subject", async () => {
		await createSubject();
		let found = await models.subjects.findByEmail("jane@example.com");
		expect(found?.username).toBe("jane");
	});

	test("returns null for an address nobody registered", async () => {
		expect(await models.subjects.findByEmail("nobody@example.com")).toBeNull();
	});
});

describe("subjects.find", () => {
	test("returns null for an unknown id instead of throwing", async () => {
		expect(await models.subjects.find("missing")).toBeNull();
	});
});

describe("subjects.page", () => {
	test("pages through subjects oldest first", async () => {
		await createSubject({ id: "a", email_address: "a@example.com", username: "a" });
		await createSubject({ id: "b", email_address: "b@example.com", username: "b" });
		await createSubject({ id: "c", email_address: "c@example.com", username: "c" });

		let first = await models.subjects.page({ limit: 2, offset: 0 });
		let second = await models.subjects.page({ limit: 2, offset: 2 });

		expect(first).toHaveLength(2);
		expect(second).toHaveLength(1);
		expect([...first, ...second].map((subject) => subject.id)).toEqual(["a", "b", "c"]);
	});
});

describe("subjects count", () => {
	test("counts every subject", async () => {
		expect(await models.subjects.query().count()).toBe(0);
		await createSubject();
		expect(await models.subjects.query().count()).toBe(1);
	});
});

describe("subjects.update", () => {
	test("applies the changes and returns the stored row", async () => {
		let subject = await createSubject();
		let updated = unwrap(await models.subjects.update(subject.id, { display_name: "Jane R. Doe" }));

		expect(updated.display_name).toBe("Jane R. Doe");
		expect(await models.subjects.find(subject.id)).toMatchObject({
			display_name: "Jane R. Doe",
		});
	});

	test("answers a failure for a subject that no longer exists", async () => {
		expect(isFailure(await models.subjects.update("missing", { display_name: "Nobody" }))).toBe(
			true,
		);
	});
});

describe("subjects.delete", () => {
	test("removes the subject", async () => {
		let subject = await createSubject();
		unwrap(await models.subjects.delete(subject.id));
		expect(await models.subjects.find(subject.id)).toBeNull();
	});
});
