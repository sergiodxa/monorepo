import { env } from "cloudflare:workers";
import { createCookie } from "react-router";

const ONE_MINUTE = 60; // 1 minute in seconds
const ONE_YEAR = ONE_MINUTE * 60 * 24 * 365; // 1 year in seconds

export const session = createCookie("uptime:sid", {
	path: "/",
	secure: import.meta.env.PROD,
	maxAge: ONE_YEAR,
	httpOnly: true,
	sameSite: "lax",
	secrets: [env.COOKIE_SESSION_SECRET ?? "s3cr3t"],
});

export const i18n = createCookie("uptime:i18n", {
	path: "/",
	secure: import.meta.env.PROD,
	maxAge: ONE_YEAR,
	httpOnly: true,
	sameSite: "lax",
	secrets: [env.COOKIE_SESSION_SECRET ?? "s3cr3t"],
});

export const returnTo = createCookie("uptime:return-to", {
	path: "/",
	secure: import.meta.env.PROD,
	maxAge: ONE_MINUTE * 5, // 5 minutes
	httpOnly: true,
	sameSite: "lax",
	secrets: [env.COOKIE_SESSION_SECRET ?? "s3cr3t"],
});

export const dashboardTab = createCookie("uptime:dashboard-tab", {
	path: "/",
	secure: import.meta.env.PROD,
	maxAge: ONE_YEAR,
	httpOnly: true,
	sameSite: "lax",
	secrets: [env.COOKIE_SESSION_SECRET ?? "s3cr3t"],
});
