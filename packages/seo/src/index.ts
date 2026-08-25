/**
 * Public entry point: the {@link createSeo} factory, the {@link Seo} head components,
 * and the types both work in terms of. A site's identity — base URL, name, and
 * description — arrives entirely through the factory's configuration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { createSeo } from "./create-seo";
export type { SeoConfig, SeoService, SeoSite, SeoTwitter } from "./create-seo";

export { Seo } from "./components/seo";

export type { RobotsOptions } from "./lib/robots";
export type { SchemaOrg, SeoSchema } from "./lib/schema";
