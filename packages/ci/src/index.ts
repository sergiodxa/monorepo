/**
 * CI as a TypeScript script that runs the same on a laptop and on a CI host. Steps run in order
 * or concurrently, a matrix fans out over workspaces, unchanged steps reuse earlier passes, and
 * a green, complete run on a clean tree signs the commit off with a GitHub commit status.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	CacheOptions,
	CI,
	CIScript,
	CommandOptions,
	GroupOutcome,
	MatrixOptions,
	ParallelOptions,
	Runner,
	RunStatus,
	StepFunction,
	StepHandle,
	StepOptions,
	StepOutcome,
	StepRun,
	StepStatus,
} from "./types.js";
export type { CommandOutput } from "./process.js";
export type { PackageManifest, Workspace } from "./workspaces.js";
export type {
	Closing,
	EntryRecord,
	Reporter,
	RunOptions,
	RunReport,
	ScriptErrorRecord,
	StartedStep,
	StepRecord,
} from "./run.js";
export type { RunRecord, SignoffReport } from "./signoff.js";
export type { RecordedRun } from "./runs.js";
export type { Repository, Signoff, Verification } from "./github.js";
export type { Palette, Paint } from "./report.js";

export { CommandError } from "./process.js";
export { GitHubError, STATUS_CONTEXT } from "./github.js";
export { defineCI, loadScript } from "./load.js";
export { detectRunner, runScript } from "./run.js";
export { loadWorkspaces } from "./workspaces.js";
export { machineMemory, parseMemorySize } from "./memory.js";
export { scopeSince } from "./since.js";
export {
	actionsReporter,
	appendStepSummary,
	formatStepSummary,
	formatSummary,
	jsonReport,
	PLAIN,
	progressReporter,
	textReporter,
} from "./report.js";
export { lastRun, recordRun } from "./runs.js";
