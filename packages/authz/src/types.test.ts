/**
 * Type tests: ability names in grants, check contexts typed from the ability,
 * fact types in bindings, and the decision maps handed to components. They
 * are checked by the typecheck; the runtime assertions only keep Vitest busy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { AbilityName, Claims, Decisions } from "./catalog.js";

import { abilities, ability, context } from "./catalog.js";
import { allow, deny, fact } from "./grants.js";
import { definePolicy } from "./policy.js";

interface Article {
	id: string;
	publishedAt: Date | null;
}

const CATALOG = abilities({
	article: {
		read: ability({ context: context<{ article: Article }>("article") }),
		update: ability({
			context: context<{ article: Article }>("article"),
			fields: ["title", "body"],
		}),
	},
	team: {
		invite: ability({
			context: context<{ team: { id: string }; invitee: { email: string } }>("team", "invitee"),
		}),
	},
	reports: { export: ability() },
});

const POLICY = definePolicy(CATALOG, {
	facts: { actor: fact<{ id: string }>({ optional: true }), plan: fact<{ tier: string }>() },
	roles: {
		member: [allow("article.read")],
		editor: { inherits: ["member"], grants: [allow("article", { except: ["article.update"] })] },
	},
	guards: [deny("reports.export", { when: { op: "eq", field: "plan.tier", value: "free" } })],
});

describe("types", () => {
	test("ability names cover leaves, groups and *", () => {
		expectTypeOf<AbilityName<typeof CATALOG>>().toEqualTypeOf<
			| "*"
			| "article"
			| "article.read"
			| "article.update"
			| "team"
			| "team.invite"
			| "reports"
			| "reports.export"
		>();

		// @ts-expect-error -- a name the catalog lacks does not compile in a policy
		definePolicy(CATALOG, { roles: { member: [allow("article.publish")] } });
		// @ts-expect-error -- inherits names only roles of the policy
		definePolicy(CATALOG, { roles: { editor: { inherits: ["ghost"], grants: [] } } });
		expect(true).toBe(true);
	});

	test("context() takes every key exactly once", () => {
		// @ts-expect-error -- a key of the context left out
		context<{ team: string; invitee: string }>("team");
		// @ts-expect-error -- a key the context does not have
		context<{ team: string }>("org");
		expect(true).toBe(true);
	});

	test("checks are typed from the ability", () => {
		let access = unwrap(POLICY.for({ roles: ["member"] }));
		let article: Article = { id: "a1", publishedAt: null };

		access.can(CATALOG.article.read, { article });
		access.can(CATALOG.article.update, { article }, "title");
		access.can(CATALOG.reports.export);
		// @ts-expect-error -- a contextual ability needs its context
		access.can(CATALOG.article.read);
		// @ts-expect-error -- a field the ability does not declare
		access.can(CATALOG.article.update, { article }, "slug");
		// @ts-expect-error -- the context of another ability
		access.can(CATALOG.team.invite, { article });

		expectTypeOf(access.permittedFields(CATALOG.article.update, { article })).toEqualTypeOf<
			("title" | "body")[]
		>();
		expect(true).toBe(true);
	});

	test("bindings take the declared facts", () => {
		POLICY.for({ facts: { actor: undefined, plan: async () => ({ tier: "pro" }) } });
		// @ts-expect-error -- a required fact cannot be bound as absent
		POLICY.for({ facts: { plan: undefined as { tier: number } | undefined } });
		// @ts-expect-error -- a fact of the wrong type
		POLICY.for({ facts: { plan: { tier: 1 } } });
		expect(true).toBe(true);
	});

	test("decision maps carry a boolean per ability", () => {
		let access = unwrap(POLICY.for({ roles: [] }));

		expectTypeOf(
			access.decide(CATALOG.article, { article: { id: "a", publishedAt: null } }),
		).toEqualTypeOf<Decisions<typeof CATALOG.article>>();
		expectTypeOf<Decisions<typeof CATALOG.article>>().toEqualTypeOf<{
			readonly read: boolean;
			readonly update: boolean;
		}>();
		expectTypeOf<Claims<typeof CATALOG>>().toEqualTypeOf<{
			readonly article: Claims<typeof CATALOG.article>;
			readonly team: Claims<typeof CATALOG.team>;
			readonly reports: { readonly export: boolean };
		}>();
		// @ts-expect-error -- decide needs every key the group's abilities need
		access.decide(CATALOG.team, { team: { id: "t" } });
		expect(true).toBe(true);
	});
});
