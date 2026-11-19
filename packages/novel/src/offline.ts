/**
 * The `@sdxc/novel/offline` entry, for the page: `registerOffline()` registers the app's offline
 * worker and tells it the novel's declared files, and `offlineAssets()` lists them. The worker
 * script itself imports `@sdxc/novel/offline/worker`, which carries none of the engine.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { RegisterOptions } from "./offline/register.js";

export { offlineAssets, registerOffline } from "./offline/register.js";
