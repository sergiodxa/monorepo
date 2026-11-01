/**
 * Checker for the command line a package ships: one `sdxc-<directory>` bin at `./src/cli.ts`,
 * started with a Node shebang, declared in `src/cli-contract.ts`, tested in `src/cli.test.ts`
 * and built on `@sdxc/cli`, so every package command line installs and behaves the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** What the checker reads about one package that declares a `bin`. */
export interface PackageBinFacts {
	dir: string;
	bin: string | Record<string, string>;
	/** The first line of `src/cli.ts`, or `null` when the file is missing. */
	cliFirstLine: string | null;
	hasContract: boolean;
	hasCliTest: boolean;
	dependsOnCli: boolean;
}

/**
 * Bins published before the convention, keyed by package directory; their names and entry
 * points are part of their released interface and stay as they are.
 */
export const PUBLISHED_BINS: Record<string, Record<string, string>> = {
	kit: { sdxc: "./src/bin.ts" },
	spec: { spec: "./src/cli.ts" },
	mcp: { "mcp-bridge": "./src/bridge/index.ts" },
};

/**
 * Every way `facts` departs from the convention, one readable line each; an empty list means
 * the package's command line conforms. Packages in `PUBLISHED_BINS` are held to their entry only.
 */
export function packageBinProblems(facts: PackageBinFacts): string[] {
	let published = PUBLISHED_BINS[facts.dir];
	if (published) {
		return JSON.stringify(facts.bin) === JSON.stringify(published)
			? []
			: [`${facts.dir}: bin must stay ${JSON.stringify(published)}`];
	}

	let problems: string[] = [];
	let expected = { [`sdxc-${facts.dir}`]: "./src/cli.ts" };
	if (JSON.stringify(facts.bin) !== JSON.stringify(expected)) {
		problems.push(`${facts.dir}: bin must be ${JSON.stringify(expected)}`);
	}
	if (facts.cliFirstLine === null) problems.push(`${facts.dir}: src/cli.ts is missing`);
	else if (facts.cliFirstLine !== "#!/usr/bin/env node") {
		problems.push(`${facts.dir}: src/cli.ts must start with #!/usr/bin/env node`);
	}
	if (!facts.hasContract) problems.push(`${facts.dir}: src/cli-contract.ts is missing`);
	if (!facts.hasCliTest) problems.push(`${facts.dir}: src/cli.test.ts is missing`);
	if (!facts.dependsOnCli) problems.push(`${facts.dir}: dependencies must include @sdxc/cli`);
	return problems;
}
