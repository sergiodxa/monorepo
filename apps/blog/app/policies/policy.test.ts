/**
 * The blog's authorization as a table of cases: anyone reads a published post, and only an
 * admin opens the CMS, reads a draft or links a search to a topic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { testAccess } from "@sdxc/authz/testing";
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import abilities from "~/app/policies/abilities";
import policy from "~/app/policies/policy";

describe("the blog's policy", () => {
	test("compiles", () => {
		expect(isSuccess(policy.compile())).toBe(true);
	});

	test.each([
		["an anonymous reader", []],
		["a signed-in guest", ["guest"]],
	])("lets %s read only published posts and nothing else", (_, roles) => {
		let reader = testAccess(policy, { roles });

		expect(reader.can(abilities.posts.read, { post: { published: true } })).toBe(true);
		expect(reader.can(abilities.posts.read, { post: { published: false } })).toBe(false);
		expect(reader.can(abilities.cms.open)).toBe(false);
		expect(reader.can(abilities.search.linkTopics)).toBe(false);
	});

	test("lets an admin open the CMS, read drafts and link searches", () => {
		let admin = testAccess(policy, { roles: ["admin"] });

		expect(admin.can(abilities.cms.open)).toBe(true);
		expect(admin.can(abilities.posts.read, { post: { published: false } })).toBe(true);
		expect(admin.can(abilities.search.linkTopics)).toBe(true);
	});
});
