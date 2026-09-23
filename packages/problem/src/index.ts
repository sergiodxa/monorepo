/**
 * Public surface of the problem details package: writing and reading RFC 9457
 * `application/problem+json` documents, validation failures as problems, and
 * catalogs that declare an API's problem types once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	BuilderInput,
	CatalogEntry,
	CatalogMethods,
	CatalogProblem,
	ProblemBuilder,
	ProblemCatalog,
	ProblemEntries,
	ProblemEntry,
} from "./catalog.js";
export type { ParseOptions } from "./parse.js";
export type { Problem, ProblemIssue, ProblemOptions } from "./types.js";

export { defineProblems } from "./catalog.js";
export { ISSUES_SCHEMA, issuesFrom, toPointer, validationProblem } from "./issues.js";
export { isProblem, parse, parseProblem, ProblemParseError } from "./parse.js";
export { ABOUT_BLANK, PROBLEM_MEDIA_TYPE, problem, stringify } from "./problem.js";
