/**
 * Unit tests for the `Grant` data-access model: recording consent idempotently,
 * listing a subject's grants with their clients, counting a client's grants, and the
 * three deletions that withdraw consent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import Client from "~/app/data/client";
import Grant from "~/app/data/grant";
import Subject from "~/app/data/subject";
import { createTestDatabase } from "~/app/lib/test/db";
import { grants } from "~/database/schema";

let db: Database;
let subjectId: string;
let clientId: string;
let otherClientId: string;

beforeEach(async () => {
	db = createTestDatabase().db;

	let subject = await Subject.create(db, {
		email_address: "jane@example.com",
		display_name: "Jane Doe",
		username: "jane",
		avatar: "https://example.com/jane.png",
	});
	subjectId = subject.id;

	let client = await Client.create(db, {
		name: "Blog",
		redirect_uri: "https://blog.example.com/auth/callback",
		logout_uri: "https://blog.example.com/logout",
	});
	clientId = client.id;

	let other = await Client.create(db, {
		name: "Uptime",
		redirect_uri: "https://uptime.example.com/auth/callback",
		logout_uri: "https://uptime.example.com/logout",
	});
	otherClientId = other.id;
});

describe("Grant.findOrCreate", () => {
	test("records consent on first authorization", async () => {
		let grant = await Grant.findOrCreate(db, subjectId, clientId);

		expect(grant.subject_id).toBe(subjectId);
		expect(grant.client_id).toBe(clientId);
	});

	test("returns the same grant on every later authorization", async () => {
		let first = await Grant.findOrCreate(db, subjectId, clientId);
		let second = await Grant.findOrCreate(db, subjectId, clientId);

		expect(second.id).toBe(first.id);
		expect(await db.count(grants)).toBe(1);
	});
});

describe("Grant.findBySubjectId", () => {
	test("lists the subject's grants with their clients, oldest consent first", async () => {
		let first = await Grant.findOrCreate(db, subjectId, clientId);
		let second = await Grant.findOrCreate(db, subjectId, otherClientId);

		await db.update(grants, first.id, { created_at: 1_000 });
		await db.update(grants, second.id, { created_at: 2_000 });

		let list = await Grant.findBySubjectId(db, subjectId);

		expect(list.map((grant) => grant.client?.name)).toEqual(["Blog", "Uptime"]);
	});
});

describe("Grant.countByClientId", () => {
	test("counts the subjects that authorized one client", async () => {
		await Grant.findOrCreate(db, subjectId, clientId);
		await Grant.findOrCreate(db, subjectId, otherClientId);

		expect(await Grant.countByClientId(db, clientId)).toBe(1);
		expect(await Grant.countByClientId(db, "unknown")).toBe(0);
	});
});

describe("Grant deletion", () => {
	test("deleteBySubjectId withdraws every consent the subject gave", async () => {
		await Grant.findOrCreate(db, subjectId, clientId);
		await Grant.findOrCreate(db, subjectId, otherClientId);

		expect(await Grant.deleteBySubjectId(db, subjectId)).toBe(2);
		expect(await Grant.findBySubjectId(db, subjectId)).toHaveLength(0);
	});

	test("deleteByClientId withdraws every consent given to one client", async () => {
		await Grant.findOrCreate(db, subjectId, clientId);
		await Grant.findOrCreate(db, subjectId, otherClientId);

		expect(await Grant.deleteByClientId(db, clientId)).toBe(1);
		expect((await Grant.findBySubjectId(db, subjectId)).map((grant) => grant.client_id)).toEqual([
			otherClientId,
		]);
	});

	test("deleteBySubjectAndClient withdraws exactly one consent", async () => {
		await Grant.findOrCreate(db, subjectId, clientId);
		await Grant.findOrCreate(db, subjectId, otherClientId);

		expect(await Grant.deleteBySubjectAndClient(db, subjectId, clientId)).toBe(1);
		expect(await Grant.countByClientId(db, otherClientId)).toBe(1);
	});
});
