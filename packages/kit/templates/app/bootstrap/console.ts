/**
 * The REPL's entry point, preloaded into Bun's REPL by `sdxc run console`: it opens the local
 * database `bun dev` serves and binds the app's models to it, as `db` and `models` on
 * `globalThis`, so every line typed at the prompt reads and writes the dev server's rows.
 */

import { openLocalDatabase } from "~/app/initializers/local-database";
import registry from "~/app/models";

/** The local database, open for the REPL's whole session. */
const DATABASE = openLocalDatabase();

Object.assign(globalThis, { db: DATABASE, models: registry.bind({ db: DATABASE }) });
