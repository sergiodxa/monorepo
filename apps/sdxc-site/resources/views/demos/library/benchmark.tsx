/**
 * The benchmark band: Plumb's parse throughput drawn against a hand-written guard and its
 * own previous version, with the slow case shown rather than hidden, beside the machine,
 * runtime, input and harness the numbers came from and the script that reproduces them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { PropertyList } from "@sdxc/ui";
import { DrawnChart, LandingHeader, LandingSection, Split } from "@sdxc/ui/landing";

import { BENCHMARK } from "~/resources/views/demos/library/data";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The run's setup, one row each, so a reader can judge the numbers and reproduce them. */
const SETUP = [
	["Machine", "Apple M3 Pro, 36 GB, on mains power"],
	["Runtime", "Node 22.11.0, default flags"],
	["Input", "1,000 users from fixtures/users.json, 12 fields each"],
	["Harness", "mitata 1.0, 10 s per case, median of 5 runs"],
	["Commit", "9f3c2e1, the v4.2.0 tag"],
] as const;

/**
 * Renders the band: the chart at the start, since the figure is the claim, and the setup
 * that qualifies it beside it.
 *
 * @returns The render function producing the band.
 */
export function BenchmarkChapter() {
	return () => (
		<LandingSection id="benchmarks" ruled mix={[renderNearView(499, 1250)]}>
			<Split>
				<Split.Media>
					<DrawnChart
						aria-label="Parse throughput in millions of operations per second, higher is better"
						pauseLabel="Pause the chart"
						metric={{
							value: 39.6,
							format: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
							suffix: "M ops/s",
							label: "User.parse on valid input, plumb 4.2",
						}}
						series={BENCHMARK.map((row) => ({
							label: row.label,
							value: row.value,
							display: `${row.value.toFixed(1)}M`,
						}))}
						highlight={1}
						footnote="Operations per second, higher is better. Same machine, same input, same run."
					/>
				</Split.Media>
				<Split.Copy>
					<LandingHeader
						eyebrow="bench/parse.ts"
						description={
							<>
								Valid input parses at 96% of a guard written by hand. Invalid input is slower,
								because <strong>collecting every issue with its path allocates</strong>, so that bar
								is on the chart too.
							</>
						}
					>
						Within 4% of hand-written
					</LandingHeader>
					<PropertyList mix={[raw({ fontSize: "0.875rem" })]}>
						{SETUP.map(([label, value]) => (
							<PropertyList.Item key={label} label={label}>
								{value}
							</PropertyList.Item>
						))}
						<PropertyList.Item label="Reproduce">
							<a href="#docs">
								<code>bun run bench</code> in a clone
							</a>
						</PropertyList.Item>
					</PropertyList>
				</Split.Copy>
			</Split>
		</LandingSection>
	);
}
