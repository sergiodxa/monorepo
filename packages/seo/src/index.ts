/**
 * Public entry point: the {@link createSeo} factory, the {@link Seo} head components,
 * and the types both work in terms of. Nothing here carries a base URL, site name, or
 * description of its own — a site's identity arrives through the factory's configuration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { createSeo } from "./create-seo";
export type { SeoConfig, SeoService, SeoSite, SeoTwitter } from "./create-seo";

export { Seo } from "./components/seo";

export type { RobotsOptions } from "./lib/robots";
export type { SchemaOrg, SeoSchema } from "./lib/schema";
