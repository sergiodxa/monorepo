/**
 * Line diffs in the unified format `git diff` prints, for `--dry-run` and `sdxc ui diff`: the
 * shortest edit between two texts, grouped into hunks with three lines of context, so a reader
 * sees what a command would change in the shape every review tool already shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Lines of unchanged context around each change. */
const CONTEXT = 3;

/** One line of the edit: kept, removed from the old text, or added by the new one. */
interface Step {
	kind: " " | "-" | "+";
	line: string;
}

/**
 * The unified diff from `before` to `after`, headed `--- a/<path>` and `+++ b/<path>`, or an
 * empty string when the texts are equal. A `null` side is a file that does not exist, headed
 * `/dev/null` as git heads a created or deleted file.
 */
export function unifiedDiff(path: string, before: string | null, after: string | null): string {
	if (before === after) return "";
	let steps = editScript(splitLines(before ?? ""), splitLines(after ?? ""));
	let header = [
		`--- ${before === null ? "/dev/null" : `a/${path}`}`,
		`+++ ${after === null ? "/dev/null" : `b/${path}`}`,
	];
	return [...header, ...hunks(steps)].join("\n") + "\n";
}

/** `text` as lines without their terminators; a final newline ends the last line. */
function splitLines(text: string): string[] {
	if (text === "") return [];
	let lines = text.split("\n");
	if (lines.at(-1) === "") lines.pop();
	return lines;
}

/**
 * The edit from `a` to `b` through their longest common subsequence, removals before additions
 * within each change, as `diff` orders them.
 */
function editScript(a: string[], b: string[]): Step[] {
	let width = b.length + 1;
	let lengths = new Uint32Array((a.length + 1) * width);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lengths[i * width + j] =
				a[i] === b[j]
					? (lengths[(i + 1) * width + j + 1] ?? 0) + 1
					: Math.max(lengths[(i + 1) * width + j] ?? 0, lengths[i * width + j + 1] ?? 0);
		}
	}
	let steps: Step[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			steps.push({ kind: " ", line: a[i] ?? "" });
			i += 1;
			j += 1;
		} else if (
			j >= b.length ||
			(i < a.length && (lengths[(i + 1) * width + j] ?? 0) >= (lengths[i * width + j + 1] ?? 0))
		) {
			steps.push({ kind: "-", line: a[i] ?? "" });
			i += 1;
		} else {
			steps.push({ kind: "+", line: b[j] ?? "" });
			j += 1;
		}
	}
	return steps;
}

/** The steps grouped into `@@` hunks, changes closer than twice the context sharing one. */
function hunks(steps: Step[]): string[] {
	let output: string[] = [];
	let changed = steps.flatMap((step, index) => (step.kind === " " ? [] : [index]));
	let start = 0;
	while (start < changed.length) {
		let end = start;
		while (
			end + 1 < changed.length &&
			(changed[end + 1] ?? 0) - (changed[end] ?? 0) <= CONTEXT * 2 + 1
		) {
			end += 1;
		}
		let from = Math.max(0, (changed[start] ?? 0) - CONTEXT);
		let to = Math.min(steps.length, (changed[end] ?? 0) + CONTEXT + 1);
		let oldStart = 1;
		let newStart = 1;
		for (let step of steps.slice(0, from)) {
			if (step.kind !== "+") oldStart += 1;
			if (step.kind !== "-") newStart += 1;
		}
		let body = steps.slice(from, to);
		let oldCount = body.filter((step) => step.kind !== "+").length;
		let newCount = body.filter((step) => step.kind !== "-").length;
		output.push(
			`@@ -${range(oldStart, oldCount)} +${range(newStart, newCount)} @@`,
			...body.map((step) => `${step.kind}${step.line}`),
		);
		start = end + 1;
	}
	return output;
}

/** A hunk range as unified diff writes it: an empty side starts one line earlier. */
function range(start: number, count: number): string {
	return `${count === 0 ? start - 1 : start},${count}`;
}
