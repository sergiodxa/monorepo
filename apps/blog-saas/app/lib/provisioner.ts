/**
 * Builds the blog provisioner a request runs its lifecycle actions through, wired with
 * the hostname client so a purge removes the external hostname alongside local state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { createHostnameClient } from "~/app/lib/hostnames";
import { BlogProvisioner } from "~/app/services/blog-provisioner";

/**
 * Builds a provisioner over the database the caller is already working in, so one
 * request holds one database.
 *
 * @param db The control-plane database the provisioner reads and writes.
 * @returns A provisioner for this unit of work.
 * @example await createProvisioner(ctx.db).create({ accountId, name, region });
 */
export function createProvisioner(db: Database): BlogProvisioner {
	return new BlogProvisioner(db, createHostnameClient());
}
