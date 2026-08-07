/**
 * Router-level tests for the four client-administration pages: the paginated listing,
 * registration with its one-time secret reveal, the detail page (which must never show
 * an existing secret), the editor including both logout channels, and both delete
 * intents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Client from "~/app/data/client";
import Grant from "~/app/data/grant";
import Subject from "~/app/data/subject";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/** Promotes the seeded subject and signs the client in as them. */
async function signInAsAdmin(): Promise<void> {
	await Subject.update(app.db, fixtures.subjectId, { role: "admin" });
	await signIn(app, fixtures);
}

/** Fetches an admin URL without following redirects. */
async function get(path: string): Promise<Response> {
	return await app.fetch(new Request(`${ORIGIN}${path}`, { redirect: "manual" }));
}

/** Posts a form to an admin URL without following redirects. */
async function post(path: string, body: Record<string, string>): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${path}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			redirect: "manual",
			body: new URLSearchParams(body),
		}),
	);
}

/** A complete, valid client registration payload. */
const VALID_CLIENT = {
	name: "Third Party",
	description: "A brand new relying party",
	logoUrl: "https://third.example.com/logo.png",
	redirectUri: "https://third.example.com/callback",
	logoutUri: "https://third.example.com/logout",
};

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
	await signInAsAdmin();
});

describe("GET /admin/clients", () => {
	test("lists the registered clients with their redirect URIs", async () => {
		let response = await get(routes.admin.clients.index.href());
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Client App");
		expect(html).toContain("https://client.example.com/callback");
		expect(html).toContain(routes.admin.client.index.href({ clientId: fixtures.clientId }));
	});

	test("never renders a client secret", async () => {
		let html = await (await get(routes.admin.clients.index.href())).text();

		expect(html).not.toContain(fixtures.clientSecret);
	});

	test("shows no pagination control while everything fits on one page", async () => {
		let html = await (await get(routes.admin.clients.index.href())).text();

		expect(html).not.toContain('data-slot="pagination"');
	});

	test("paginates at ten rows and page two shows the rest", async () => {
		// Eleven clients in total with the seeded one, so the second page holds exactly one.
		for (let index = 0; index < 10; index++) {
			await Client.create(app.db, {
				name: `Filler ${index}`,
				redirect_uri: `https://filler-${index}.example.com/callback`,
				logout_uri: `https://filler-${index}.example.com/logout`,
			});
		}

		let first = await (await get(routes.admin.clients.index.href())).text();
		expect(first).toContain('data-slot="pagination"');
		expect(first).toContain("?page=2");

		let second = await (await get(`${routes.admin.clients.index.href()}?page=2`)).text();
		// Newest first, so the seeded client is the last row and lands alone on page two.
		expect(second).toContain("Client App");
		expect(second).not.toContain("Filler 9");
	});

	test("treats a nonsense page number as page one rather than failing", async () => {
		let response = await get(`${routes.admin.clients.index.href()}?page=not-a-number`);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Client App");
	});

	test("renders an empty state when nothing is registered", async () => {
		await Client.delete(app.db, fixtures.clientId);

		let html = await (await get(routes.admin.clients.index.href())).text();

		expect(html).toContain("No clients found");
	});
});

describe("POST /admin/clients", () => {
	test("intent=delete removes the client and its grants, then redirects to the list", async () => {
		await Grant.findOrCreate(app.db, fixtures.subjectId, fixtures.clientId);

		let response = await post(routes.admin.clients.action.href(), {
			intent: "delete",
			clientId: fixtures.clientId,
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.admin.clients.index.href());
		expect(await Client.findById(app.db, fixtures.clientId)).toBeNull();
		expect(await Grant.countByClientId(app.db, fixtures.clientId)).toBe(0);
	});

	test("an unknown intent is refused and deletes nothing", async () => {
		let response = await post(routes.admin.clients.action.href(), {
			intent: "drop-everything",
			clientId: fixtures.clientId,
		});

		expect(response.status).toBe(400);
		expect(await Client.findById(app.db, fixtures.clientId)).not.toBeNull();
	});

	test("a delete with no client id is refused", async () => {
		let response = await post(routes.admin.clients.action.href(), { intent: "delete" });

		expect(response.status).toBe(400);
		expect(await Client.findById(app.db, fixtures.clientId)).not.toBeNull();
	});
});

describe("/admin/clients/new", () => {
	test("GET renders the registration form", async () => {
		let response = await get(routes.admin.clientNew.index.href());
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('name="redirectUri"');
		expect(html).toContain('name="logoutUri"');
	});

	test("POST registers the client and reveals its secret exactly once", async () => {
		let response = await post(routes.admin.clientNew.action.href(), VALID_CLIENT);
		let html = await response.text();

		expect(response.status).toBe(200);

		let created = await Client.findAll(app.db, { limit: 1, offset: 0 });
		let client = created[0]!;
		expect(client.name).toBe(VALID_CLIENT.name);
		expect(client.redirect_uri).toBe(VALID_CLIENT.redirectUri);

		// The generated secret is on this page and nowhere else afterwards.
		expect(html).toContain(client.secret);
		expect(html).toContain("Copy this secret now");

		let detail = await (await get(routes.admin.client.index.href({ clientId: client.id }))).text();
		expect(detail).not.toContain(client.secret);
	});

	test("POST accepts an empty logo URL and stores it as absent", async () => {
		await post(routes.admin.clientNew.action.href(), { ...VALID_CLIENT, logoUrl: "" });

		let client = (await Client.findAll(app.db, { limit: 1, offset: 0 }))[0]!;
		expect(client.logo_url).toBeNull();
	});

	test("POST re-renders the form with a 400 when a URI is not a URL", async () => {
		let before = await Client.count(app.db);

		let response = await post(routes.admin.clientNew.action.href(), {
			...VALID_CLIENT,
			redirectUri: "not-a-url",
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain('name="redirectUri"');
		expect(await Client.count(app.db)).toBe(before);
	});

	test("a failed submission shows the offending field its own message", async () => {
		let response = await post(routes.admin.clientNew.action.href(), {
			...VALID_CLIENT,
			redirectUri: "not-a-url",
		});
		let html = await response.text();

		// The form component takes the raw issue list, but a field renders only the
		// message handed to it — so the visible text is what proves the wiring.
		expect(html).toContain('aria-invalid="true"');
		expect(html).toMatch(/Invalid URL|url/i);
	});

	test("POST refuses a description longer than 280 characters", async () => {
		let before = await Client.count(app.db);

		let response = await post(routes.admin.clientNew.action.href(), {
			...VALID_CLIENT,
			description: "x".repeat(281),
		});

		expect(response.status).toBe(400);
		expect(await Client.count(app.db)).toBe(before);
	});
});

describe("GET /admin/clients/:clientId", () => {
	test("renders the registration, the grant count, and no secret", async () => {
		await Grant.findOrCreate(app.db, fixtures.subjectId, fixtures.clientId);

		let response = await get(routes.admin.client.index.href({ clientId: fixtures.clientId }));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain(fixtures.clientId);
		expect(html).toContain("https://client.example.com/callback");
		expect(html).toContain("Authorized Users");
		expect(html).toContain("Hidden for security");
		expect(html).not.toContain(fixtures.clientSecret);
	});

	test("answers 404 for a client that does not exist", async () => {
		let response = await get(
			routes.admin.client.index.href({ clientId: "00000000-0000-0000-0000-000000000000" }),
		);

		expect(response.status).toBe(404);
	});
});

describe("POST /admin/clients/:clientId", () => {
	test("intent=delete removes the client and its grants", async () => {
		await Grant.findOrCreate(app.db, fixtures.subjectId, fixtures.clientId);

		let response = await post(routes.admin.client.action.href({ clientId: fixtures.clientId }), {
			intent: "delete",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.admin.clients.index.href());
		expect(await Client.findById(app.db, fixtures.clientId)).toBeNull();
		expect(await Grant.countByClientId(app.db, fixtures.clientId)).toBe(0);
	});

	test("an unknown intent is refused and the client survives", async () => {
		let response = await post(routes.admin.client.action.href({ clientId: fixtures.clientId }), {
			intent: "rotate",
		});

		expect(response.status).toBe(400);
		expect(await Client.findById(app.db, fixtures.clientId)).not.toBeNull();
	});
});

describe("/admin/clients/:clientId/edit", () => {
	test("GET fills the form from the stored row without exposing the secret", async () => {
		let response = await get(routes.admin.clientEdit.index.href({ clientId: fixtures.clientId }));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('value="https://client.example.com/callback"');
		expect(html).toContain('name="backchannelLogoutUri"');
		expect(html).toContain('name="frontchannelLogoutUri"');
		expect(html).not.toContain(fixtures.clientSecret);
	});

	test("POST persists the edit and redirects to the detail page", async () => {
		let response = await post(
			routes.admin.clientEdit.action.href({ clientId: fixtures.clientId }),
			{
				name: "Renamed App",
				description: "Now with a description",
				logoUrl: "",
				redirectUri: "https://renamed.example.com/callback",
				logoutUri: "https://renamed.example.com/logout",
				backchannelLogoutUri: "https://renamed.example.com/backchannel",
				frontchannelLogoutUri: "https://renamed.example.com/frontchannel",
			},
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			routes.admin.client.index.href({ clientId: fixtures.clientId }),
		);

		let client = await Client.findById(app.db, fixtures.clientId);
		expect(client?.name).toBe("Renamed App");
		expect(client?.redirect_uri).toBe("https://renamed.example.com/callback");
		expect(client?.backchannel_logout_uri).toBe("https://renamed.example.com/backchannel");
		expect(client?.logo_url).toBeNull();
		// The secret is untouched by an edit that did not ask for a rotation.
		expect(client?.secret).toBe(fixtures.clientSecret);
	});

	test("the session-required flags round trip as the text 'true' and 'false'", async () => {
		await post(routes.admin.clientEdit.action.href({ clientId: fixtures.clientId }), {
			name: "Client App",
			redirectUri: "https://client.example.com/callback",
			logoutUri: "https://client.example.com/logout",
			backchannelLogoutUri: "https://client.example.com/backchannel",
			backchannelLogoutSessionRequired: "on",
			frontchannelLogoutUri: "https://client.example.com/frontchannel",
		});

		let client = await Client.findById(app.db, fixtures.clientId);
		// The columns are text, not booleans, and the fan-out compares against these
		// exact strings — a boolean here would silently stop sending `sid`.
		expect(client?.backchannel_logout_session_required).toBe("true");
		expect(client?.frontchannel_logout_session_required).toBe("false");

		let form = await (
			await get(routes.admin.clientEdit.index.href({ clientId: fixtures.clientId }))
		).text();
		expect(form).toContain('name="backchannelLogoutSessionRequired"');

		// Unticking sends the box's name not at all, which has to read back as "false".
		await post(routes.admin.clientEdit.action.href({ clientId: fixtures.clientId }), {
			name: "Client App",
			redirectUri: "https://client.example.com/callback",
			logoutUri: "https://client.example.com/logout",
			backchannelLogoutUri: "https://client.example.com/backchannel",
			frontchannelLogoutUri: "https://client.example.com/frontchannel",
			frontchannelLogoutSessionRequired: "on",
		});

		let after = await Client.findById(app.db, fixtures.clientId);
		expect(after?.backchannel_logout_session_required).toBe("false");
		expect(after?.frontchannel_logout_session_required).toBe("true");
	});

	test("POST with regenerateSecret rotates the secret and reveals the new one once", async () => {
		let response = await post(
			routes.admin.clientEdit.action.href({ clientId: fixtures.clientId }),
			{
				name: "Client App",
				redirectUri: "https://client.example.com/callback",
				logoutUri: "https://client.example.com/logout",
				regenerateSecret: "on",
			},
		);

		expect(response.status).toBe(200);

		let client = await Client.findById(app.db, fixtures.clientId);
		expect(client?.secret).not.toBe(fixtures.clientSecret);

		let html = await response.text();
		expect(html).toContain(client!.secret);
		expect(html).not.toContain(fixtures.clientSecret);
	});

	test("POST re-renders with a 400 and changes nothing when the name is empty", async () => {
		let response = await post(
			routes.admin.clientEdit.action.href({ clientId: fixtures.clientId }),
			{
				name: "",
				redirectUri: "https://client.example.com/callback",
				logoutUri: "https://client.example.com/logout",
			},
		);

		expect(response.status).toBe(400);
		expect((await Client.findById(app.db, fixtures.clientId))?.name).toBe("Client App");
	});

	test("GET answers 404 for a client that does not exist", async () => {
		let response = await get(
			routes.admin.clientEdit.index.href({ clientId: "00000000-0000-0000-0000-000000000000" }),
		);

		expect(response.status).toBe(404);
	});
});
