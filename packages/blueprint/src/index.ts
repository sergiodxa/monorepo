/**
 * Generates files from `.stub` templates: parse a stub with its front matter, render it with
 * values, plan the files against the disk and write them. Import it as a namespace,
 * `import * as blueprint from "@sdxc/blueprint"`, so calls read `blueprint.render(…)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { BlueprintError } from "./errors.js";

export type { Filter } from "./filters.js";

export { FILTERS } from "./filters.js";

export type { ParseOptions, Stub } from "./parse.js";

export { parse } from "./parse.js";

export type { Action, FileToWrite, Plan, PlannedFile, PlanOptions } from "./plan.js";

export { plan, write } from "./plan.js";

export type { Renderable, RenderOptions, Value, Values } from "./render.js";

export { render } from "./render.js";

export type { BlockNode, Node, Template, TextNode, ValueNode } from "./template.js";

export { compile } from "./template.js";

export type { Use, Variable } from "./variables.js";

export { variables } from "./variables.js";
