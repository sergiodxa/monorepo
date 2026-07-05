/**
 * Covers role → permission-set resolution against a seeded database: built-in
 * roles expose exactly their seeded permissions, custom roles honor (and dedupe)
 * granted keys, and built-in roles are protected from renaming/permission edits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "bun:test";

import type { createDatabase } from "remix/data-table";

import { ADMIN_PERMISSIONS, PERMISSION_KEYS } from "../../shared/permissions";
import { createTestDatabase } from "../../shared/test/db";

import { Role } from "./role";

describe("Role permission resolution", () => {
	let db: ReturnType<typeof createDatabase>;

	beforeEach(async () => {
		({ db } = await createTestDatabase());
	});

	test("the seeded admin role resolves to the full permission catalog", async () => {
		let permissions = await Role.permissionsFor(db, "role_admin");
		expect(permissions.size).toBe(PERMISSION_KEYS.length);
		for (let key of PERMISSION_KEYS) expect(permissions.has(key)).toBe(true);
	});

	test("the seeded editor role resolves to its publishing permissions only", async () => {
		let permissions = await Role.permissionsFor(db, "role_editor");
		expect(permissions.has("posts.publish")).toBe(true);
		expect(permissions.has("posts.edit_any")).toBe(true);
		// Editor manages content, never users/roles/settings.
		expect(permissions.has("users.manage")).toBe(false);
		expect(permissions.has("roles.manage")).toBe(false);
		expect(permissions.has("settings.manage")).toBe(false);
	});

	test("the seeded reader role resolves to an empty permission set", async () => {
		let permissions = await Role.permissionsFor(db, "role_reader");
		expect(permissions.size).toBe(0);
	});

	test("permissionsFor returns an empty set for an unknown role id", async () => {
		let permissions = await Role.permissionsFor(db, "role_does_not_exist");
		expect(permissions.size).toBe(0);
	});

	test("isAdminRole is true only for roles granting every admin-defining permission", async () => {
		let admin = await Role.findByName(db, "admin");
		let editor = await Role.findByName(db, "editor");
		let reader = await Role.findByName(db, "reader");

		expect(admin).not.toBeNull();
		expect(Role.isAdminRole(admin!)).toBe(true);
		// Editor is missing users.manage/roles.manage, so it is not an admin role.
		expect(ADMIN_PERMISSIONS.every((key) => editor!.permissions.includes(key))).toBe(false);
		expect(Role.isAdminRole(editor!)).toBe(false);
		expect(Role.isAdminRole(reader!)).toBe(false);
	});
});

describe("Role custom-role creation", () => {
	let db: ReturnType<typeof createDatabase>;

	beforeEach(async () => {
		({ db } = await createTestDatabase());
	});

	test("a custom role resolves to exactly the granted permissions", async () => {
		let role = await Role.create(db, {
			name: "moderator",
			label: "Moderator",
			permissions: ["posts.edit_any", "posts.publish"],
		});

		expect(role.builtin).toBe(false);
		let permissions = await Role.permissionsFor(db, role.id);
		expect(permissions.has("posts.edit_any")).toBe(true);
		expect(permissions.has("posts.publish")).toBe(true);
		expect(permissions.has("users.manage")).toBe(false);
	});

	test("duplicate granted permissions are stored de-duplicated", async () => {
		let role = await Role.create(db, {
			name: "curator",
			label: "Curator",
			permissions: ["posts.publish", "posts.publish", "posts.edit_any"],
		});

		expect([...role.permissions].sort()).toEqual(["posts.edit_any", "posts.publish"]);
	});

	test("creating a role with an unknown permission key is rejected", async () => {
		await expect(
			Role.create(db, {
				name: "bogus",
				label: "Bogus",
				// @ts-expect-error - exercising runtime validation of an off-catalog key.
				permissions: ["made.up"],
			}),
		).rejects.toThrow(Role.InvalidError);
	});

	test("creating a role whose name collides with a built-in is rejected", async () => {
		await expect(
			Role.create(db, { name: "admin", label: "Impostor", permissions: [] }),
		).rejects.toThrow(/already exists/);
	});
});

describe("Role built-in protection", () => {
	let db: ReturnType<typeof createDatabase>;

	beforeEach(async () => {
		({ db } = await createTestDatabase());
	});

	test("updating a built-in role keeps its name and permission set", async () => {
		let updated = await Role.update(db, "role_reader", {
			name: "escalated",
			label: "Relabelled Reader",
			description: "new copy",
			permissions: ["users.manage", "roles.manage"],
		});

		// Only label/description are mutable on built-ins; name and permissions are frozen.
		expect(updated.name).toBe("reader");
		expect(updated.label).toBe("Relabelled Reader");
		expect(updated.description).toBe("new copy");
		expect(updated.permissions).toEqual([]);

		let permissions = await Role.permissionsFor(db, "role_reader");
		expect(permissions.size).toBe(0);
	});

	test("a custom role, unlike a built-in, does honor a permission update", async () => {
		let role = await Role.create(db, {
			name: "helper",
			label: "Helper",
			permissions: ["posts.create"],
		});

		let updated = await Role.update(db, role.id, {
			name: "helper-2",
			label: "Helper 2",
			permissions: ["posts.create", "posts.publish"],
		});

		expect(updated.name).toBe("helper-2");
		expect([...updated.permissions].sort()).toEqual(["posts.create", "posts.publish"]);
	});

	test("deleting a built-in role is rejected; a custom role can be deleted", async () => {
		await expect(Role.destroy(db, "role_admin")).rejects.toThrow(/Built-in/);

		let role = await Role.create(db, { name: "temp", label: "Temp", permissions: [] });
		await Role.destroy(db, role.id);
		expect(await Role.findById(db, role.id)).toBeNull();
	});
});
