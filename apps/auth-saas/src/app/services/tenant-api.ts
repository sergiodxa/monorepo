import { env } from "cloudflare:workers";

/**
 * Service for communicating with tenant Durable Objects via their Management API.
 * This is used by the dashboard to manage tenant data.
 */
export class TenantApiService {
	constructor(private tenantId: string) {}

	private getTenantStub() {
		return env.TENANT.getByName(this.tenantId);
	}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		let stub = this.getTenantStub();
		let url = `https://tenant.internal${path}`;
		let response = await stub.fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
		});

		if (!response.ok) {
			let error = await response.json().catch(() => ({ error: "Unknown error" }));
			throw new TenantApiError(
				response.status,
				(error as { error?: string }).error ?? "Unknown error",
			);
		}

		return response.json() as Promise<T>;
	}

	// Stats
	async getStats(): Promise<TenantStats> {
		return this.request("/api/stats");
	}

	// Clients
	async listClients(): Promise<Client[]> {
		return this.request("/api/clients");
	}

	async getClient(id: string): Promise<Client | null> {
		try {
			return await this.request(`/api/clients/${id}`);
		} catch (error) {
			if (error instanceof TenantApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	async createClient(data: CreateClientInput): Promise<{ id: string }> {
		return this.request("/api/clients", {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async updateClient(id: string, data: UpdateClientInput): Promise<Client> {
		return this.request(`/api/clients/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async deleteClient(id: string): Promise<void> {
		await this.request(`/api/clients/${id}`, { method: "DELETE" });
	}

	// Client Secrets
	async listSecrets(clientId: string): Promise<ClientSecret[]> {
		return this.request(`/api/clients/${clientId}/secrets`);
	}

	async createSecret(
		clientId: string,
		data: { name?: string; expiresAt?: string },
	): Promise<{ id: string; secret: string }> {
		return this.request(`/api/clients/${clientId}/secrets`, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async deleteSecret(clientId: string, secretId: string): Promise<void> {
		await this.request(`/api/clients/${clientId}/secrets/${secretId}`, {
			method: "DELETE",
		});
	}

	// Redirect URIs
	async listRedirectUris(clientId: string): Promise<RedirectUri[]> {
		return this.request(`/api/clients/${clientId}/redirect-uris`);
	}

	async createRedirectUri(
		clientId: string,
		data: { uri: string; environment?: string },
	): Promise<{ id: string }> {
		return this.request(`/api/clients/${clientId}/redirect-uris`, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async deleteRedirectUri(clientId: string, uriId: string): Promise<void> {
		await this.request(`/api/clients/${clientId}/redirect-uris/${uriId}`, {
			method: "DELETE",
		});
	}

	// Logout URIs
	async listLogoutUris(clientId: string): Promise<LogoutUri[]> {
		return this.request(`/api/clients/${clientId}/logout-uris`);
	}

	async createLogoutUri(
		clientId: string,
		data: {
			uri: string;
			type: "post_logout" | "backchannel" | "frontchannel";
			environment?: string;
		},
	): Promise<{ id: string }> {
		return this.request(`/api/clients/${clientId}/logout-uris`, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async deleteLogoutUri(clientId: string, uriId: string): Promise<void> {
		await this.request(`/api/clients/${clientId}/logout-uris/${uriId}`, {
			method: "DELETE",
		});
	}

	// Users (Subjects)
	async listUsers(): Promise<User[]> {
		return this.request("/api/subjects");
	}

	async getUser(id: string): Promise<User | null> {
		try {
			return await this.request(`/api/subjects/${id}`);
		} catch (error) {
			if (error instanceof TenantApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	async updateUser(id: string, data: UpdateUserInput): Promise<User> {
		return this.request(`/api/subjects/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async deleteUser(id: string): Promise<void> {
		await this.request(`/api/subjects/${id}`, { method: "DELETE" });
	}

	async listUserSessions(userId: string): Promise<Session[]> {
		return this.request(`/api/subjects/${userId}/sessions`);
	}

	async deleteUserSession(userId: string, sessionId: string): Promise<void> {
		await this.request(`/api/subjects/${userId}/sessions/${sessionId}`, {
			method: "DELETE",
		});
	}

	// Resources
	async listResources(): Promise<Resource[]> {
		return this.request("/api/resources");
	}

	async getResource(id: string): Promise<Resource | null> {
		try {
			return await this.request(`/api/resources/${id}`);
		} catch (error) {
			if (error instanceof TenantApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	async createResource(data: CreateResourceInput): Promise<{ id: string }> {
		return this.request("/api/resources", {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async updateResource(id: string, data: UpdateResourceInput): Promise<Resource> {
		return this.request(`/api/resources/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async deleteResource(id: string): Promise<void> {
		await this.request(`/api/resources/${id}`, { method: "DELETE" });
	}

	// Branding
	async getBranding(): Promise<Branding> {
		return this.request("/api/brand");
	}

	async updateBranding(data: UpdateBrandingInput): Promise<Branding> {
		return this.request("/api/brand", {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	// Passkeys
	async listPasskeys(userId: string): Promise<Passkey[]> {
		return this.request(`/api/subjects/${userId}/passkeys`);
	}

	async updatePasskey(
		userId: string,
		passkeyId: string,
		data: UpdatePasskeyInput,
	): Promise<Passkey> {
		return this.request(`/api/subjects/${userId}/passkeys/${passkeyId}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async deletePasskey(userId: string, passkeyId: string): Promise<void> {
		await this.request(`/api/subjects/${userId}/passkeys/${passkeyId}`, {
			method: "DELETE",
		});
	}

	// Grants
	async listGrants(userId: string): Promise<Grant[]> {
		return this.request(`/api/subjects/${userId}/grants`);
	}

	async deleteGrant(userId: string, grantId: string): Promise<void> {
		await this.request(`/api/subjects/${userId}/grants/${grantId}`, {
			method: "DELETE",
		});
	}

	// Connections
	async listConnections(userId: string): Promise<Connection[]> {
		return this.request(`/api/subjects/${userId}/connections`);
	}

	async deleteConnection(userId: string, connectionId: string): Promise<void> {
		await this.request(`/api/subjects/${userId}/connections/${connectionId}`, {
			method: "DELETE",
		});
	}

	// Signing Keys
	async listSigningKeys(): Promise<SigningKey[]> {
		return this.request("/api/signing-keys");
	}

	async createSigningKey(): Promise<SigningKey> {
		return this.request("/api/signing-keys", {
			method: "POST",
		});
	}

	async rotateSigningKeys(): Promise<{ message: string }> {
		return this.request("/api/signing-keys/rotate", {
			method: "POST",
		});
	}

	async deleteSigningKey(id: string): Promise<void> {
		await this.request(`/api/signing-keys/${id}`, {
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

// Type definitions
export interface TenantStats {
	total_users: number;
	total_clients: number;
	total_sessions: number;
	active_sessions: number;
	monthly_active_users: number;
}

export interface Client {
	id: string;
	name: string;
	description: string | null;
	logo_url: string | null;
	type: "public" | "confidential" | "m2m";
	allowed_scopes: string | null;
	allowed_resources: string | null;
	is_management_client: boolean | number;
	created_at: string;
	updated_at: string;
}

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

export interface ClientSecret {
	id: string;
	name: string | null;
	createdAt: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
}

export interface RedirectUri {
	id: string;
	client_id: string;
	uri: string;
	environment: string | null;
	created_at: string;
}

export interface LogoutUri {
	id: string;
	client_id: string;
	uri: string;
	type: "post_logout" | "backchannel" | "frontchannel";
	session_required: boolean | number;
	environment: string | null;
	created_at: string;
}

export interface User {
	id: string;
	email: string;
	email_verified_at: string | null;
	display_name: string | null;
	username: string;
	avatar_url: string | null;
	role: "admin" | "user";
	created_at: string;
	updated_at: string;
}

export interface UpdateUserInput {
	displayName?: string;
	username?: string;
	role?: "admin" | "user";
}

export interface Session {
	id: string;
	subject_id: string;
	client_id: string;
	ip: string | null;
	user_agent: string | null;
	expires_at: string;
	created_at: string;
	updated_at: string;
}

export interface Resource {
	id: string;
	identifier: string;
	name: string;
	description: string | null;
	scopes: Array<{ name: string; description?: string }>;
	created_at: string;
	updated_at: string;
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

export interface Branding {
	id: string;
	logo_url: string | null;
	primary_color: string | null;
	background_color: string | null;
	custom_css: string | null;
	created_at: string;
	updated_at: string;
}

export interface UpdateBrandingInput {
	logoUrl?: string | null;
	primaryColor?: string | null;
	backgroundColor?: string | null;
	customCss?: string | null;
}

export interface Passkey {
	id: string;
	subject_id: string;
	credential_id: string;
	name: string | null;
	device_type: string | null;
	backed_up: boolean | number;
	transports: string | null;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface UpdatePasskeyInput {
	name?: string | null;
}

export interface Grant {
	id: string;
	subject_id: string;
	client_id: string;
	scopes: string;
	resources: string | null;
	created_at: string;
	updated_at: string;
}

export interface Connection {
	id: string;
	subject_id: string;
	provider: string;
	provider_user_id: string;
	email: string | null;
	display_name: string | null;
	avatar_url: string | null;
	access_token: string | null;
	refresh_token: string | null;
	token_expires_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface SigningKey {
	id: string;
	algorithm: string;
	public_key: string;
	private_key: string;
	is_active: boolean | number;
	created_at: string;
	rotated_at: string | null;
}
