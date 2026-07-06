/**
 * User entity for the blog. Defines a Zod schema for users with a UUID id, a
 * guest/admin role, and bounded email, username, display name and avatar fields
 * plus created/updated timestamps, and exports the inferred User type. It exists
 * to define and validate the shape of user records and post authors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

export const UserSchema = z.object({
	id: z.string().uuid(),
	role: z.enum(["guest", "admin"]),
	email: z.string().email().max(320),
	username: z.string().min(1).max(39),
	displayName: z.string().min(1).max(255),
	avatar: z.string().url().max(2048),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type User = z.output<typeof UserSchema>;
