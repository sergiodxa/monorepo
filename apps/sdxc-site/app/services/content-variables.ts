/**
 * The numbers the site's copy quotes, counted from the package catalogue, the showcase and
 * the extractor's totals. It stays free of the markdown pipeline so the social cards, which
 * every request may reach, read the counts without loading it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readPackageFacts } from "~/app/services/packages";
import { listShowcase } from "~/app/services/showcase";

/**
 * The totals the extractor counts on disk beside the catalogues it reads, so a sentence
 * quoting them is counted from the same run that built their pages.
 */
const extractedCounts = import.meta.glob<{ utilities: number; components: number; rfcs: number }>(
	"../../resources/generated/counts.json",
	{ eager: true, import: "default" },
);

/**
 * Numbers the copy quotes, written as `{% $name %}` holes so a claim is counted. The
 * extractor's totals are absent until `bun run catalogue` has written them.
 */
export function contentVariables(): Record<string, string> {
	let facts = readPackageFacts();
	let extracted = Object.values(extractedCounts)[0];

	return {
		packageCount: String(facts.published),
		standaloneCount: String(facts.standalone),
		frameworkFreeCount: String(facts.frameworkFree),
		remixCount: String(facts.remixTargeted),
		applicationCount: String(listShowcase().length),
		...(extracted
			? {
					componentCount: String(extracted.components),
					utilityCount: String(extracted.utilities),
					rfcCount: String(extracted.rfcs),
				}
			: {}),
	};
}
