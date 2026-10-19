/**
 * The rows `sdxc run db seed` writes into the local database: named steps, run in order, each
 * writing fixed rows through `models` or generated ones through `factories`, with the
 * factories in `database/factories/`.
 */

import { defineSeed } from "@sdxc/data-model/seed";

import registry from "~/app/models";

/** Add a step per set of rows, as `posts: ({ factories }) => factories.createMany(PostFactory, 10)`. */
export default defineSeed(registry, {});
