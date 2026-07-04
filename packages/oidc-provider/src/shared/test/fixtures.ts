import type { Database } from "remix/data-table";

import Client from "../../clients/models/client";
import RedirectUri from "../../clients/models/redirect-uri";
import ClientSecret from "../../clients/models/secret";
import Grant from "../../oauth/models/grant";
import Session from "../../oauth/models/session";
import Resource from "../../resources/models/resource";
import Subject from "../../subjects/models/subject";
import Passkey from "../../webauthn/models/passkey";

/**
 * Creates a test subject with optional overrides
 */
export async function createSubject(
	db: Database,
	overrides: { email?: string; username?: string; verified?: boolean } = {},
) {
	let email = overrides.email ?? `test-${crypto.randomUUID()}@example.com`;
	let username = overrides.username ?? `user-${crypto.randomUUID().slice(0, 8)}`;

	let subject = await Subject.register(db, { email, username });

	if (overrides.verified) {
		await Subject.verifyEmail(db, subject.id);
		subject = (await Subject.show(db, subject.id))!;
	}

	return subject;
}

/**
 * Creates a test client with optional overrides
 */
export async function createClient(
	db: Database,
	overrides: {
		name?: string;
		type?: "public" | "confidential" | "m2m";
		isManagementClient?: boolean;
	} = {},
) {
	let name = overrides.name ?? `Test Client ${crypto.randomUUID().slice(0, 8)}`;
	let type = overrides.type ?? "confidential";

	// Client.create returns WriteResult, so we need to get the client after creation
	await Client.create(db, {
		name,
		type,
		description: "Test client",
		isManagementClient: overrides.isManagementClient ?? false,
	});

	// Get the most recently created client by name
	let clients = await Client.list(db);
	let client = clients.find((c) => c.name === name);
	if (!client) throw new Error("Failed to create client");

	return client;
}

/**
 * Creates a client with a secret and redirect URI for OAuth testing
 */
export async function createOAuthClient(
	db: Database,
	overrides: {
		name?: string;
		type?: "public" | "confidential";
		redirectUri?: string;
	} = {},
) {
	let client = await createClient(db, {
		name: overrides.name,
		type: overrides.type ?? "confidential",
	});

	let redirectUri = overrides.redirectUri ?? "https://example.com/callback";
	await RedirectUri.create(db, client.id, redirectUri);

	let secretResult =
		client.type === "confidential" ? await ClientSecret.create(db, client.id) : null;

	return {
		client,
		redirectUri,
		clientSecret: secretResult?.plainSecret ?? null,
	};
}

/**
 * Creates a management client with secret
 */
export async function createManagementClient(db: Database) {
	let client = await createClient(db, {
		name: "Management Client",
		type: "confidential",
		isManagementClient: true,
	});

	let { plainSecret } = await ClientSecret.create(db, client.id);

	return { client, clientSecret: plainSecret };
}

/**
 * Creates a test session for a subject and client
 */
export async function createSession(
	db: Database,
	options: {
		subjectId: string;
		clientId: string;
	},
) {
	return await Session.create(db, {
		subjectId: options.subjectId,
		clientId: options.clientId,
	});
}

/**
 * Creates a test passkey for a subject
 */
export async function createPasskey(
	db: Database,
	options: {
		subjectId: string;
		name?: string;
	},
) {
	return await Passkey.create(db, {
		subjectId: options.subjectId,
		credentialId: "test-credential-id-" + crypto.randomUUID(),
		publicKey: "test-public-key-" + crypto.randomUUID(),
		counter: 0,
		deviceType: "singleDevice",
		backedUp: false,
		transports: "internal",
		name: options.name ?? "Test Passkey",
	});
}

/**
 * Creates a test resource with scopes
 */
export async function createResource(
	db: Database,
	overrides: {
		identifier?: string;
		name?: string;
		scopes?: Array<{ name: string; description?: string }>;
	} = {},
) {
	let identifier =
		overrides.identifier ?? `https://api.example.com/${crypto.randomUUID().slice(0, 8)}`;
	let name = overrides.name ?? "Test Resource";

	await Resource.create(db, {
		identifier,
		name,
		description: "Test resource description",
		scopes: overrides.scopes ?? [{ name: "read" }, { name: "write" }],
	});

	// Get the resource by identifier
	let resource = await Resource.findByIdentifier(db, identifier);
	if (!resource) throw new Error("Failed to create resource");

	return resource;
}

/**
 * Creates a grant between a subject and client
 */
export async function createGrant(
	db: Database,
	options: {
		subjectId: string;
		clientId: string;
	},
) {
	return await Grant.findOrCreate(db, options.subjectId, options.clientId);
}
