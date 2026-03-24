import { redirect } from "@pkg/http/response";
import { env } from "cloudflare:workers";

export namespace AuthModule {
	export interface UserProfile {
		subjectId: string;
		email: string;
		name: string;
		avatar: string;
		username: string;
	}

	export interface OAuthTokens {
		accessToken: string;
		idToken: string;
	}
}

const AUTH_STATE_COOKIE = "r3:auth-state";
const AUTH_NEXT_COOKIE = "r3:auth-next";

export function startAuthentication(request: Request) {
	let state = crypto.randomUUID();
	let url = new URL(request.url);
	let nextPath = normalizeNextPath(url.searchParams.get("next"));

	let authorizeUrl = new URL("https://auth.sergiodxa.com/authorize");
	authorizeUrl.searchParams.set("response_type", "code");
	authorizeUrl.searchParams.set("client_id", env.CLIENT_ID);
	authorizeUrl.searchParams.set("redirect_uri", callbackUrl(request));
	authorizeUrl.searchParams.set("scope", "openid profile email");
	authorizeUrl.searchParams.set("state", state);

	let response = redirect(authorizeUrl.toString());
	response.headers.append("Set-Cookie", serializeCookie(AUTH_STATE_COOKIE, state, 600));
	response.headers.append("Set-Cookie", serializeCookie(AUTH_NEXT_COOKIE, nextPath, 600));
	return response;
}

export function readAuthState(request: Request) {
	return readCookie(request.headers.get("Cookie"), AUTH_STATE_COOKIE);
}

export function readAuthNext(request: Request) {
	return normalizeNextPath(readCookie(request.headers.get("Cookie"), AUTH_NEXT_COOKIE));
}

export function clearAuthFlowCookies() {
	return [clearCookie(AUTH_STATE_COOKIE), clearCookie(AUTH_NEXT_COOKIE)] as const;
}

export async function exchangeCode(
	request: Request,
	code: string,
): Promise<AuthModule.OAuthTokens> {
	let tokenUrl = "https://auth.sergiodxa.com/oauth/token";
	let redirectUri = callbackUrl(request);
	let body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		client_id: env.CLIENT_ID,
		client_secret: env.CLIENT_SECRET,
	});

	let response = await fetch(tokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});

	if (!response.ok) {
		throw new Error(`OAuth token exchange failed with status ${String(response.status)}`);
	}

	let data = (await response.json()) as {
		access_token?: string;
		id_token?: string;
	};

	if (!data.access_token || !data.id_token) {
		throw new Error("OAuth token response did not include required tokens");
	}

	return {
		accessToken: data.access_token,
		idToken: data.id_token,
	};
}

export async function fetchUserProfile(accessToken: string): Promise<AuthModule.UserProfile> {
	let response = await fetch("https://auth.sergiodxa.com/userinfo", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch user profile with status ${String(response.status)}`);
	}

	let data = (await response.json()) as {
		sub?: string;
		email?: string;
		name?: string;
		picture?: string;
		preferred_username?: string;
	};

	if (!data.sub || !data.email || !data.name || !data.picture || !data.preferred_username) {
		throw new Error("User profile response is missing required fields");
	}

	return {
		subjectId: data.sub,
		email: data.email,
		name: data.name,
		avatar: data.picture,
		username: data.preferred_username,
	};
}

export function buildLogoutUrl(request: Request, idToken: string | null) {
	let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
	if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
	logoutUrl.searchParams.set("post_logout_redirect_uri", new URL("/", request.url).toString());
	return logoutUrl.toString();
}

function readCookie(cookieHeader: string | null, name: string) {
	if (!cookieHeader) return null;
	let parts = cookieHeader.split(";");

	for (let part of parts) {
		let [rawName, ...rawValue] = part.trim().split("=");
		if (rawName !== name) continue;
		if (rawValue.length === 0) return null;
		return decodeURIComponent(rawValue.join("="));
	}

	return null;
}

function serializeCookie(name: string, value: string, maxAge: number) {
	return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${String(maxAge)}`;
}

function clearCookie(name: string) {
	return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function normalizeNextPath(value: string | null) {
	if (!value || !value.startsWith("/") || value.startsWith("//")) return "/cms";
	if (value === "/login") return "/cms";
	return value;
}

function callbackUrl(request: Request) {
	return new URL("/auth/callback", request.url).toString();
}
