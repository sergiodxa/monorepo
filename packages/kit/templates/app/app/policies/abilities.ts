/**
 * Everything a visitor can do in the app, named once so a page, an endpoint, a tool and a test
 * all check the same ability. `sdxc make policy <resource>` adds a resource's abilities here, and
 * importing the catalog does no work, so browser code reads it too.
 */

import { abilities } from "@sdxc/authz";

/**
 * Each ability by its dot-joined keys, such as `post.update`. One declared with a `context` is
 * checked against a record; one without is checked with nothing.
 */
export default abilities({});
