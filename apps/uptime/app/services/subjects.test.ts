/**
 * Unit tests for `resolveSubjects`, the batch profile lookup behind the team settings
 * member list, the account page's team list, and the digest job. A fake `ManagementClient`
 * covers every outcome: empty input, a subject with no record, an unanswered read, a mix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@pkg/result";

import {
	ManagementClient,
	ManagementError,
	ManagementErrorCode,
	SubjectNotFoundError,
} from "@pkg/auth/management-client";
import { failure, success } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { resolveSubjects } from "~/app/services/subjects";

/** One subject as the management API publishes it. */
function subject(id: string): ManagementClient.Subject {
	return {
		id,
		createdAt: new Date("2026-01-01T00:00:00Z"),
		updatedAt: new Date("2026-01-01T00:00:00Z"),
		displayName: `User ${id}`,
		avatar: `https://example.com/${id}.png`,
		role: "user",
		username: `user-${id}`,
		emailAddress: `${id}@example.com`,
	};
}

/** The read the provider answers for a subject it holds no record under. */
function notFound(id: string): SubjectRead {
	return failure(new SubjectNotFoundError(id));
}

/** The read the provider answers while a throttle is holding this app off. */
function throttled(): SubjectRead {
	return failure(
		new ManagementError("too many reads", {
			code: ManagementErrorCode.RateLimited,
			status: 429,
		}),
	);
}

/** The read the provider answers for a subject it holds a record under. */
function found(id: string): SubjectRead {
	return success(subject(id));
}

/** What one seeded lookup answers with. */
type SubjectRead = Result<ManagementClient.Subject, SubjectNotFoundError | ManagementError>;

/** A management client answering only for the ids a test seeded. */
function fakeAdmin(subjectsById: Map<string, SubjectRead>) {
	return {
		fetchSubjectById: async (subjectId: string) => {
			let result = subjectsById.get(subjectId);
			if (!result) throw new Error(`unexpected subjectId: ${subjectId}`);
			return result;
		},
	} as unknown as ManagementClient;
}

describe("resolveSubjects", () => {
	test("returns an empty map without reading anything when there are no subject ids", async () => {
		let admin = fakeAdmin(new Map());

		let map = await resolveSubjects(admin, []);

		expect(map.size).toBe(0);
	});

	test("resolves every subject id to its profile on success", async () => {
		let admin = fakeAdmin(
			new Map([
				["id-1", found("id-1")],
				["id-2", found("id-2")],
			]),
		);

		let map = await resolveSubjects(admin, ["id-1", "id-2"]);

		expect(map.size).toBe(2);
		expect(map.get("id-1")).toEqual(subject("id-1"));
		expect(map.get("id-2")).toEqual(subject("id-2"));
	});

	test("best-effort: drops subject ids the provider holds no record for, keeping the rest", async () => {
		let admin = fakeAdmin(
			new Map([
				["id-1", found("id-1")],
				["id-2", notFound("id-2")],
			]),
		);

		let map = await resolveSubjects(admin, ["id-1", "id-2"]);

		expect(map.size).toBe(1);
		expect(map.get("id-1")).toEqual(subject("id-1"));
		expect(map.has("id-2")).toBe(false);
	});

	test("returns an empty map when the provider holds a record for none of them", async () => {
		let admin = fakeAdmin(
			new Map([
				["id-1", notFound("id-1")],
				["id-2", notFound("id-2")],
			]),
		);

		let map = await resolveSubjects(admin, ["id-1", "id-2"]);

		expect(map.size).toBe(0);
	});

	/**
	 * A throttle, a refusal, or a provider fault can succeed on a later attempt, so the
	 * caller hears about it and decides whether a short list is usable.
	 */
	test("raises a condition the provider may answer later instead of dropping the subject", async () => {
		let admin = fakeAdmin(
			new Map([
				["id-1", found("id-1")],
				["id-2", throttled()],
			]),
		);

		await expect(resolveSubjects(admin, ["id-1", "id-2"])).rejects.toBeInstanceOf(ManagementError);
	});

	test("reports the code and status behind a raised condition", async () => {
		let admin = fakeAdmin(new Map([["id-1", throttled()]]));

		await expect(resolveSubjects(admin, ["id-1"])).rejects.toMatchObject({
			code: ManagementErrorCode.RateLimited,
			status: 429,
		});
	});

	test("looks each duplicated subject id up once", async () => {
		let reads: string[] = [];
		let admin = {
			fetchSubjectById: async (subjectId: string) => {
				reads.push(subjectId);
				return success(subject(subjectId));
			},
		} as unknown as ManagementClient;

		let map = await resolveSubjects(admin, ["id-1", "id-1", "id-2"]);

		expect(reads).toEqual(["id-1", "id-2"]);
		expect(map.size).toBe(2);
	});
});
