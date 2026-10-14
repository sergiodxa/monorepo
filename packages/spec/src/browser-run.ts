/**
 * Entry point for driving the `browser` capability through a Cloudflare
 * Browser Run binding: the same tool surface as `createBrowserPlugin`, with a
 * CDP session behind it so a Worker can run the tools without `agent-browser`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "./plugin.js";
export type { BrowserRunBinding, BrowserRunPluginOptions } from "./plugins/browser-run.js";
export { createBrowserRunPlugin } from "./plugins/browser-run.js";
