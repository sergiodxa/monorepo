/**
 * Client service for the dashboard to manage a tenant's data through its Durable
 * Object Management API. Issues signed internal tokens, performs validated JSON
 * requests, and exposes typed CRUD methods for clients, secrets, redirect/logout URIs,
 * users, sessions, resources, branding, passkeys, grants, connections, and signing keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { createInternalToken } from "@pkg/oidc-provider";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

/** Schema for tenant statistics. */
const TenantStatsSchema = s.object({
	total_users: s.number(),
	total_clients: s.number(),
	total_sessions: s.number(),
	active_sessions: s.number(),
	monthly_active_users: s.number(),
});

/** Schema for OAuth client. */
const ClientSchema = s.object({
	id: s.string(),
	name: s.string(),
	description: s.nullable(s.string()),
	logo_url: s.nullable(s.string()),
	type: s.union([s.literal("public"), s.literal("confidential"), s.literal("m2m")]),
	allowed_scopes: s.nullable(s.string()),
	allowed_resources: s.nullable(s.string()),
	is_management_client: s.union([s.boolean(), s.number()]),
	created_at: s.string(),
	updated_at: s.string(),
});

/** Schema for client secret metadata. */
const ClientSecretSchema = s.object({
	id: s.string(),
	name: s.nullable(s.string()),
	createdAt: s.string(),
	lastUsedAt: s.nullable(s.string()),
	expiresAt: s.nullable(s.string()),
});

/** Schema for redirect URI. */
const RedirectUriSchema = s.object({
	id: s.string(),
	client_id: s.string(),
	uri: s.string(),
	environment: s.nullable(s.string()),
	created_at: s.string(),
});

/** Schema for logout URI. */
const LogoutUriSchema = s.object({
	id: s.string(),
	client_id: s.string(),
	uri: s.string(),
	type: s.union([s.literal("post_logout"), s.literal("backchannel"), s.literal("frontchannel")]),
	session_required: s.union([s.boolean(), s.number()]),
	environment: s.nullable(s.string()),
	created_at: s.string(),
});

/** Schema for user (subject). */
const UserSchema = s.object({
	id: s.string(),
	email: s.string(),
	email_verified_at: s.nullable(s.string()),
	display_name: s.nullable(s.string()),
	username: s.string(),
	avatar_url: s.nullable(s.string()),
	role: s.union([s.literal("admin"), s.literal("user")]),
	created_at: s.string(),
	updated_at: s.string(),
});

/** Schema for user session (from API response). */
const SessionSchema = s.object({
	id: s.string(),
	client: s.nullable(
		s.object({
			id: s.string(),
			name: s.string(),
		}),
	),
	ip: s.nullable(s.string()),
	userAgent: s.nullable(s.string()),
	expiresAt: s.string(),
	createdAt: s.string(),
	updatedAt: s.string(),
});

/** Schema for resource scope. */
const ScopeSchema = s.object({
	name: s.string(),
	description: s.optional(s.string()),
});

/** Schema for API resource. */
const ResourceSchema = s.object({
	id: s.string(),
	identifier: s.string(),
	name: s.string(),
	description: s.nullable(s.string()),
	scopes: s.array(ScopeSchema),
	created_at: s.string(),
	updated_at: s.string(),
});

/** Schema for tenant branding configuration. */
const BrandingSchema = s.object({
	id: s.string(),
	logo_url: s.nullable(s.string()),
	primary_color: s.nullable(s.string()),
	background_color: s.nullable(s.string()),
	custom_css: s.nullable(s.string()),
	created_at: s.string(),
	updated_at: s.string(),
});

/** Schema for passkey credential (from API response). */
const PasskeySchema = s.object({
	id: s.string(),
	name: s.nullable(s.string()),
	deviceType: s.nullable(s.string()),
	backedUp: s.union([s.boolean(), s.number()]),
	transports: s.array(s.string()),
	lastUsedAt: s.nullable(s.string()),
	createdAt: s.string(),
});

/** Schema for OAuth grant (from API response). */
const GrantSchema = s.object({
	id: s.string(),
	client: s.nullable(
		s.object({
			id: s.string(),
			name: s.string(),
		}),
	),
	scopes: s.array(s.string()),
	createdAt: s.string(),
	updatedAt: s.string(),
});

/** Schema for social connection (from API response). */
const ConnectionSchema = s.object({
	id: s.string(),
	provider: s.string(),
	providerUserId: s.string(),
	createdAt: s.string(),
	updatedAt: s.string(),
});

/** Schema for JWT signing key (from API response - keys not exposed). */
const SigningKeySchema = s.object({
	id: s.string(),
	algorithm: s.string(),
	isCurrent: s.union([s.boolean(), s.number()]),
	createdAt: s.string(),
	expiresAt: s.nullable(s.string()),
});

/** Schema for ID response. */
const IdResponseSchema = s.object({ id: s.string() });

/** Schema for secret creation response. */
const SecretResponseSchema = s.object({ id: s.string(), secret: s.string() });

/** Schema for message response. */
const MessageResponseSchema = s.object({ message: s.string() });

/**
 * Builds the headers for one Management API call: the JSON content type plus the
 * signed internal token, over whatever the caller asked for. `HeadersInit` may be a
 * `Headers` or an array of pairs, so the caller's headers are merged through
 * `Headers` rather than spread — spreading either shape yields numeric index keys
 * and silently drops every header. The internal token is set last: it authenticates
 * the call and a caller must never be able to replace it.
 * @param internalToken Signed token proving the call came from the control plane.
 * @param headers Headers the caller passed alongside the request options.
 * @returns The merged header set to send.
 */
function managementHeaders(internalToken: string, headers?: HeadersInit): Headers {
	let merged = new Headers(headers);
	if (!merged.has("Content-Type")) merged.set("Content-Type", "application/json");
	merged.set("X-Internal-Token", internalToken);
	return merged;
}

/**
 * Service for communicating with tenant Durable Objects via their Management API.
 * Used by the dashboard to manage tenant data with signed internal tokens.
 *
 * @example
 * let api = new TenantApiService(tenantId);
 * let stats = await api.getStats();
 */
export class TenantApiService {
	/**
	 * Creates a new TenantApiService instance.
	 * @param tenantId - The tenant ID to communicate with.
	 */
	constructor(private tenantId: string) {}

	/** Gets the Durable Object stub for the tenant. */
	private get stub() {
		return env.TENANT.getByName(this.tenantId);
	}

	/**
	 * Makes an authenticated request to the tenant API with schema validation.
	 * @param path - API path.
	 * @param schema - Schema to validate the response against.
	 * @param options - Fetch options.
	 * @returns Validated response data.
	 * @throws {TenantApiError} When the API returns an error or validation fails.
	 */
	private async request<Input, Output>(
		path: string,
		schema: Schema<Input, Output>,
		options: RequestInit = {},
	): Promise<Output> {
		let url = `https://tenant.internal${path}`;
		let internalToken = await createInternalToken(env.INTERNAL_SECRET);

		let response = await this.stub.fetch(url, {
			...options,
			headers: managementHeaders(internalToken, options.headers),
		});

		if (!response.ok) {
			let error = await response.json().catch(() => ({ error: "Unknown error" }));
			let errorResult = s.parseSafe(s.object({ error: s.optional(s.string()) }), error);
			let errorMessage = errorResult.success
				? (errorResult.value.error ?? "Unknown error")
				: "Unknown error";
			throw new TenantApiError(response.status, errorMessage);
		}

		let data: unknown = await response.json();
		let result = s.parseSafe(schema, data);
		if (!result.success) {
			throw new TenantApiError(
				500,
				`Invalid API response: ${result.issues?.[0]?.message ?? "validation failed"}`,
			);
		}
		return result.value;
	}

	/**
	 * Makes an authenticated request that doesn't return a body.
	 * @param path - API path.
	 * @param options - Fetch options.
	 * @throws {TenantApiError} When the API returns an error.
	 */
	private async requestVoid(path: string, options: RequestInit = {}): Promise<void> {
		let url = `https://tenant.internal${path}`;
		let internalToken = await createInternalToken(env.INTERNAL_SECRET);

		let response = await this.stub.fetch(url, {
			...options,
			headers: managementHeaders(internalToken, options.headers),
		});

		if (!response.ok) {
			let error = await response.json().catch(() => ({ error: "Unknown error" }));
			let errorResult = s.parseSafe(s.object({ error: s.optional(s.string()) }), error);
			let errorMessage = errorResult.success
				? (errorResult.value.error ?? "Unknown error")
				: "Unknown error";
			throw new TenantApiError(response.status, errorMessage);
		}
	}

	/**
	 * Provisions tenant metadata on the Durable Object.
	 *
	 * Writes the tenant id, OIDC issuer (hostname without scheme), and region into
	 * the tenant's own storage. Call once at creation and again whenever the
	 * canonical hostname changes so the issuer tracks the hostname clients use.
	 * @param data - Provisioning values.
	 */
	async setup(data: { issuer: string; region?: string }): Promise<void> {
		await this.requestVoid("/api/setup", {
			method: "POST",
			body: JSON.stringify({ tenant_id: this.tenantId, ...data }),
		});
	}

	/**
	 * Pushes the tenant-runtime entitlement gate into the Durable Object.
	 *
	 * Sets or clears the DO's suspension flag so the tenant enforces it locally: a
	 * suspended tenant blocks its OIDC/OAuth2 provider surface even for traffic that
	 * reaches the DO directly via Cloudflare for SaaS `hostMetadata` (which bypasses the
	 * control-plane database). Call whenever billing entitlement or tenant status changes.
	 *
	 * @param suspended - `true` to suspend the tenant's provider surface, `false` to restore it.
	 * @example
	 * await new TenantApiService(tenantId).setSuspended(true);
	 */
	async setSuspended(suspended: boolean): Promise<void> {
		await this.requestVoid("/__control/suspend", {
			method: "POST",
			body: JSON.stringify({ suspended }),
		});
	}

	/** Gets tenant statistics. */
	async getStats(): Promise<TenantStats> {
		return this.request("/api/stats", TenantStatsSchema);
	}

	/** Lists all clients for the tenant. */
	async listClients(): Promise<Client[]> {
		return this.request("/api/clients", s.array(ClientSchema));
	}

	/**
	 * Gets a client by ID.
	 * @param id - The client ID.
	 * @returns The client or null if not found.
	 */
	async getClient(id: string): Promise<Client | null> {
		try {
			return await this.request(`/api/clients/${id}`, ClientSchema);
		} catch (error) {
			if (error instanceof TenantApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Creates a new client.
	 * @param data - Client creation data.
	 * @returns The created client ID.
	 */
	async createClient(data: CreateClientInput): Promise<{ id: string }> {
		return this.request("/api/clients", IdResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Updates a client.
	 * @param id - The client ID.
	 * @param data - Client update data.
	 * @returns The updated client.
	 */
	async updateClient(id: string, data: UpdateClientInput): Promise<Client> {
		return this.request(`/api/clients/${id}`, ClientSchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Deletes a client.
	 * @param id - The client ID.
	 */
	async deleteClient(id: string): Promise<void> {
		await this.requestVoid(`/api/clients/${id}`, { method: "DELETE" });
	}

	/**
	 * Lists all secrets for a client.
	 * @param clientId - The client ID.
	 */
	async listSecrets(clientId: string): Promise<ClientSecret[]> {
		return this.request(`/api/clients/${clientId}/secrets`, s.array(ClientSecretSchema));
	}

	/**
	 * Creates a new secret for a client.
	 * @param clientId - The client ID.
	 * @param data - Secret creation data.
	 * @returns The created secret ID and plaintext secret value.
	 */
	async createSecret(
		clientId: string,
		data: { name?: string; expiresAt?: string },
	): Promise<{ id: string; secret: string }> {
		return this.request(`/api/clients/${clientId}/secrets`, SecretResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Deletes a client secret.
	 * @param clientId - The client ID.
	 * @param secretId - The secret ID.
	 */
	async deleteSecret(clientId: string, secretId: string): Promise<void> {
		await this.requestVoid(`/api/clients/${clientId}/secrets/${secretId}`, {
			method: "DELETE",
		});
	}

	/**
	 * Lists all redirect URIs for a client.
	 * @param clientId - The client ID.
	 */
	async listRedirectUris(clientId: string): Promise<RedirectUri[]> {
		return this.request(`/api/clients/${clientId}/redirect-uris`, s.array(RedirectUriSchema));
	}

	/**
	 * Creates a new redirect URI for a client.
	 * @param clientId - The client ID.
	 * @param data - Redirect URI data.
	 * @returns The created redirect URI ID.
	 */
	async createRedirectUri(
		clientId: string,
		data: { uri: string; environment?: string },
	): Promise<{ id: string }> {
		return this.request(`/api/clients/${clientId}/redirect-uris`, IdResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Deletes a redirect URI.
	 * @param clientId - The client ID.
	 * @param uriId - The redirect URI ID.
	 */
	async deleteRedirectUri(clientId: string, uriId: string): Promise<void> {
		await this.requestVoid(`/api/clients/${clientId}/redirect-uris/${uriId}`, {
			method: "DELETE",
		});
	}

	/**
	 * Lists all logout URIs for a client.
	 * @param clientId - The client ID.
	 */
	async listLogoutUris(clientId: string): Promise<LogoutUri[]> {
		return this.request(`/api/clients/${clientId}/logout-uris`, s.array(LogoutUriSchema));
	}

	/**
	 * Creates a new logout URI for a client.
	 * @param clientId - The client ID.
	 * @param data - Logout URI data.
	 * @returns The created logout URI ID.
	 */
	async createLogoutUri(
		clientId: string,
		data: {
			uri: string;
			type: "post_logout" | "backchannel" | "frontchannel";
			environment?: string;
		},
	): Promise<{ id: string }> {
		return this.request(`/api/clients/${clientId}/logout-uris`, IdResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Deletes a logout URI.
	 * @param clientId - The client ID.
	 * @param uriId - The logout URI ID.
	 */
	async deleteLogoutUri(clientId: string, uriId: string): Promise<void> {
		await this.requestVoid(`/api/clients/${clientId}/logout-uris/${uriId}`, {
			method: "DELETE",
		});
	}

	/** Lists all users for the tenant. */
	async listUsers(): Promise<User[]> {
		return this.request("/api/subjects", s.array(UserSchema));
	}

	/**
	 * Gets a user by ID.
	 * @param id - The user ID.
	 * @returns The user or null if not found.
	 */
	async getUser(id: string): Promise<User | null> {
		try {
			return await this.request(`/api/subjects/${id}`, UserSchema);
		} catch (error) {
			if (error instanceof TenantApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Updates a user.
	 * @param id - The user ID.
	 * @param data - User update data.
	 * @returns The updated user.
	 */
	async updateUser(id: string, data: UpdateUserInput): Promise<User> {
		return this.request(`/api/subjects/${id}`, UserSchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Deletes a user.
	 * @param id - The user ID.
	 */
	async deleteUser(id: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${id}`, { method: "DELETE" });
	}

	/**
	 * Lists all sessions for a user.
	 * @param userId - The user ID.
	 */
	async listUserSessions(userId: string): Promise<Session[]> {
		return this.request(`/api/subjects/${userId}/sessions`, s.array(SessionSchema));
	}

	/**
	 * Checks whether a specific session still exists for a user (i.e. has not been
	 * revoked or expired-and-cleaned-up). Used to validate a platform session token's
	 * `sid` on privileged routes so logout/revocation takes effect server-side.
	 *
	 * @param userId - The user (subject) ID.
	 * @param sessionId - The session ID (`sid`) to check.
	 * @returns `true` when a session with that id exists for the user, `false` otherwise.
	 * @example
	 * if (!(await api.sessionExists(subjectId, sid))) return redirectToOnboarding();
	 */
	async sessionExists(userId: string, sessionId: string): Promise<boolean> {
		let sessions = await this.listUserSessions(userId);
		return sessions.some((session) => session.id === sessionId);
	}

	/**
	 * Deletes a user session.
	 * @param userId - The user ID.
	 * @param sessionId - The session ID.
	 */
	async deleteUserSession(userId: string, sessionId: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${userId}/sessions/${sessionId}`, {
			method: "DELETE",
		});
	}

	/** Lists all resources for the tenant. */
	async listResources(): Promise<Resource[]> {
		return this.request("/api/resources", s.array(ResourceSchema));
	}

	/**
	 * Gets a resource by ID.
	 * @param id - The resource ID.
	 * @returns The resource or null if not found.
	 */
	async getResource(id: string): Promise<Resource | null> {
		try {
			return await this.request(`/api/resources/${id}`, ResourceSchema);
		} catch (error) {
			if (error instanceof TenantApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Creates a new resource.
	 * @param data - Resource creation data.
	 * @returns The created resource ID.
	 */
	async createResource(data: CreateResourceInput): Promise<{ id: string }> {
		return this.request("/api/resources", IdResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Updates a resource.
	 * @param id - The resource ID.
	 * @param data - Resource update data.
	 * @returns The updated resource.
	 */
	async updateResource(id: string, data: UpdateResourceInput): Promise<Resource> {
		return this.request(`/api/resources/${id}`, ResourceSchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Deletes a resource.
	 * @param id - The resource ID.
	 */
	async deleteResource(id: string): Promise<void> {
		await this.requestVoid(`/api/resources/${id}`, { method: "DELETE" });
	}

	/** Gets the tenant branding configuration. */
	async getBranding(): Promise<Branding> {
		return this.request("/api/brand", BrandingSchema);
	}

	/**
	 * Updates the tenant branding configuration.
	 * @param data - Branding update data.
	 * @returns The updated branding.
	 */
	async updateBranding(data: UpdateBrandingInput): Promise<Branding> {
		return this.request("/api/brand", BrandingSchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Lists all passkeys for a user.
	 * @param userId - The user ID.
	 */
	async listPasskeys(userId: string): Promise<Passkey[]> {
		return this.request(`/api/subjects/${userId}/passkeys`, s.array(PasskeySchema));
	}

	/**
	 * Updates a passkey.
	 * @param userId - The user ID.
	 * @param passkeyId - The passkey ID.
	 * @param data - Passkey update data.
	 * @returns The updated passkey.
	 */
	async updatePasskey(
		userId: string,
		passkeyId: string,
		data: UpdatePasskeyInput,
	): Promise<Passkey> {
		return this.request(`/api/subjects/${userId}/passkeys/${passkeyId}`, PasskeySchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	/**
	 * Deletes a passkey.
	 * @param userId - The user ID.
	 * @param passkeyId - The passkey ID.
	 */
	async deletePasskey(userId: string, passkeyId: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${userId}/passkeys/${passkeyId}`, {
			method: "DELETE",
		});
	}

	/**
	 * Lists all grants for a user.
	 * @param userId - The user ID.
	 */
	async listGrants(userId: string): Promise<Grant[]> {
		return this.request(`/api/subjects/${userId}/grants`, s.array(GrantSchema));
	}

	/**
	 * Deletes a grant.
	 * @param userId - The user ID.
	 * @param grantId - The grant ID.
	 */
	async deleteGrant(userId: string, grantId: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${userId}/grants/${grantId}`, {
			method: "DELETE",
		});
	}

	/**
	 * Lists all connections for a user.
	 * @param userId - The user ID.
	 */
	async listConnections(userId: string): Promise<Connection[]> {
		return this.request(`/api/subjects/${userId}/connections`, s.array(ConnectionSchema));
	}

	/**
	 * Deletes a connection.
	 * @param userId - The user ID.
	 * @param connectionId - The connection ID.
	 */
	async deleteConnection(userId: string, connectionId: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${userId}/connections/${connectionId}`, {
			method: "DELETE",
		});
	}

	/** Lists all signing keys for the tenant. */
	async listSigningKeys(): Promise<SigningKey[]> {
		return this.request("/api/signing-keys", s.array(SigningKeySchema));
	}

	/** Creates a new signing key. */
	async createSigningKey(): Promise<SigningKey> {
		return this.request("/api/signing-keys", SigningKeySchema, {
			method: "POST",
		});
	}

	/** Rotates signing keys (marks current as inactive and creates new). */
	async rotateSigningKeys(): Promise<{ message: string }> {
		return this.request("/api/signing-keys/rotate", MessageResponseSchema, {
			method: "POST",
		});
	}

	/**
	 * Deletes a signing key.
	 * @param id - The signing key ID.
	 */
	async deleteSigningKey(id: string): Promise<void> {
		await this.requestVoid(`/api/signing-keys/${id}`, {
			method: "DELETE",
		});
	}
}

/**
 * Error thrown when tenant API requests fail.
 *
 * @example
 * catch (error) {
 *   if (error instanceof TenantApiError && error.status === 404) return null;
 *   throw error;
 * }
 */
export class TenantApiError extends Error {
	/**
	 * @param status - HTTP status code from the API response.
	 * @param message - Human-readable error message.
	 */
	constructor(
		/** HTTP status code from the API response. */
		public status: number,
		message: string,
	) {
		super(message);
		this.name = "TenantApiError";
	}
}

/** Tenant statistics. */
export type TenantStats = s.InferOutput<typeof TenantStatsSchema>;

/** OAuth client. */
export type Client = s.InferOutput<typeof ClientSchema>;

/** Client secret metadata (without the actual secret value). */
export type ClientSecret = s.InferOutput<typeof ClientSecretSchema>;

/** OAuth redirect URI. */
export type RedirectUri = s.InferOutput<typeof RedirectUriSchema>;

/** OAuth logout URI. */
export type LogoutUri = s.InferOutput<typeof LogoutUriSchema>;

/** User (subject). */
export type User = s.InferOutput<typeof UserSchema>;

/** User session. */
export type Session = s.InferOutput<typeof SessionSchema>;

/** API resource with scopes. */
export type Resource = s.InferOutput<typeof ResourceSchema>;

/** Tenant branding configuration. */
export type Branding = s.InferOutput<typeof BrandingSchema>;

/** Passkey credential. */
export type Passkey = s.InferOutput<typeof PasskeySchema>;

/** OAuth grant (user consent). */
export type Grant = s.InferOutput<typeof GrantSchema>;

/** Social identity provider connection. */
export type Connection = s.InferOutput<typeof ConnectionSchema>;

/** JWT signing key. */
export type SigningKey = s.InferOutput<typeof SigningKeySchema>;

/** Input for creating a client. */
export interface CreateClientInput {
	name: string;
	type: "public" | "confidential" | "m2m";
	description?: string;
	logoUrl?: string;
	allowedScopes?: string[];
	allowedResources?: string[];
	isManagementClient?: boolean;
}

/** Input for updating a client. */
export interface UpdateClientInput {
	name?: string;
	description?: string | null;
	logoUrl?: string | null;
	type?: "public" | "confidential" | "m2m";
	allowedScopes?: string[] | null;
	allowedResources?: string[] | null;
	isManagementClient?: boolean;
}

/** Input for updating a user. */
export interface UpdateUserInput {
	displayName?: string;
	username?: string;
	role?: "admin" | "user";
}

/** Input for creating a resource. */
export interface CreateResourceInput {
	identifier: string;
	name: string;
	description?: string;
	scopes: Array<{ name: string; description?: string }>;
}

/** Input for updating a resource. */
export interface UpdateResourceInput {
	identifier?: string;
	name?: string;
	description?: string | null;
	scopes?: Array<{ name: string; description?: string }>;
}

/** Input for updating branding. */
export interface UpdateBrandingInput {
	logoUrl?: string | null;
	primaryColor?: string | null;
	backgroundColor?: string | null;
	customCss?: string | null;
}

/** Input for updating a passkey. */
export interface UpdatePasskeyInput {
	name?: string | null;
}
