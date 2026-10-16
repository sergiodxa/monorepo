/**
 * `db console`: a `sql>` prompt over the local database, or one statement with `--execute`, for
 * looking at the rows `bun dev` serves without writing a command for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { dbHandler as default } from "@sdxc/database-middleware/cli";
