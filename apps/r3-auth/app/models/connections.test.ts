/**
 * Tests for the connections model: linking a provider identity to a subject on first
 * sign-in, resolving that identity again on later sign-ins, and listing a subject's links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { AuthModels } from "~/app/models";

import { createTestModels } from "~/app/lib/test/models";

let models: AuthModels;
let subjectId: string;

beforeEach(async () => {
	models = createTestModels().models;
	let subject = unwrap(
		await models.subjects.create({
			email_address: "jane@example.com",
			display_name: "Jane Doe",
			username: "jane",
			avatar: "https://example.com/jane.png",
		}),
	);
	subjectId = subject.id;
});

/** Links a provider identity to the test's subject. */
function link(provider: string, externalId: string) {
	return models.connections.create({ provider, external_id: externalId, subject_id: subjectId });
}

describe("connections.create", () => {
	test("links the provider identity to the subject", async () => {
		let connection = unwrap(await link("github", "12345"));

		expect(connection.provider).toBe("github");
		expect(connection.external_id).toBe("12345");
		expect(connection.subject_id).toBe(subjectId);
	});

	test("refuses to link the same provider identity twice", async () => {
		unwrap(await link("github", "12345"));
		expect(isFailure(await link("github", "12345"))).toBe(true);
	});
});

describe("connections.findByIdentity", () => {
	test("resolves a returning provider identity to its connection", async () => {
		unwrap(await link("github", "12345"));
		let found = await models.connections.findByIdentity("github", "12345");
		expect(found?.subject_id).toBe(subjectId);
	});

	test("keys on the provider as well as the external id", async () => {
		unwrap(await link("github", "12345"));
		expect(await models.connections.findByIdentity("gitlab", "12345")).toBeNull();
	});

	test("returns null for an identity that has never signed in", async () => {
		expect(await models.connections.findByIdentity("github", "unknown")).toBeNull();
	});
});

describe("connections.findBySubjectId", () => {
	test("lists the subject's links oldest first", async () => {
		let first = unwrap(await link("github", "1"));
		let second = unwrap(await link("gitlab", "2"));
		await models.connections.query().where({ id: first.id }).update({ created_at: 1_000 });
		await models.connections.query().where({ id: second.id }).update({ created_at: 2_000 });

		let links = await models.connections.findBySubjectId(subjectId);

		expect(links.map((connection) => connection.provider)).toEqual(["github", "gitlab"]);
	});
});
