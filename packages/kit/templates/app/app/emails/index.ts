/**
 * Every email the app sends, declared in one map with the schema of its props. Importing it
 * costs the schemas alone, so a controller or a job sends an email without loading the
 * template that renders it.
 */

import { emails } from "@sdxc/mail";

/** The app's emails; `sdxc make email <name>` declares one here and maps its template. */
export default emails({});
