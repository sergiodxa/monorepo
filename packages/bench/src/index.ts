/**
 * Public surface of `@sdxc/bench`: entry-point weight, HTTP latency sampling
 * and duration-budget parsing for packages and running apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { budgetMs, parseBudgetFlag } from "./budget.js";
export { assertHttpBudgets, HttpBudgetError, percentile, sampleHttp } from "./http.js";
export type { HttpBudgets, HttpReport, HttpSample, SampleHttpOptions } from "./http.js";
export { assertWeight, weigh } from "./weigh.js";
export type { Weight, WeightBudget } from "./weigh.js";
export { WeightError } from "./weight-error.js";
export type { WeightErrorCode } from "./weight-error.js";
