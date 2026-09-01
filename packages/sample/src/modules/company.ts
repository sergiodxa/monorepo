/**
 * Companies: a distinctive word and the word that closes the name, which is
 * enough to fill an organization field without reading as any real business.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset";
import type { Random } from "../random";

/** Company names. */
export interface CompanyModule {
	name(): string;
}

/** Create the `company` module over one stream and dataset. */
export function createCompanyModule(random: Random, data: Dataset): CompanyModule {
	return {
		name() {
			return `${random.pick(data.companyWords)} ${random.pick(data.companySuffixes)}`;
		},
	};
}
