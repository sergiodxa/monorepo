/**
 * The account a local run signs in as through the development login: the blog's author, with
 * the admin role the CMS guards let through. The login creates it on first use and writes the
 * seed content under it, so every CMS screen has rows to show.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The seeded admin's profile; `subjectId` is how a later sign-in finds the same account. */
export const DEV_ADMIN = {
	subjectId: "dev-admin",
	email: "dev@blog.localhost",
	username: "dev",
	displayName: "Dev Admin",
	avatar: "https://sergiodxa.com/.well-known/avatar",
} as const;
