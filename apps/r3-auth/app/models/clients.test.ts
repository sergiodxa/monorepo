/**
 * Tests for the clients model: registration with a generated secret, listing and counting,
 * edits with and without secret rotation, deletion, and the bootstrap of the authorization
 * server's own client registration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CreateValues } from "@sdxc/data-model";
import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { AuthModels } from "~/app/models";
import type { Clients } from "~/app/models/clients";

import { AUTH_SERVER_CLIENT_ID, AUTH_SERVER_NAME } from "~/app/config";
import { createTestModels } from "~/app/lib/test/models";
import { clients } from "~/database/schema";

let db: Database;
let models: AuthModels;

beforeEach(() => {
	({ db, models } = createTestModels());
});

/** Registers a client whose unique `redirect_uri` a test can vary. */
async function createClient(overrides: Partial<CreateValues<typeof Clients>> = {}) {
	return unwrap(
		await models.clients.create({
			name: "Blog",
			redirect_uri: "https://blog.example.com/auth/callback",
			logout_uri: "https://blog.example.com/logout",
			...overrides,
		}),
	);
}

describe("clients.create", () => {
	test("generates a secret and returns the stored row", async () => {
		let client = await createClient({ description: "The blog", logo_url: null });

		expect(client.id).toBeTypeOf("string");
		expect(client.secret).toBeTypeOf("string");
		expect(client.secret).not.toBe("");
		expect(client.name).toBe("Blog");
		expect(client.description).toBe("The blog");
		expect(client.created_at).toBeTypeOf("number");
	});

	test("gives every client its own secret", async () => {
		let first = await createClient();
		let second = await createClient({ redirect_uri: "https://other.example.com/callback" });

		expect(first.secret).not.toBe(second.secret);
	});

	test('defaults the logout-session-required flags to the string "false"', async () => {
		let client = await createClient();

		expect(client.backchannel_logout_session_required).toBe("false");
		expect(client.frontchannel_logout_session_required).toBe("false");
	});
});

describe("clients.findByLogoutUri", () => {
	test("matches the registered address exactly, oldest registration first", async () => {
		let older = await createClient({ redirect_uri: "https://a.example.com/cb" });
		let newer = await createClient({ redirect_uri: "https://b.example.com/cb" });
		await db.update(clients, older.id, { created_at: 1_000 });
		await db.update(clients, newer.id, { created_at: 2_000 });

		expect((await models.clients.findByLogoutUri("https://blog.example.com/logout"))?.id).toBe(
			older.id,
		);
		expect(await models.clients.findByLogoutUri("https://blog.example.com/logout/")).toBeNull();
	});
});

describe("clients.page", () => {
	test("lists clients newest first and pages through them", async () => {
		let first = await createClient({ name: "First", redirect_uri: "https://a.example.com/cb" });
		let second = await createClient({ name: "Second", redirect_uri: "https://b.example.com/cb" });
		let third = await createClient({ name: "Third", redirect_uri: "https://c.example.com/cb" });

		await db.update(clients, first.id, { created_at: 1_000 });
		await db.update(clients, second.id, { created_at: 2_000 });
		await db.update(clients, third.id, { created_at: 3_000 });

		let page = await models.clients.page({ limit: 2, offset: 0 });
		let rest = await models.clients.page({ limit: 2, offset: 2 });

		expect(page.map((client) => client.name)).toEqual(["Third", "Second"]);
		expect(rest.map((client) => client.name)).toEqual(["First"]);
	});
});

describe("clients count", () => {
	test("counts every registered client", async () => {
		expect(await models.clients.query().count()).toBe(0);
		await createClient();
		expect(await models.clients.query().count()).toBe(1);
	});
});

describe("clients.edit", () => {
	test("applies changes and leaves the secret alone", async () => {
		let client = await createClient();
		let updated = unwrap(await models.clients.edit(client.id, { name: "Renamed" }));

		expect(updated.name).toBe("Renamed");
		expect(updated.secret).toBe(client.secret);
		expect(updated.newSecret).toBeUndefined();
	});

	test("rotates the secret and reports the new one once when asked", async () => {
		let client = await createClient();
		let updated = unwrap(await models.clients.edit(client.id, { regenerateSecret: true }));

		expect(updated.newSecret).toBeTypeOf("string");
		expect(updated.secret).toBe(updated.newSecret as string);
		expect(updated.secret).not.toBe(client.secret);
	});

	test("stores the back- and front-channel logout settings", async () => {
		let client = await createClient();
		let updated = unwrap(
			await models.clients.edit(client.id, {
				backchannel_logout_uri: "https://blog.example.com/backchannel",
				backchannel_logout_session_required: "true",
				frontchannel_logout_uri: "https://blog.example.com/frontchannel",
				frontchannel_logout_session_required: "true",
			}),
		);

		expect(updated.backchannel_logout_uri).toBe("https://blog.example.com/backchannel");
		expect(updated.backchannel_logout_session_required).toBe("true");
		expect(updated.frontchannel_logout_uri).toBe("https://blog.example.com/frontchannel");
		expect(updated.frontchannel_logout_session_required).toBe("true");
	});
});

describe("clients.delete", () => {
	test("removes the client", async () => {
		let client = await createClient();
		unwrap(await models.clients.delete(client.id));
		expect(await models.clients.find(client.id)).toBeNull();
	});
});

describe("clients.ensureAuthServerClient", () => {
	test("creates the registration from the request origin on first use", async () => {
		let client = unwrap(
			await models.clients.ensureAuthServerClient(new URL("http://localhost:3002/authorize")),
		);

		expect(client.id).toBe(AUTH_SERVER_CLIENT_ID);
		expect(client.name).toBe(AUTH_SERVER_NAME);
		expect(client.redirect_uri).toBe("http://localhost:3002/auth/callback");
		expect(client.logout_uri).toBe("http://localhost:3002/authorize");
	});

	test("never rewrites an existing registration, whatever origin asks for it", async () => {
		let created = unwrap(
			await models.clients.ensureAuthServerClient(new URL("http://localhost:3002/authorize")),
		);

		let again = unwrap(
			await models.clients.ensureAuthServerClient(
				new URL("https://elsewhere.example.com/authorize"),
			),
		);

		expect(again.redirect_uri).toBe("http://localhost:3002/auth/callback");
		expect(again.secret).toBe(created.secret);
		expect(await models.clients.query().count()).toBe(1);
	});
});
