/**
 * The engine's fixed catalog of permission keys (capabilities). Roles are just
 * named bundles of these keys stored in the database; code checks permissions,
 * never role names — this is what makes owner-defined custom roles possible.
 *
 * The catalog is append-only: unknown keys stored on a role are ignored at check
 * time, so it can grow in future engine versions without breaking custom roles.
 */
export const PERMISSIONS = {
	"posts.create": "Create drafts of any visible post type",
	"posts.edit_own": "Edit posts where author_id is the current user",
	"posts.edit_any": "Edit any post, including reassigning its author",
	"posts.delete_own": "Delete own posts",
	"posts.delete_any": "Delete any post",
	"posts.publish": "Set or change published_at: publish now, schedule, or unpublish",
	"post_types.manage": "Create, edit, and delete custom post types",
	"settings.manage": "Edit site settings (title, description, language)",
	"appearance.manage": "Edit theme variables and custom CSS",
	"users.manage": "Assign roles to users, delete users",
	"roles.manage": "Create, edit, and delete custom roles",
} as const;

/** A permission key from the engine catalog. */
export type Permission = keyof typeof PERMISSIONS;

/** Every permission key, in catalog order (useful for admin checkbox lists). */
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

/**
 * Permissions that, together, identify an administrator (the "manage everything"
 * role). Used to enforce the last-admin invariant.
 */
export const ADMIN_PERMISSIONS: Permission[] = ["users.manage", "roles.manage"];

/** Returns true when `granted` contains every key in `required`. */
export function hasAll(granted: ReadonlySet<string>, required: readonly Permission[]): boolean {
	for (let key of required) if (!granted.has(key)) return false;
	return true;
}

/** Returns true when `granted` contains at least one key in `required`. */
export function hasAny(granted: ReadonlySet<string>, required: readonly Permission[]): boolean {
	for (let key of required) if (granted.has(key)) return true;
	return false;
}

/** Parses a role's stored permissions JSON into a set, dropping unknown keys. */
export function parsePermissions(json: string): Set<Permission> {
	let out = new Set<Permission>();
	try {
		let parsed: unknown = JSON.parse(json);
		if (!Array.isArray(parsed)) return out;
		for (let key of parsed) {
			if (typeof key === "string" && key in PERMISSIONS) out.add(key as Permission);
		}
	} catch {
		// Malformed JSON grants nothing.
	}
	return out;
}
