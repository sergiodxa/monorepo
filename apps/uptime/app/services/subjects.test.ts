import type { AuthSDK, Subject } from "@pkg/auth-sdk";
import type { Result } from "@pkg/result";

import { AuthenticationError, SubjectNotFoundError } from "@pkg/auth-sdk";
import { failure, success } from "@pkg/result";
/**
 * Unit tests for `resolveSubjects`, the best-effort batch profile lookup used by
 * the team settings member list and the account page's team list. A fake
 * `AuthSDK` stands in for the real server-to-server client so every outcome
 * (empty input, auth failure, per-subject success/failure, mixed results) is
 * exercised without a real network call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { resolveSubjects } from "~/app/services/subjects";

/** Builds a minimal `Subject` fixture with the given id. */
function subject(id: string): Subject {
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

/** Builds a fake `AuthSDK` from an `authenticate` outcome and a per-id lookup map. */
function fakeSdk(
	authenticateResult: Awaited<ReturnType<AuthSDK["authenticate"]>>,
	subjectsById: Map<string, Awaited<ReturnType<AuthSDK["fetchSubjectById"]>>>,
) {
	return {
		authenticate: async () => authenticateResult,
		fetchSubjectById: async (subjectId: string) => {
			let result = subjectsById.get(subjectId);
			if (!result) throw new Error(`unexpected subjectId: ${subjectId}`);
			return result;
		},
	} as unknown as AuthSDK;
}

describe("resolveSubjects", () => {
	test("returns an empty map without authenticating when there are no subject ids", async () => {
		let authenticate = async () => success("token");
		let sdk = { authenticate } as unknown as AuthSDK;

		let map = await resolveSubjects(sdk, []);

		expect(map.size).toBe(0);
	});

	test("returns an empty map when authentication fails", async () => {
		let sdk = fakeSdk(
			failure(new AuthenticationError("client_credentials rejected", "invalid_client")),
			new Map(),
		);

		let map = await resolveSubjects(sdk, ["id-1"]);

		expect(map.size).toBe(0);
	});

	test("resolves every subject id to its profile on success", async () => {
		let sdk = fakeSdk(
			success("token"),
			new Map([
				["id-1", success(subject("id-1"))],
				["id-2", success(subject("id-2"))],
			]),
		);

		let map = await resolveSubjects(sdk, ["id-1", "id-2"]);

		expect(map.size).toBe(2);
		expect(map.get("id-1")).toEqual(subject("id-1"));
		expect(map.get("id-2")).toEqual(subject("id-2"));
	});

	test("best-effort: drops subject ids that fail to resolve, keeping the rest", async () => {
		let sdk = fakeSdk(
			success("token"),
			new Map<string, Result<Subject, SubjectNotFoundError>>([
				["id-1", success(subject("id-1"))],
				["id-2", failure(new SubjectNotFoundError("id-2"))],
			]),
		);

		let map = await resolveSubjects(sdk, ["id-1", "id-2"]);

		expect(map.size).toBe(1);
		expect(map.get("id-1")).toEqual(subject("id-1"));
		expect(map.has("id-2")).toBe(false);
	});

	test("returns an empty map when every subject lookup fails", async () => {
		let sdk = fakeSdk(
			success("token"),
			new Map<string, Result<Subject, SubjectNotFoundError>>([
				["id-1", failure(new SubjectNotFoundError("id-1"))],
				["id-2", failure(new SubjectNotFoundError("id-2"))],
			]),
		);

		let map = await resolveSubjects(sdk, ["id-1", "id-2"]);

		expect(map.size).toBe(0);
	});
});
