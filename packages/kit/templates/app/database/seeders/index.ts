/**
 * The seeders `sdxc run db seed` runs on the local database, in the order listed here. Write
 * each in its own file beside this one, default-exporting a `Seeder` that creates rows with
 * `factories.createMany(PostFactory, 10)` or `models.post.create({ … })`, and add it below.
 */

import type { Seeder } from "~/app/services/seeders";

/** Every seeder by the name `db seed` reports it under; later ones may read earlier ones' rows. */
const SEEDERS: Readonly<Record<string, Seeder>> = {};

export default SEEDERS;
