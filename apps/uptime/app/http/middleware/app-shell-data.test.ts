/**
 * The shell's data middleware, run through a router behind the real auth and team guards: it
 * counts each kind's failing monitors (and only failing, enabled ones) and flags a past-due
 * owner subscription, telling the owner apart from a member.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { database } from "@sdxc/database-middleware";
import { generateUUID } from "@sdxc/uuid/v7";
import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test } from "vitest";

import type { AppShellData } from "~/app/http/middleware/app-shell-data";

import appShellData from "~/app/http/middleware/app-shell-data";
import { auth, type Viewer } from "~/app/http/middleware/auth";
import models from "~/app/http/middleware/models";
import requireTeam from "~/app/http/middleware/require-team";
import { signIn } from "~/app/test/auth";
import { createTestDatabase } from "~/app/test/db";
import {
	cronJobMonitors,
	memberships,
	monitors,
	subscriptions,
	tcpMonitors,
	teams,
} from "~/database/schema";

type Db = ReturnType<typeof createTestDatabase>["db"];

let owner: Viewer = { id: "owner_1", name: "Owner", email: "owner@example.com", avatar: "" };
let member: Viewer = { id: "member_1", name: "Member", email: "member@example.com", avatar: "" };

/** A team with an owner and a member, two down HTTP monitors (one paused), a timed-out TCP and a missed cron job. */
async function seed(db: Db) {
	let team = await db.create(
		teams,
		{ id: generateUUID(), owner_id: owner.id, name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	for (let viewer of [owner, member]) {
		await db.create(
			memberships,
			{ id: generateUUID(), subject_id: viewer.id, team_id: team.id, role: "admin" },
			{ touch: true },
		);
	}
	let http = { team_id: team.id, author_id: owner.id, url: "https://acme.com" };
	await db.create(
		monitors,
		{ ...http, id: generateUUID(), name: "Down", enabled_at: Date.now(), last_status: "down" },
		{ touch: true },
	);
	await db.create(
		monitors,
		{ ...http, id: generateUUID(), name: "Paused", enabled_at: null, last_status: "down" },
		{ touch: true },
	);
	await db.create(
		monitors,
		{ ...http, id: generateUUID(), name: "Up", enabled_at: Date.now(), last_status: "up" },
		{ touch: true },
	);
	await db.create(
		tcpMonitors,
		{
			id: generateUUID(),
			team_id: team.id,
			name: "DB",
			host: "db",
			port: 5432,
			last_status: "timeout",
		},
		{ touch: true },
	);
	await db.create(
		cronJobMonitors,
		{
			id: generateUUID(),
			team_id: team.id,
			name: "Backup",
			cron_expression: "0 3 * * *",
			status: "missed",
			enabled_at: Date.now(),
		},
		{ touch: true },
	);
	return team;
}

/** Fetches the team page as `viewer`, answering with the published shell data. */
async function fetchShell(db: Db, viewer: Viewer): Promise<AppShellData> {
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			session(createCookie("test-session", { secrets: ["s"] }), createMemorySessionStorage()),
			(_ctx, next) => {
				signIn(viewer);
				return next();
			},
			auth,
		],
	});
	router.get("/:team", {
		middleware: [requireTeam, appShellData()],
		handler: (ctx) => Response.json(ctx.shell),
	});
	return (await (await router.fetch("https://example.com/acme")).json()) as AppShellData;
}

describe("appShellData", () => {
	test("counts only enabled, failing monitors of each kind", async () => {
		let { db } = createTestDatabase();
		await seed(db);

		let shell = await fetchShell(db, owner);

		expect(shell.attention).toEqual({ http: 1, dns: 0, tcp: 1, flow: 0, cron: 1 });
		expect(shell.billingProblem).toBe(false);
	});

	test("flags a past-due owner subscription and tells the owner apart from a member", async () => {
		let { db } = createTestDatabase();
		await seed(db);
		await db.create(
			subscriptions,
			{
				id: generateUUID(),
				external_customer_id: owner.id,
				billing_subscription_id: "sub_1",
				billing_product_slug: "monitoring",
				status: "past_due",
				current_period_end: null,
				revoked_at: null,
				billing_read_at: Date.now(),
			},
			{ touch: true },
		);

		let asOwner = await fetchShell(db, owner);
		let asMember = await fetchShell(db, member);

		expect(asOwner).toMatchObject({ billingProblem: true, isOwner: true });
		expect(asMember).toMatchObject({ billingProblem: true, isOwner: false });
	});
});
