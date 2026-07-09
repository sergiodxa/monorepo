/**
 * Resolves other users' profiles (name, avatar, email) from the auth server, for
 * pages that need to show more than the signed-in viewer's own identity — the team
 * settings member list and the account page's team list. The session only ever
 * carries the current viewer's own profile, so member profiles are fetched
 * server-to-server via `@pkg/auth-sdk`'s client-credentials flow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthSDK, Subject } from "@pkg/auth-sdk";

import { isFailure } from "@pkg/result";

/** Resolves every listed subject id to its auth-server profile, best-effort. */
export async function resolveSubjects(
	sdk: AuthSDK,
	subjectIds: string[],
): Promise<Map<string, Subject>> {
	let map = new Map<string, Subject>();
	if (subjectIds.length === 0) return map;

	let tokenResult = await sdk.authenticate();
	if (isFailure(tokenResult)) return map;

	let results = await Promise.allSettled(
		subjectIds.map(async (subjectId) => {
			let result = await sdk.fetchSubjectById(subjectId, tokenResult.data);
			if (isFailure(result)) throw result.error;
			return [subjectId, result.data] as const;
		}),
	);

	for (let result of results) {
		if (result.status === "fulfilled") map.set(result.value[0], result.value[1]);
	}

	return map;
}
