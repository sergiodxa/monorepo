/**
 * Companies: a name, and the marketing language around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset";
import type { Random } from "../random";

/** Company names and the phrases a company writes about itself. */
export interface CompanyModule {
	/** A distinctive word and a closing word, joined. */
	name(): string;
	/** A slogan: adjective, descriptor, and noun. */
	catchPhrase(): string;
	catchPhraseAdjective(): string;
	catchPhraseDescriptor(): string;
	catchPhraseNoun(): string;
	/** A sentence of business jargon: verb, adjective, and noun. */
	buzzPhrase(): string;
	buzzAdjective(): string;
	buzzNoun(): string;
	buzzVerb(): string;
}

/** Create the `company` module over one stream and dataset. */
export function createCompanyModule(random: Random, data: Dataset): CompanyModule {
	let company: CompanyModule = {
		name() {
			return `${random.pick(data.companyWords)} ${random.pick(data.companySuffixes)}`;
		},
		catchPhrase() {
			return `${company.catchPhraseAdjective()} ${company.catchPhraseDescriptor()} ${company.catchPhraseNoun()}`;
		},
		catchPhraseAdjective() {
			return random.pick(data.catchPhraseAdjectives);
		},
		catchPhraseDescriptor() {
			return random.pick(data.catchPhraseDescriptors);
		},
		catchPhraseNoun() {
			return random.pick(data.catchPhraseNouns);
		},
		buzzPhrase() {
			return `${company.buzzVerb()} ${company.buzzAdjective()} ${company.buzzNoun()}`;
		},
		buzzAdjective() {
			return random.pick(data.buzzAdjectives);
		},
		buzzNoun() {
			return random.pick(data.buzzNouns);
		},
		buzzVerb() {
			return random.pick(data.buzzVerbs);
		},
	};

	return company;
}
