/**
 * The route registry: every URL this server answers, declared once so `.href(...)`
 * is typed everywhere and the URL surface can be read in one place. Filled in as each
 * group of endpoints is built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { route } from "remix/fetch-router/routes";

/** Every route this server serves, grouped by area. */
export default route({});
