/**
 * The permission catalog: the engine's fixed set of capability keys plus the helpers
 * for checking and parsing them. Roles are named bundles of these keys, so code
 * always checks permissions rather than role names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The engine's fixed catalog of permission keys (capabilities), stored on roles in
 * the database. The catalog is append-only: keys unknown to a role are ignored at
 * check time, so existing custom roles keep working as new keys are added.
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

/**
 * Reports whether `granted` contains every key in `required` (used for AND gates).
 * @param granted - The permissions the current user holds.
 * @param required - The permissions all of which are required.
 * @returns True when every required key is granted.
 */
export function hasAll(granted: ReadonlySet<string>, required: readonly Permission[]): boolean {
	for (let key of required) if (!granted.has(key)) return false;
	return true;
}

/**
 * Reports whether `granted` contains at least one key in `required` (OR gate).
 * @param granted - The permissions the current user holds.
 * @param required - The permissions any of which suffices.
 * @returns True when at least one required key is granted.
 */
export function hasAny(granted: ReadonlySet<string>, required: readonly Permission[]): boolean {
	for (let key of required) if (granted.has(key)) return true;
	return false;
}

/**
 * Parses a role's stored permissions JSON into a set, dropping any key not in the
 * catalog so unknown/legacy keys never grant access.
 * @param json - The JSON array of permission keys from a role row.
 * @returns The set of recognized permissions (empty on malformed input).
 */
export function parsePermissions(json: string): Set<Permission> {
	let out = new Set<Permission>();
	try {
		let parsed: unknown = JSON.parse(json);
		if (!Array.isArray(parsed)) return out;
		for (let key of parsed) {
			if (typeof key === "string" && key in PERMISSIONS) out.add(key as Permission);
		}
	} catch {}
	return out;
}
