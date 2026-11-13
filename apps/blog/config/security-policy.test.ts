/**
 * Holds the Content-Security-Policy to the origins the blog's pages load from, so a page
 * that draws from a new host fails here before its requests turn into violation reports
 * or, once the policy is enforced, into blank images.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { CONTENT_SECURITY_POLICY } from "./security-policy";

describe("CONTENT_SECURITY_POLICY", () => {
	test("loads sponsor pictures from GitHub's avatar host", () => {
		expect(CONTENT_SECURITY_POLICY.imgSrc).toContain("https://avatars.githubusercontent.com");
	});
});
