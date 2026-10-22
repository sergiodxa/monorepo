/**
 * Tests for the two principals uptime binds: a team member by the role their membership holds,
 * refused with the app's 403 page, and an API key capped by its scopes, refused with a Bearer
 * challenge naming the scope that grants the ability.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { parse as parseChallenge } from "@sdxc/auth/bearer-challenge";
import { requireAbility } from "@sdxc/authz/middleware/router";
import { isFailure } from "@sdxc/result";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vite-plus/test";

import type { ApiKeyScope, SelectApiKey, SelectMembership, SelectTeam } from "~/database/schema";

import { apiAccess, teamAccess } from "~/app/http/middleware/access";
import abilities from "~/app/policies/abilities";

/** A team owned by `owner-1`. */
const TEAM: SelectTeam = {
	id: "team-1",
	created_at: 0,
	updated_at: 0,
	owner_id: "owner-1",
	name: "Acme",
	slug: "acme",
	logo: null,
};

/** Seeds what `requireTeam` resolves: the team and the viewer's membership in it. */
function asMember(subjectId: string, role: "admin" | "member"): Middleware {
	let membership: SelectMembership = {
		id: `membership-${subjectId}`,
		created_at: 0,
		updated_at: 0,
		subject_id: subjectId,
		team_id: TEAM.id,
		role,
		last_daily_digest_at: null,
		last_weekly_digest_at: null,
	};
	return (ctx, next) => {
		ctx.team = TEAM;
		ctx.membership = membership;
		return next();
	};
}

/** Seeds what `requireApiKey` resolves: a key on the team carrying `scopes`. */
function asKey(scopes: ApiKeyScope[]): Middleware {
	let apiKey: SelectApiKey = {
		id: "key-1",
		created_at: 0,
		updated_at: 0,
		last_used_at: null,
		expires_at: null,
		team_id: TEAM.id,
		name: "CI",
		key_hash: "hash",
		key_prefix: "uptime_",
		scopes,
	};
	return (ctx, next) => {
		ctx.apiKey = apiKey;
		ctx.apiTeam = TEAM;
		return next();
	};
}

/** Any claim of the catalog; every claim shares one type. */
type Claim = typeof abilities.team.update;

/** Serves one route behind the principal and the claim, answering 204 when admitted. */
function serve(principal: Middleware[], ability: Claim): Promise<Response> {
	let router = createRouter();
	router.get("/test", {
		middleware: [...principal, requireAbility(ability)],
		handler: () => new Response(null, { status: 204 }),
	});
	return router.fetch(new Request("https://uptime.test/test"));
}

describe("teamAccess", () => {
	test.each([
		["the owner", asMember("owner-1", "admin")],
		["an admin", asMember("admin-1", "admin")],
	])("admits %s to the team's settings", async (_, seed) => {
		let response = await serve([seed, teamAccess], abilities.team.update);

		expect(response.status).toBe(204);
	});

	test("refuses a member with the app's 403 page", async () => {
		let response = await serve([asMember("member-1", "member"), teamAccess], abilities.team.update);

		expect(response.status).toBe(403);
		expect(await response.text()).toContain("You do not have permission to perform this action.");
	});

	test("lets only the owner delete the team", async () => {
		let owner = await serve([asMember("owner-1", "admin"), teamAccess], abilities.team.delete);
		let admin = await serve([asMember("admin-1", "admin"), teamAccess], abilities.team.delete);

		expect(owner.status).toBe(204);
		expect(admin.status).toBe(403);
	});
});

describe("apiAccess", () => {
	test("admits a key carrying the scope that grants the ability", async () => {
		let response = await serve([asKey(["monitors:read"]), apiAccess], abilities.monitors.read);

		expect(response.status).toBe(204);
	});

	test.each([
		[abilities.monitors.write, "monitors:write"],
		[abilities.ping.trigger, "ping:trigger"],
	] as const)("refuses %s with a challenge naming %s", async (ability, scope) => {
		let response = await serve([asKey(["monitors:read"]), apiAccess], ability);

		expect(response.status).toBe(403);
		let challenges = parseChallenge(response.headers.get("WWW-Authenticate") ?? "");
		if (isFailure(challenges)) return expect.unreachable(challenges.error.message);
		expect(challenges.data[0]?.error).toBe("insufficient_scope");
		expect(challenges.data[0]?.scope).toEqual([scope]);
	});
});
