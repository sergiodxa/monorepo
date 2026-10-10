/**
 * Tests for the grants model: recording consent idempotently, listing a subject's grants
 * with their clients, counting a client's grants, and the three deletions that withdraw
 * consent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { AuthModels } from "~/app/models";

import { createTestModels } from "~/app/lib/test/models";
import { grants } from "~/database/schema";

let db: Database;
let models: AuthModels;
let subjectId: string;
let clientId: string;
let otherClientId: string;

beforeEach(async () => {
	({ db, models } = createTestModels());

	let subject = unwrap(
		await models.subjects.create({
			email_address: "jane@example.com",
			display_name: "Jane Doe",
			username: "jane",
			avatar: "https://example.com/jane.png",
		}),
	);
	subjectId = subject.id;

	let client = unwrap(
		await models.clients.create({
			name: "Blog",
			redirect_uri: "https://blog.example.com/auth/callback",
			logout_uri: "https://blog.example.com/logout",
		}),
	);
	clientId = client.id;

	let other = unwrap(
		await models.clients.create({
			name: "Uptime",
			redirect_uri: "https://uptime.example.com/auth/callback",
			logout_uri: "https://uptime.example.com/logout",
		}),
	);
	otherClientId = other.id;
});

/** Records the test subject's consent for a client. */
async function consent(forClientId: string) {
	return unwrap(await models.grants.findOrCreate(subjectId, forClientId));
}

describe("grants.findOrCreate", () => {
	test("records consent on first authorization", async () => {
		let grant = await consent(clientId);

		expect(grant.subject_id).toBe(subjectId);
		expect(grant.client_id).toBe(clientId);
	});

	test("returns the same grant on every later authorization", async () => {
		let first = await consent(clientId);
		let second = await consent(clientId);

		expect(second.id).toBe(first.id);
		expect(await models.grants.query().count()).toBe(1);
	});
});

describe("grants.hasConsented", () => {
	test("answers for one subject and one client, until consent is withdrawn", async () => {
		await consent(clientId);

		expect(await models.grants.hasConsented(subjectId, clientId)).toBe(true);
		expect(await models.grants.hasConsented(subjectId, otherClientId)).toBe(false);

		await models.grants.deleteBySubjectAndClient(subjectId, clientId);

		expect(await models.grants.hasConsented(subjectId, clientId)).toBe(false);
	});
});

describe("grants.findBySubjectId", () => {
	test("lists the subject's grants with their clients, oldest consent first", async () => {
		let first = await consent(clientId);
		let second = await consent(otherClientId);

		await db.update(grants, first.id, { created_at: 1_000 });
		await db.update(grants, second.id, { created_at: 2_000 });

		let list = await models.grants.findBySubjectId(subjectId);

		expect(list.map((grant) => grant.client?.name)).toEqual(["Blog", "Uptime"]);
	});
});

describe("grants.countByClientId", () => {
	test("counts the subjects that authorized one client", async () => {
		await consent(clientId);
		await consent(otherClientId);

		expect(await models.grants.countByClientId(clientId)).toBe(1);
		expect(await models.grants.countByClientId("unknown")).toBe(0);
	});
});

describe("grants deletion", () => {
	test("deleteBySubjectId withdraws every consent the subject gave", async () => {
		await consent(clientId);
		await consent(otherClientId);

		expect(await models.grants.deleteBySubjectId(subjectId)).toBe(2);
		expect(await models.grants.findBySubjectId(subjectId)).toHaveLength(0);
	});

	test("deleteByClientId withdraws every consent given to one client", async () => {
		await consent(clientId);
		await consent(otherClientId);

		expect(await models.grants.deleteByClientId(clientId)).toBe(1);
		expect(
			(await models.grants.findBySubjectId(subjectId)).map((grant) => grant.client_id),
		).toEqual([otherClientId]);
	});

	test("deleteBySubjectAndClient withdraws exactly one consent", async () => {
		await consent(clientId);
		await consent(otherClientId);

		expect(await models.grants.deleteBySubjectAndClient(subjectId, clientId)).toBe(1);
		expect(await models.grants.countByClientId(otherClientId)).toBe(1);
	});
});
