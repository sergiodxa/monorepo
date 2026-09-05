/**
 * Preloaded by `bun test` alone, so typing it instead of `bun run test` stops here rather
 * than pointing Bun's runner at 1172 Vitest files and printing thousands of lines of
 * `vi.doMock is not a function` before failing.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

console.error(
	"`bun test` is not this repo's test command — every test runs under Vitest.\n" +
		"\n" +
		"  bun run test          Run every test (what CI runs)\n" +
		"  vp test run <path>    Scope a run to one path\n" +
		"  vp test watch         Watch mode\n",
);

process.exit(1);
