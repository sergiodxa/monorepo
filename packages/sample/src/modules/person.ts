/**
 * People: the names a signup form receives, and the whole person behind them.
 * Phone numbers come from the range reserved for fiction, so a generated
 * number rings nobody.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset";
import type { Random } from "../random";

import type { InternetModule } from "./internet";

/** A person whose address and handle match the name they belong to. */
export interface PersonRecord {
	firstName: string;
	lastName: string;
	fullName: string;
	email: string;
	username: string;
}

/** Names, phone numbers, and the person that ties them together. */
export interface PersonModule {
	firstName(): string;
	lastName(): string;
	/** A first and last name, joined. */
	fullName(): string;
	/** A number in the `555-01xx` range reserved for fictional use. */
	phone(): string;
	/** One person, consistent across every field. */
	record(): PersonRecord;
}

/** Create the `person` module over one stream, dataset, and address builder. */
export function createPersonModule(
	random: Random,
	data: Dataset,
	internet: InternetModule,
): PersonModule {
	let person: PersonModule = {
		firstName() {
			return random.pick(data.firstNames);
		},
		lastName() {
			return random.pick(data.lastNames);
		},
		fullName() {
			return `${person.firstName()} ${person.lastName()}`;
		},
		phone() {
			return `+1 555-01${String(random.int(0, 99)).padStart(2, "0")}`;
		},
		record() {
			let firstName = person.firstName();
			let lastName = person.lastName();
			return {
				firstName,
				lastName,
				fullName: `${firstName} ${lastName}`,
				email: internet.email({ firstName, lastName }),
				username: internet.username({ firstName, lastName }),
			};
		},
	};

	return person;
}
