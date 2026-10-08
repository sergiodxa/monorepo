/**
 * Tests the decision rules over one article policy: additive roles, guards
 * that refuse admins too, guests through optional facts, ceilings, fields,
 * lazy facts that fail closed, and the group answers handed to components.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, success, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Access, AccessBinding } from "./access.js";
import type { Decision } from "./decision.js";
import type { FactsOf } from "./policy.js";

import { abilities, ability, context } from "./catalog.js";
import { Forbidden } from "./decision.js";
import { factLoader } from "./facts.js";
import { allow, deny, fact } from "./grants.js";
import { definePolicy } from "./policy.js";

interface Article {
	id: string;
	authorId: string;
	orgId: string;
	published: boolean;
	locked: boolean;
}

interface Org {
	id: string;
}

interface Actor {
	id: string;
	orgId: string;
}

interface BillingFacts {
	products: string[];
	features: string[];
}

const CATALOG = abilities({
	article: {
		create: ability({ context: context<{ org: Org }>("org") }),
		read: ability({ context: context<{ article: Article }>("article"), deniedAs: "notFound" }),
		update: ability({
			context: context<{ article: Article }>("article"),
			fields: ["title", "body", "published"],
		}),
		delete: ability({ context: context<{ article: Article }>("article") }),
	},
	reports: { export: ability({ description: "Export usage reports as CSV" }) },
	agent: { connect: ability(), write: ability() },
});

const POLICY = definePolicy(CATALOG, {
	facts: {
		actor: fact<Actor>({ optional: true }),
		billing: fact<BillingFacts>(),
		flags: fact<{ reportsExport: boolean }>(),
	},
	conditions: {
		owner: {
			op: "all",
			of: [
				{ op: "exists", field: "actor" },
				{ op: "eq", field: "article.authorId", path: "actor.id" },
			],
		},
		otherOrg: {
			op: "all",
			of: [
				{ op: "exists", field: "actor" },
				{ op: "ne", field: "article.orgId", path: "actor.orgId" },
			],
		},
	},
	everyone: [
		allow("article.read", { when: { op: "eq", field: "article.published", value: true } }),
	],
	roles: {
		member: [
			allow(["article.create", "article.read", "reports.export"]),
			allow("article.update", {
				when: { op: "condition", name: "owner" },
				fields: ["title", "body"],
			}),
		],
		editor: {
			inherits: ["member"],
			grants: [
				allow("article", { except: ["article.delete"] }),
				allow("article.delete", {
					when: { op: "not", of: { op: "eq", field: "article.locked", value: true } },
				}),
			],
		},
		admin: [allow("*")],
		"api:read": [allow(["article.read", "reports.export"])],
	},
	guards: [
		deny(["article.read", "article.update", "article.delete"], {
			id: "tenant",
			when: { op: "condition", name: "otherOrg" },
			reason: "other-tenant",
			as: "notFound",
		}),
		deny("reports.export", {
			id: "plan-reports",
			when: { op: "not", of: { op: "includes", field: "billing.features", value: "reports" } },
			reason: "entitlement:reports",
		}),
		deny("reports.export", {
			id: "reports-switch",
			when: { op: "eq", field: "flags.reportsExport", value: false },
			reason: "switched-off",
		}),
	],
});

const ACTOR: Actor = { id: "u1", orgId: "o1" };
const PAID: BillingFacts = { products: ["pro"], features: ["reports"] };
const FREE: BillingFacts = { products: [], features: [] };
const OWN: Article = { id: "a1", authorId: "u1", orgId: "o1", published: false, locked: false };

/** Binds the policy with every fact given as a value. */
function bind(binding: AccessBinding<FactsOf<typeof POLICY>>) {
	return unwrap(POLICY.for(binding));
}

/** A member of org `o1` on a paid plan, with reports switched on. */
function member(roles: string[] = ["member"]): Access {
	return bind({ roles, facts: { actor: ACTOR, billing: PAID, flags: { reportsExport: true } } });
}

describe("roles", () => {
	test("members edit their own articles and nobody else's", () => {
		let access = member();

		expect(access.can(CATALOG.article.update, { article: OWN })).toBe(true);
		expect(access.can(CATALOG.article.update, { article: { ...OWN, authorId: "u2" } })).toBe(false);
	});

	test("holding several roles is their union", () => {
		let locked = { ...OWN, authorId: "u2", locked: true };

		expect(member(["member"]).can(CATALOG.article.delete, { article: OWN })).toBe(false);
		expect(member(["member", "editor"]).can(CATALOG.article.delete, { article: OWN })).toBe(true);
		expect(member(["editor"]).can(CATALOG.article.delete, { article: locked })).toBe(false);
	});

	test("an inherited role grants what its parent grants", () => {
		expect(member(["editor"]).can(CATALOG.reports.export)).toBe(true);
	});

	test("a role the policy does not define grants nothing", () => {
		expect(member(["ghost"]).check(CATALOG.reports.export)).toMatchObject({
			allowed: false,
			cause: "ungranted",
			as: "forbidden",
		});
	});

	test("an allowed decision names every grant that allowed it", () => {
		expect(member(["member", "admin"]).check(CATALOG.reports.export)).toEqual({
			ability: "reports.export",
			allowed: true,
			grants: ["roles.member.0", "roles.admin.0"],
		});
	});
});

describe("guards", () => {
	test("refuse another tenant's article as not found, even to an admin", () => {
		let article = { ...OWN, orgId: "o2", published: true };

		expect(member(["admin"]).check(CATALOG.article.read, { article })).toEqual({
			ability: "article.read",
			allowed: false,
			cause: "denied",
			as: "notFound",
			reason: "other-tenant",
			grants: ["tenant"],
		});
	});

	test("gate a claim on the plan and on a kill switch, each with its reason", () => {
		let free = bind({ roles: ["admin"], facts: { billing: FREE, flags: { reportsExport: true } } });
		let off = bind({ roles: ["admin"], facts: { billing: PAID, flags: { reportsExport: false } } });

		expect(free.check(CATALOG.reports.export)).toMatchObject({ reason: "entitlement:reports" });
		expect(off.check(CATALOG.reports.export)).toMatchObject({ reason: "switched-off" });
	});

	test("let notFound win when several guards match", () => {
		let policy = definePolicy(CATALOG, {
			roles: { admin: [allow("*")] },
			guards: [
				deny("article.delete", { id: "first", reason: "locked" }),
				deny("article.delete", { id: "second", reason: "hidden", as: "notFound" }),
			],
		});
		let access = unwrap(policy.for({ roles: ["admin"] }));

		expect(access.check(CATALOG.article.delete, { article: OWN })).toMatchObject({
			cause: "denied",
			as: "notFound",
			reason: "hidden",
			grants: ["first", "second"],
		});
	});
});

describe("guests", () => {
	let guest = bind({ roles: [], facts: { billing: FREE, flags: { reportsExport: true } } });

	test("read published articles through everyone", () => {
		expect(guest.can(CATALOG.article.read, { article: { ...OWN, published: true } })).toBe(true);
	});

	test("are refused drafts as not found, without an error", () => {
		expect(guest.check(CATALOG.article.read, { article: OWN })).toEqual({
			ability: "article.read",
			allowed: false,
			cause: "ungranted",
			as: "notFound",
		});
	});

	test("pass a tenant guard reading the absent actor", () => {
		expect(guest.check(CATALOG.article.update, { article: OWN })).toMatchObject({
			cause: "ungranted",
		});
	});
});

describe("facts that are missing", () => {
	test("an unbound required fact refuses with cause error", () => {
		let access = bind({ roles: ["member"], facts: { actor: ACTOR } });
		let decision = access.check(CATALOG.reports.export);

		expect(decision).toMatchObject({ allowed: false, cause: "error" });
		expect(decision.allowed === false && decision.cause === "error" && decision.errors).toEqual([
			expect.objectContaining({ grant: "plan-reports" }),
			expect.objectContaining({ grant: "reports-switch" }),
		]);
	});

	test("a mistyped fact refuses with cause error instead of granting", () => {
		let access = bind({
			roles: ["admin"],
			facts: { billing: PAID, flags: { reportsExport: "no" as unknown as boolean } },
		});

		expect(access.check(CATALOG.reports.export)).toMatchObject({ cause: "error" });
	});

	test("abilities that read no failed fact still answer", () => {
		let access = bind({ roles: ["member"], facts: { actor: ACTOR } });

		expect(access.can(CATALOG.article.create, { org: { id: "o1" } })).toBe(true);
	});
});

describe("lazy facts", () => {
	test("load once each, only for the abilities asked", async () => {
		let reads = { billing: 0, flags: 0 };
		let access = bind({
			roles: ["member"],
			facts: {
				actor: ACTOR,
				billing: () => {
					reads.billing += 1;
					return PAID;
				},
				flags: async () => {
					reads.flags += 1;
					return { reportsExport: true };
				},
			},
		});

		await access.load(CATALOG.article);
		expect(reads).toEqual({ billing: 0, flags: 0 });

		await Promise.all([access.load(CATALOG.reports), access.load(CATALOG.reports.export)]);
		expect(reads).toEqual({ billing: 1, flags: 1 });
		expect(access.can(CATALOG.reports.export)).toBe(true);
	});

	test("refuse with cause error before they load", () => {
		let access = bind({
			roles: ["member"],
			facts: { billing: async () => PAID, flags: { reportsExport: true } },
		});

		expect(access.check(CATALOG.reports.export)).toMatchObject({
			cause: "error",
			errors: [
				{
					grant: "plan-reports",
					message: 'Fact "billing" has not loaded',
					path: "when",
					missing: "billing",
				},
			],
		});
	});

	test("a failing source refuses only what reads it, and load never rejects", async () => {
		let access = bind({
			roles: ["member"],
			facts: {
				actor: ACTOR,
				billing: async () => {
					throw new Error("billing is down");
				},
				flags: { reportsExport: true },
			},
		});

		await expect(access.load(CATALOG.reports, CATALOG.article)).resolves.toBeUndefined();
		expect(access.check(CATALOG.reports.export)).toMatchObject({ cause: "error" });
		expect(access.can(CATALOG.article.update, { article: OWN })).toBe(true);
	});

	test("a loader learns the paths the policy reads under its root", async () => {
		let asked: string[] = [];
		let access = bind({
			roles: ["member"],
			facts: {
				billing: PAID,
				flags: factLoader(async ({ root, paths }) => {
					asked.push(root, ...paths);
					return success({ reportsExport: true });
				}),
			},
		});

		await access.load(CATALOG.reports);

		expect(asked).toEqual(["flags", "reportsExport"]);
		expect(access.can(CATALOG.reports.export)).toBe(true);
	});

	test("roles given as a function resolve on load", async () => {
		let access = bind({
			roles: async () => ["member"],
			facts: { billing: PAID, flags: { reportsExport: true } },
		});

		expect(access.check(CATALOG.reports.export)).toMatchObject({ cause: "error" });
		await access.load(CATALOG.reports);
		expect(access.can(CATALOG.reports.export)).toBe(true);
	});
});

describe("ceilings", () => {
	test("a token never does more than its scope, nor more than its holder", () => {
		let token = bind({
			roles: ["member"],
			within: ["api:read"],
			facts: { actor: ACTOR, billing: PAID, flags: { reportsExport: true } },
		});

		expect(token.can(CATALOG.article.read, { article: OWN })).toBe(true);
		expect(token.check(CATALOG.article.update, { article: OWN })).toMatchObject({
			cause: "outOfScope",
		});

		let reader = bind({
			roles: [],
			within: ["api:read"],
			facts: { billing: PAID, flags: { reportsExport: true } },
		});
		expect(reader.check(CATALOG.reports.export)).toMatchObject({ cause: "ungranted" });
	});
});

describe("fields", () => {
	test("narrow what a grant covers, and a check on one field follows them", () => {
		let access = member();

		expect(access.permittedFields(CATALOG.article.update, { article: OWN })).toEqual([
			"title",
			"body",
		]);
		expect(access.can(CATALOG.article.update, { article: OWN }, "title")).toBe(true);
		expect(access.can(CATALOG.article.update, { article: OWN }, "published")).toBe(false);
		expect(member(["editor"]).permittedFields(CATALOG.article.update, { article: OWN })).toEqual([
			"title",
			"body",
			"published",
		]);
	});

	test("are empty when the ability is refused", () => {
		let other = { ...OWN, authorId: "u2" };

		expect(member().permittedFields(CATALOG.article.update, { article: other })).toEqual([]);
	});

	test("a guard on a field removes it and refuses checks of it", () => {
		let policy = definePolicy(CATALOG, {
			roles: { editor: [allow("article.update")] },
			guards: [
				deny("article.update", {
					id: "published-lock",
					when: { op: "eq", field: "article.locked", value: true },
					fields: ["published"],
					reason: "locked",
				}),
			],
		});
		let access = unwrap(policy.for({ roles: ["editor"] }));
		let locked = { ...OWN, locked: true };

		expect(access.permittedFields(CATALOG.article.update, { article: locked })).toEqual([
			"title",
			"body",
		]);
		expect(access.check(CATALOG.article.update, { article: locked }, "published")).toMatchObject({
			cause: "denied",
			reason: "locked",
		});
		expect(access.can(CATALOG.article.update, { article: locked })).toBe(true);
	});
});

describe("answers for pages", () => {
	test("decide answers every ability of a group, each with its own keys", () => {
		let access = member();

		expect(access.decide(CATALOG.article, { article: OWN, org: { id: "o1" } })).toEqual({
			create: true,
			read: true,
			update: true,
			delete: false,
		});
	});

	test("decide answers false for a refusal of any cause", () => {
		let access = bind({ roles: ["admin"], facts: { flags: { reportsExport: true } } });

		expect(access.decide(CATALOG.reports, {})).toEqual({ export: false });
	});

	test("decisions are plain data that survive structured cloning", () => {
		let decision = bind({ roles: ["member"], facts: { actor: ACTOR } }).check(
			CATALOG.reports.export,
		);

		expect(structuredClone(decision)).toEqual(decision);
	});

	test("claims answers a whole catalog", () => {
		let free = bind({
			roles: ["member"],
			facts: { billing: FREE, flags: { reportsExport: true } },
		});

		expect(free.claims(CATALOG)).toEqual({
			article: {},
			reports: { export: false },
			agent: { connect: false, write: false },
		});
	});

	test("claims answers only the claims of a group", () => {
		let free = bind({
			roles: ["member"],
			facts: { billing: FREE, flags: { reportsExport: true } },
		});

		expect(free.claims(CATALOG.reports)).toEqual({ export: false });
		expect(free.claims(CATALOG.article)).toEqual({});
	});

	test("as derives an access per scope, sharing what is loaded", async () => {
		let billing = 0;
		let account = bind({
			roles: [],
			facts: {
				billing: () => {
					billing += 1;
					return PAID;
				},
				flags: { reportsExport: true },
			},
		});
		await account.load(CATALOG.reports);

		let inTeam = account.as({ roles: ["member"], facts: { actor: ACTOR } });

		expect(inTeam.can(CATALOG.reports.export)).toBe(true);
		expect(inTeam.can(CATALOG.article.update, { article: OWN })).toBe(true);
		expect(account.can(CATALOG.reports.export)).toBe(false);
		expect(billing).toBe(1);
	});
});

describe("authorize", () => {
	test("returns a Forbidden failure carrying the refusal", () => {
		let result = member().authorize(CATALOG.article.delete, { article: OWN });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(Forbidden);
			expect(result.error.decision).toMatchObject({
				ability: "article.delete",
				cause: "ungranted",
			});
		}
		expect(isSuccess(member().authorize(CATALOG.article.create, { org: { id: "o1" } }))).toBe(true);
	});
});

describe("onDecision", () => {
	test("sees every decision, which coverage reads back", () => {
		let decisions: Decision[] = [];
		let access = unwrap(
			POLICY.for({
				roles: ["member"],
				facts: { actor: ACTOR, billing: PAID, flags: { reportsExport: true } },
				onDecision: (decision) => decisions.push(decision),
			}),
		);

		access.can(CATALOG.reports.export);
		access.decide(CATALOG.article, { article: OWN, org: { id: "o1" } });

		expect(decisions.map((decision) => decision.ability)).toEqual([
			"reports.export",
			"article.create",
			"article.read",
			"article.update",
			"article.delete",
		]);
		expect(unwrap(POLICY.coverage(decisions))).toEqual([
			"everyone.0",
			"roles.editor.0",
			"roles.editor.1",
			"roles.admin.0",
			"roles.api:read.0",
			"tenant",
			"plan-reports",
			"reports-switch",
		]);
	});
});

describe("order independence", () => {
	test("reordering grants and guards changes no answer", () => {
		let reversed = definePolicy(CATALOG, {
			...POLICY.definition,
			everyone: [...(POLICY.definition.everyone ?? [])].reverse(),
			guards: [...(POLICY.definition.guards ?? [])].reverse(),
		});
		let facts = { actor: ACTOR, billing: FREE, flags: { reportsExport: false } };
		let a = unwrap(POLICY.for({ roles: ["member", "editor"], facts }));
		let b = unwrap(reversed.for({ roles: ["editor", "member"], facts }));

		for (let article of [OWN, { ...OWN, orgId: "o2" }, { ...OWN, locked: true }]) {
			expect(b.decide(CATALOG.article, { article, org: { id: "o1" } })).toEqual(
				a.decide(CATALOG.article, { article, org: { id: "o1" } }),
			);
		}
		expect(b.check(CATALOG.reports.export)).toMatchObject({ allowed: false, cause: "denied" });
	});
});
