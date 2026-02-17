import type { SelectSubject } from "~/db/schema";

import polar from "~/clients/polar";

export default class Customer {
	static async create(
		subject: Pick<SelectSubject, "id" | "emailAddress" | "displayName" | "username">,
	) {
		return await polar.customers.create({
			email: subject.emailAddress,
			name: subject.displayName,
			externalId: subject.id,
		});
	}

	static async findByEmail(email: string) {
		let customers = await polar.customers.list({ email: email });
		let customer = customers.result.items.at(0);
		if (customer) return customer;
		return null;
	}

	static async assignExternalId(id: string, externalId: string) {
		return await polar.customers.update({
			id: id,
			customerUpdate: { externalId },
		});
	}

	static async assignOrCreateExternalIdByEmail(
		email: string,
		subject: Pick<SelectSubject, "id" | "emailAddress" | "displayName" | "username">,
	) {
		let customer = await Customer.findByEmail(email);
		if (customer) {
			// Only assign external_id if the customer doesn't already have one
			// Polar doesn't allow updating external_id once set
			if (!customer.externalId) {
				return Customer.assignExternalId(customer.id, subject.id);
			}
			return customer;
		}
		return await Customer.create(subject);
	}
}
