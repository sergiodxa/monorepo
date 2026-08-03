/**
 * Unit tests for the `requireRole` guard factory. It is pure decision logic over
 * `ctx.team.owner_id` and `ctx.membership.role` — no router, database, or session
 * is needed to exercise the owner-bypass, allowed-role, and forbidden branches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { RequestContext } from "remix/fetch-router";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import requireRole from "~/app/http/middleware/require-role";

/** Side-effect import: declares `ctx.team` / `ctx.membership` on `RequestContext`. */
import "~/app/http/middleware/require-team";

function createTeam(overrides: Partial<SelectTeam> = {}): SelectTeam {
	return {
		id: "team_1",
		created_at: 0,
		updated_at: 0,
		owner_id: "owner_1",
		name: "Acme",
		slug: "acme",
		logo: null,
		...overrides,
	};
}

function createMembership(overrides: Partial<SelectMembership> = {}): SelectMembership {
	return {
		id: "membership_1",
		created_at: 0,
		updated_at: 0,
		subject_id: "member_1",
		team_id: "team_1",
		role: "member",
		last_daily_digest_at: null,
		last_weekly_digest_at: null,
		...overrides,
	};
}

function createContext(team: SelectTeam, membership: SelectMembership) {
	let ctx = new RequestContext(new Request("https://example.com/team"));
	ctx.team = team;
	ctx.membership = membership;
	return ctx;
}

describe("requireRole", () => {
	test("allows the team owner through even when no roles are listed", async () => {
		let ctx = createContext(
			createTeam({ owner_id: "member_1" }),
			createMembership({ subject_id: "member_1", role: "member" }),
		);
		let calledNext = false;

		let response = await requireRole()(ctx, async () => {
			calledNext = true;
			return new Response("ok");
		});

		expect(calledNext).toBe(true);
		expect(response.status).toBe(200);
	});

	test("allows a non-owner whose role is in the allowed list", async () => {
		let ctx = createContext(createTeam(), createMembership({ role: "admin" }));
		let calledNext = false;

		let response = await requireRole("admin")(ctx, async () => {
			calledNext = true;
			return new Response("ok");
		});

		expect(calledNext).toBe(true);
		expect(response.status).toBe(200);
	});

	test("forbids a non-owner whose role is not in the allowed list", async () => {
		let ctx = createContext(createTeam(), createMembership({ role: "member" }));
		let calledNext = false;

		let response = await requireRole("admin")(ctx, async () => {
			calledNext = true;
			return new Response("ok");
		});

		expect(calledNext).toBe(false);
		expect(response.status).toBe(403);
		expect(await response.text()).toContain("do not have permission");
	});

	test("forbids a non-owner when no roles are allowed at all", async () => {
		let ctx = createContext(createTeam(), createMembership({ role: "admin" }));

		let response = await requireRole()(ctx, async () => new Response("ok"));

		expect(response.status).toBe(403);
	});

	test("allows a non-owner matching one of several allowed roles", async () => {
		let ctx = createContext(createTeam(), createMembership({ role: "member" }));

		let response = await requireRole("admin", "member")(ctx, async () => new Response("ok"));

		expect(response.status).toBe(200);
	});
});
