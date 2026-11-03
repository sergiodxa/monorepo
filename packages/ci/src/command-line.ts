/**
 * The `sdxc-ci` command line as building blocks for a tool that wraps it: the flag sets each
 * command declares and the action behind each command, so the wrapper offers the same flags and
 * prints the same reports while deciding for itself where the script lives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	ActionIO,
	FilterInput,
	ListInput,
	RunInput,
	SignoffInput,
	VerifyInput,
} from "./cli-actions.js";

export type { CleanInput, CleanReport } from "./clean.js";

export { listAction, runAction, signoffAction, verifyAction } from "./cli-actions.js";
export { CLEAN_FLAGS, LIST_FLAGS, RUN_FLAGS, SIGNOFF_FLAGS, VERIFY_FLAGS } from "./cli-contract.js";
export { cleanAction } from "./clean.js";
