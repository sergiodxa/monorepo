import type { Schema } from "remix/data-schema";

import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import { createInternalToken } from "~/lib/internal-auth";

// ============================================================================
// SCHEMAS
// ============================================================================

const TenantStatsSchema = s.object({
	total_users: s.number(),
	total_clients: s.number(),
	total_sessions: s.number(),
	active_sessions: s.number(),
	monthly_active_users: s.number(),
});

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

const ClientSecretSchema = s.object({
	id: s.string(),
	name: s.nullable(s.string()),
	createdAt: s.string(),
	lastUsedAt: s.nullable(s.string()),
	expiresAt: s.nullable(s.string()),
});

const RedirectUriSchema = s.object({
	id: s.string(),
	client_id: s.string(),
	uri: s.string(),
	environment: s.nullable(s.string()),
	created_at: s.string(),
});

const LogoutUriSchema = s.object({
	id: s.string(),
	client_id: s.string(),
	uri: s.string(),
	type: s.union([s.literal("post_logout"), s.literal("backchannel"), s.literal("frontchannel")]),
	session_required: s.union([s.boolean(), s.number()]),
	environment: s.nullable(s.string()),
	created_at: s.string(),
});

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

const SessionSchema = s.object({
	id: s.string(),
	subject_id: s.string(),
	client_id: s.string(),
	ip: s.nullable(s.string()),
	user_agent: s.nullable(s.string()),
	expires_at: s.string(),
	created_at: s.string(),
	updated_at: s.string(),
});

const ScopeSchema = s.object({
	name: s.string(),
	description: s.optional(s.string()),
});

const ResourceSchema = s.object({
	id: s.string(),
	identifier: s.string(),
	name: s.string(),
	description: s.nullable(s.string()),
	scopes: s.array(ScopeSchema),
	created_at: s.string(),
	updated_at: s.string(),
});

const BrandingSchema = s.object({
	id: s.string(),
	logo_url: s.nullable(s.string()),
	primary_color: s.nullable(s.string()),
	background_color: s.nullable(s.string()),
	custom_css: s.nullable(s.string()),
	created_at: s.string(),
	updated_at: s.string(),
});

const PasskeySchema = s.object({
	id: s.string(),
	subject_id: s.string(),
	credential_id: s.string(),
	name: s.nullable(s.string()),
	device_type: s.nullable(s.string()),
	backed_up: s.union([s.boolean(), s.number()]),
	transports: s.nullable(s.string()),
	last_used_at: s.nullable(s.string()),
	created_at: s.string(),
	updated_at: s.string(),
});

const GrantSchema = s.object({
	id: s.string(),
	subject_id: s.string(),
	client_id: s.string(),
	scopes: s.string(),
	resources: s.nullable(s.string()),
	created_at: s.string(),
	updated_at: s.string(),
});

const ConnectionSchema = s.object({
	id: s.string(),
	subject_id: s.string(),
	provider: s.string(),
	provider_user_id: s.string(),
	email: s.nullable(s.string()),
	display_name: s.nullable(s.string()),
	avatar_url: s.nullable(s.string()),
	access_token: s.nullable(s.string()),
	refresh_token: s.nullable(s.string()),
	token_expires_at: s.nullable(s.string()),
	created_at: s.string(),
	updated_at: s.string(),
});

const SigningKeySchema = s.object({
	id: s.string(),
	algorithm: s.string(),
	public_key: s.string(),
	private_key: s.string(),
	is_active: s.union([s.boolean(), s.number()]),
	created_at: s.string(),
	rotated_at: s.nullable(s.string()),
});

const IdResponseSchema = s.object({ id: s.string() });
const SecretResponseSchema = s.object({ id: s.string(), secret: s.string() });
const MessageResponseSchema = s.object({ message: s.string() });

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Service for communicating with tenant Durable Objects via their Management API.
 * This is used by the dashboard to manage tenant data.
 * Uses signed internal tokens for secure authentication.
 */
export class TenantApiService {
	constructor(private tenantId: string) {}

	private getTenantStub() {
		return env.TENANT.getByName(this.tenantId);
	}

	private async request<Input, Output>(
		path: string,
		schema: Schema<Input, Output>,
		options: RequestInit = {},
	): Promise<Output> {
		let stub = this.getTenantStub();
		let url = `https://tenant.internal${path}`;

		// Generate signed internal token for secure authentication
		let internalToken = await createInternalToken(env.INTERNAL_SECRET);

		let response = await stub.fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				"X-Internal-Token": internalToken,
				...options.headers,
			},
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

	private async requestVoid(path: string, options: RequestInit = {}): Promise<void> {
		let stub = this.getTenantStub();
		let url = `https://tenant.internal${path}`;

		// Generate signed internal token for secure authentication
		let internalToken = await createInternalToken(env.INTERNAL_SECRET);

		let response = await stub.fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				"X-Internal-Token": internalToken,
				...options.headers,
			},
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

	// Stats
	async getStats(): Promise<TenantStats> {
		return this.request("/api/stats", TenantStatsSchema);
	}

	// Clients
	async listClients(): Promise<Client[]> {
		return this.request("/api/clients", s.array(ClientSchema));
	}

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

	async createClient(data: CreateClientInput): Promise<{ id: string }> {
		return this.request("/api/clients", IdResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async updateClient(id: string, data: UpdateClientInput): Promise<Client> {
		return this.request(`/api/clients/${id}`, ClientSchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async deleteClient(id: string): Promise<void> {
		await this.requestVoid(`/api/clients/${id}`, { method: "DELETE" });
	}

	// Client Secrets
	async listSecrets(clientId: string): Promise<ClientSecret[]> {
		return this.request(`/api/clients/${clientId}/secrets`, s.array(ClientSecretSchema));
	}

	async createSecret(
		clientId: string,
		data: { name?: string; expiresAt?: string },
	): Promise<{ id: string; secret: string }> {
		return this.request(`/api/clients/${clientId}/secrets`, SecretResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async deleteSecret(clientId: string, secretId: string): Promise<void> {
		await this.requestVoid(`/api/clients/${clientId}/secrets/${secretId}`, {
			method: "DELETE",
		});
	}

	// Redirect URIs
	async listRedirectUris(clientId: string): Promise<RedirectUri[]> {
		return this.request(`/api/clients/${clientId}/redirect-uris`, s.array(RedirectUriSchema));
	}

	async createRedirectUri(
		clientId: string,
		data: { uri: string; environment?: string },
	): Promise<{ id: string }> {
		return this.request(`/api/clients/${clientId}/redirect-uris`, IdResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async deleteRedirectUri(clientId: string, uriId: string): Promise<void> {
		await this.requestVoid(`/api/clients/${clientId}/redirect-uris/${uriId}`, {
			method: "DELETE",
		});
	}

	// Logout URIs
	async listLogoutUris(clientId: string): Promise<LogoutUri[]> {
		return this.request(`/api/clients/${clientId}/logout-uris`, s.array(LogoutUriSchema));
	}

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

	async deleteLogoutUri(clientId: string, uriId: string): Promise<void> {
		await this.requestVoid(`/api/clients/${clientId}/logout-uris/${uriId}`, {
			method: "DELETE",
		});
	}

	// Users (Subjects)
	async listUsers(): Promise<User[]> {
		return this.request("/api/subjects", s.array(UserSchema));
	}

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

	async updateUser(id: string, data: UpdateUserInput): Promise<User> {
		return this.request(`/api/subjects/${id}`, UserSchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async deleteUser(id: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${id}`, { method: "DELETE" });
	}

	async listUserSessions(userId: string): Promise<Session[]> {
		return this.request(`/api/subjects/${userId}/sessions`, s.array(SessionSchema));
	}

	async deleteUserSession(userId: string, sessionId: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${userId}/sessions/${sessionId}`, {
			method: "DELETE",
		});
	}

	// Resources
	async listResources(): Promise<Resource[]> {
		return this.request("/api/resources", s.array(ResourceSchema));
	}

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

	async createResource(data: CreateResourceInput): Promise<{ id: string }> {
		return this.request("/api/resources", IdResponseSchema, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async updateResource(id: string, data: UpdateResourceInput): Promise<Resource> {
		return this.request(`/api/resources/${id}`, ResourceSchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async deleteResource(id: string): Promise<void> {
		await this.requestVoid(`/api/resources/${id}`, { method: "DELETE" });
	}

	// Branding
	async getBranding(): Promise<Branding> {
		return this.request("/api/brand", BrandingSchema);
	}

	async updateBranding(data: UpdateBrandingInput): Promise<Branding> {
		return this.request("/api/brand", BrandingSchema, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	// Passkeys
	async listPasskeys(userId: string): Promise<Passkey[]> {
		return this.request(`/api/subjects/${userId}/passkeys`, s.array(PasskeySchema));
	}

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

	async deletePasskey(userId: string, passkeyId: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${userId}/passkeys/${passkeyId}`, {
			method: "DELETE",
		});
	}

	// Grants
	async listGrants(userId: string): Promise<Grant[]> {
		return this.request(`/api/subjects/${userId}/grants`, s.array(GrantSchema));
	}

	async deleteGrant(userId: string, grantId: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${userId}/grants/${grantId}`, {
			method: "DELETE",
		});
	}

	// Connections
	async listConnections(userId: string): Promise<Connection[]> {
		return this.request(`/api/subjects/${userId}/connections`, s.array(ConnectionSchema));
	}

	async deleteConnection(userId: string, connectionId: string): Promise<void> {
		await this.requestVoid(`/api/subjects/${userId}/connections/${connectionId}`, {
			method: "DELETE",
		});
	}

	// Signing Keys
	async listSigningKeys(): Promise<SigningKey[]> {
		return this.request("/api/signing-keys", s.array(SigningKeySchema));
	}

	async createSigningKey(): Promise<SigningKey> {
		return this.request("/api/signing-keys", SigningKeySchema, {
			method: "POST",
		});
	}

	async rotateSigningKeys(): Promise<{ message: string }> {
		return this.request("/api/signing-keys/rotate", MessageResponseSchema, {
			method: "POST",
		});
	}

	async deleteSigningKey(id: string): Promise<void> {
		await this.requestVoid(`/api/signing-keys/${id}`, {
			method: "DELETE",
		});
	}
}

export class TenantApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
		this.name = "TenantApiError";
	}
}

// ============================================================================
// TYPE DEFINITIONS (derived from schemas)
// ============================================================================

export type TenantStats = s.InferOutput<typeof TenantStatsSchema>;
export type Client = s.InferOutput<typeof ClientSchema>;
export type ClientSecret = s.InferOutput<typeof ClientSecretSchema>;
export type RedirectUri = s.InferOutput<typeof RedirectUriSchema>;
export type LogoutUri = s.InferOutput<typeof LogoutUriSchema>;
export type User = s.InferOutput<typeof UserSchema>;
export type Session = s.InferOutput<typeof SessionSchema>;
export type Resource = s.InferOutput<typeof ResourceSchema>;
export type Branding = s.InferOutput<typeof BrandingSchema>;
export type Passkey = s.InferOutput<typeof PasskeySchema>;
export type Grant = s.InferOutput<typeof GrantSchema>;
export type Connection = s.InferOutput<typeof ConnectionSchema>;
export type SigningKey = s.InferOutput<typeof SigningKeySchema>;

// Input types for mutations (not schema-derived since they have different shapes)
export interface CreateClientInput {
	name: string;
	type: "public" | "confidential" | "m2m";
	description?: string;
	logoUrl?: string;
	allowedScopes?: string[];
	allowedResources?: string[];
	isManagementClient?: boolean;
}

export interface UpdateClientInput {
	name?: string;
	description?: string | null;
	logoUrl?: string | null;
	type?: "public" | "confidential" | "m2m";
	allowedScopes?: string[] | null;
	allowedResources?: string[] | null;
	isManagementClient?: boolean;
}

export interface UpdateUserInput {
	displayName?: string;
	username?: string;
	role?: "admin" | "user";
}

export interface CreateResourceInput {
	identifier: string;
	name: string;
	description?: string;
	scopes: Array<{ name: string; description?: string }>;
}

export interface UpdateResourceInput {
	identifier?: string;
	name?: string;
	description?: string | null;
	scopes?: Array<{ name: string; description?: string }>;
}

export interface UpdateBrandingInput {
	logoUrl?: string | null;
	primaryColor?: string | null;
	backgroundColor?: string | null;
	customCss?: string | null;
}

export interface UpdatePasskeyInput {
	name?: string | null;
}
