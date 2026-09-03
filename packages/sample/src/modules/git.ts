/**
 * Repository furniture: the branch names, hashes, and log entries a tool that
 * reads git has to be fed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset.js";
import type { Random } from "../random.js";

import type { DateModule } from "./date.js";
import type { InternetModule } from "./internet.js";
import type { PersonModule } from "./person.js";

/** How many hexadecimal characters a full commit hash carries. */
const SHA_LENGTH = 40;

/** Options for a commit hash. */
export interface ShaOptions {
	/** How many characters, 40 by default; 7 for the short form. */
	length?: number;
}

/** Branches, hashes, messages, and whole log entries. */
export interface GitModule {
	/** A branch name, such as `"parse-the-cursor"`. */
	branch(): string;
	/** A hexadecimal commit hash. */
	commitSha(options?: ShaOptions): string;
	/** A commit subject line, such as `"tighten the rate limit"`. */
	commitMessage(): string;
	/** A date in the format `git log` prints. */
	commitDate(): string;
	/** A whole log entry: hash, author, date, and message. */
	commitEntry(): string;
}

/** Create the `git` module over one stream, dataset, and the modules it reads. */
export function createGitModule(
	random: Random,
	data: Dataset,
	person: PersonModule,
	internet: InternetModule,
	dates: DateModule,
): GitModule {
	let git: GitModule = {
		branch() {
			let verb = random.pick(data.commitVerbs).replace(/\s+/g, "-");
			let object = random.pick(data.commitObjects).replace(/^the /, "").replace(/\s+/g, "-");
			return `${verb}-${object}`;
		},
		commitSha(options = {}) {
			let length = options.length ?? SHA_LENGTH;
			if (!Number.isSafeInteger(length) || length < 1) {
				throw new RangeError(`commitSha() needs a length of one or more, received ${length}.`);
			}
			return Array.from({ length }, () => random.int(0, 15).toString(16)).join("");
		},
		commitMessage() {
			return `${random.pick(data.commitVerbs)} ${random.pick(data.commitObjects)}`;
		},
		commitDate() {
			let when = dates.recent({ days: 30 });
			let day = data.weekdays[when.getUTCDay()] ?? "Mon";
			let month = data.months[when.getUTCMonth()] ?? "Jan";
			let time = when.toISOString().slice(11, 19);
			return `${day.slice(0, 3)} ${month.slice(0, 3)} ${when.getUTCDate()} ${when.getUTCFullYear()} ${time} +0000`;
		},
		commitEntry() {
			let firstName = person.firstName();
			let lastName = person.lastName();
			return [
				`commit ${git.commitSha()}`,
				`Author: ${firstName} ${lastName} <${internet.email({ firstName, lastName })}>`,
				`Date: ${git.commitDate()}`,
				"",
				`    ${git.commitMessage()}`,
				"",
			].join("\n");
		},
	};

	return git;
}
