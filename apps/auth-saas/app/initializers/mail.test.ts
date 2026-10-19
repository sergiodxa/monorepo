/**
 * The email registry: every declared email has a template mapped, so a send never fails for
 * an email declared but nothing maps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyEmailDeclaration } from "@sdxc/mail";

import { isEmailDeclaration } from "@sdxc/mail";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

/** Every declaration in the map, walking its groups. */
function declared(tree: object): AnyEmailDeclaration[] {
	return Object.values(tree).flatMap((value: object) =>
		isEmailDeclaration(value) ? [value] : declared(value),
	);
}

describe("mail", () => {
	test("maps a template for every declared email", () => {
		let names = declared(emails).map((email) => email.name);

		expect(mail.mapped.map((email) => email.name).sort()).toEqual(names.sort());
	});
});
