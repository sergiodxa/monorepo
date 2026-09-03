/**
 * People: the names a signup form receives, the job title an org chart shows,
 * and the whole person behind them. Phone numbers come from the range reserved
 * for fiction, so a generated number rings nobody.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset";
import type { Random } from "../random";

import type { InternetModule } from "./internet";
import type { PhoneModule } from "./phone";

/** Which list of given names to draw from. */
export type SexType = "female" | "male";

/** Options for a given name. */
export interface FirstNameOptions {
	/** Draws from one list rather than from both. */
	sex?: SexType;
}

/** Options for a full name, each part supplied or generated. */
export interface FullNameOptions {
	firstName?: string;
	lastName?: string;
	sex?: SexType;
	/** Opens the name with a title, such as `"Dr."`. */
	withPrefix?: boolean;
	/** Closes the name with a title, such as `"Jr."`. */
	withSuffix?: boolean;
}

/** A person whose address and handle match the name they belong to. */
export interface PersonRecord {
	firstName: string;
	lastName: string;
	fullName: string;
	email: string;
	username: string;
	sex: SexType;
	jobTitle: string;
	phone: string;
}

/** Names, titles, work, and the person that ties them together. */
export interface PersonModule {
	firstName(options?: FirstNameOptions): string;
	lastName(): string;
	/** A second given name, drawn like a first one. */
	middleName(options?: FirstNameOptions): string;
	/** A first and last name, joined, with optional titles around them. */
	fullName(options?: FullNameOptions): string;
	/** A title that opens a name, such as `"Dr."`. */
	prefix(): string;
	/** A title that closes a name, such as `"PhD"`. */
	suffix(): string;
	/** The word a sex is named by, as the dataset spells it. */
	sex(): string;
	/** Which list of given names a person is drawn from. */
	sexType(): SexType;
	/** A gender identity, from a wider list than {@link PersonModule.sex}. */
	gender(): string;
	/** A field of work, such as `"Infrastructure"`. */
	jobArea(): string;
	/** A word that qualifies a job title, such as `"Regional"`. */
	jobDescriptor(): string;
	/** A kind of role, such as `"Architect"`. */
	jobType(): string;
	/** A whole title: descriptor, area, and type. */
	jobTitle(): string;
	/** A one-line profile blurb. */
	bio(): string;
	zodiacSign(): string;
	/** A number in the range reserved for fictional use, written in full. */
	phone(): string;
	/** One person, consistent across every field. */
	record(): PersonRecord;
}

/** Create the `person` module over one stream, dataset, and address builder. */
export function createPersonModule(
	random: Random,
	data: Dataset,
	internet: InternetModule,
	phone: PhoneModule,
): PersonModule {
	function givenName(options: FirstNameOptions = {}): string {
		if (options.sex !== undefined) return random.pick(data.firstNames[options.sex]);
		return random.pick([...data.firstNames.female, ...data.firstNames.male]);
	}

	let person: PersonModule = {
		firstName: givenName,
		lastName() {
			return random.pick(data.lastNames);
		},
		middleName: givenName,
		fullName(options = {}) {
			let parts = [
				options.withPrefix === true ? person.prefix() : undefined,
				options.firstName ?? givenName({ sex: options.sex }),
				options.lastName ?? person.lastName(),
				options.withSuffix === true ? person.suffix() : undefined,
			];
			return parts.filter((part) => part !== undefined).join(" ");
		},
		prefix() {
			return random.pick(data.namePrefixes);
		},
		suffix() {
			return random.pick(data.nameSuffixes);
		},
		sex() {
			return random.pick(data.sexes);
		},
		sexType() {
			return random.bool() ? "female" : "male";
		},
		gender() {
			return random.pick(data.genders);
		},
		jobArea() {
			return random.pick(data.jobAreas);
		},
		jobDescriptor() {
			return random.pick(data.jobDescriptors);
		},
		jobType() {
			return random.pick(data.jobTypes);
		},
		jobTitle() {
			return `${person.jobDescriptor()} ${person.jobArea()} ${person.jobType()}`;
		},
		bio() {
			return `${random.pick(data.jobAreas)} ${random.pick(data.jobTypes)}, ${random.pick(data.hackerNouns)} ${random.pick(data.hackerIngverbs)}`;
		},
		zodiacSign() {
			return random.pick(data.zodiacSigns);
		},
		phone() {
			return phone.number({ style: "national" });
		},
		record() {
			let sex = person.sexType();
			let firstName = givenName({ sex });
			let lastName = person.lastName();
			return {
				firstName,
				lastName,
				fullName: `${firstName} ${lastName}`,
				email: internet.email({ firstName, lastName }),
				username: internet.username({ firstName, lastName }),
				sex,
				jobTitle: person.jobTitle(),
				phone: person.phone(),
			};
		},
	};

	return person;
}
