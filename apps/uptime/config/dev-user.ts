/**
 * The person and team a local run signs in as through the development login, and the seed
 * writes into the local database. Both read these values, so the session the login writes
 * always names the subject who owns the seeded team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The seeded person's ID-token claims; `id` is the subject every seeded row is owned by. */
export const DEV_USER = {
	id: "dev-user",
	name: "Dev User",
	email: "dev@uptime.localhost",
	username: "dev",
} as const;

/** The seeded team the development login lands on. */
export const DEV_TEAM = {
	name: "Acme",
	slug: "acme",
} as const;
