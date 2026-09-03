/**
 * Places, from a country down to a unit number. A city can be asked for on its
 * own or from a named country, and the two stay consistent because the dataset
 * stores cities under the country they belong to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset.js";
import type { Random } from "../random.js";

/** How many of the eight compass points a direction is drawn from. */
const CARDINAL_COUNT = 4;

/** Degrees of latitude and longitude, for the coordinate helpers. */
const LATITUDE_LIMIT = 90;
const LONGITUDE_LIMIT = 180;

/** Kilometres per degree of latitude, close enough for a nearby coordinate. */
const KM_PER_DEGREE = 111.32;

/** Options for a generated city. */
export interface CityOptions {
	/** Restricts the city to one country, matched by its name in the dataset. */
	country?: string;
}

/** Options for a state name. */
export interface StateOptions {
	/** Returns the postal abbreviation rather than the full name. */
	abbreviated?: boolean;
}

/** Options for a coordinate. */
export interface CoordinateOptions {
	min?: number;
	max?: number;
	/** Digits kept after the point, 4 by default. */
	precision?: number;
}

/** Options for a coordinate near another one. */
export interface NearbyOptions {
	/** The point to stay near, as `[latitude, longitude]`. */
	origin: [number, number];
	/** How far the point may be, in kilometres. Defaults to 10. */
	radius?: number;
}

/** Countries, cities, streets, and coordinates. */
export interface LocationModule {
	/**
	 * A city, from `country` when one is named.
	 *
	 * @throws RangeError when the dataset carries no country by that name, so a
	 * typo surfaces instead of quietly returning a city from somewhere else.
	 */
	city(options?: CityOptions): string;
	country(): string;
	/** An ISO 3166-1 alpha-2 code, such as `"PT"`. */
	countryCode(): string;
	continent(): string;
	/** A first-level division, full name or postal abbreviation. */
	state(options?: StateOptions): string;
	county(): string;
	/** A street's name without its number, such as `"Juniper Lane"`. */
	street(): string;
	/** A number on a street, such as `"1402"`. */
	buildingNumber(): string;
	/** A number and a street, such as `"1402 Juniper Lane"`. */
	streetAddress(options?: { useFullAddress?: boolean }): string;
	/** A unit within a building, such as `"Apt. 12"`. */
	secondaryAddress(): string;
	/** A postal code, five digits. */
	zipCode(): string;
	/** A whole address on one line, internally consistent. */
	postalAddress(): string;
	/** One of the eight compass points. */
	direction(): string;
	/** North, east, south, or west. */
	cardinalDirection(): string;
	/** Northeast, northwest, southeast, or southwest. */
	ordinalDirection(): string;
	language(): string;
	/** An IANA time zone name, such as `"Europe/Madrid"`. */
	timeZone(): string;
	latitude(options?: CoordinateOptions): number;
	longitude(options?: CoordinateOptions): number;
	/** A point within `radius` kilometres of `origin`, as `[latitude, longitude]`. */
	nearbyGPSCoordinate(options: NearbyOptions): [number, number];
}

/** Create the `location` module over one stream and dataset. */
export function createLocationModule(random: Random, data: Dataset): LocationModule {
	function coordinate(limit: number, options: CoordinateOptions = {}): number {
		let min = options.min ?? -limit;
		let max = options.max ?? limit;
		return Number(random.float(min, max).toFixed(options.precision ?? 4));
	}

	let location: LocationModule = {
		city(options = {}) {
			if (options.country === undefined) {
				return random.pick(random.pick(data.countries).cities);
			}
			let country = data.countries.find((candidate) => candidate.name === options.country);
			if (country === undefined) {
				throw new RangeError(`city() found no country named "${options.country}" in the dataset.`);
			}
			return random.pick(country.cities);
		},
		country() {
			return random.pick(data.countries).name;
		},
		countryCode() {
			return random.pick(data.countries).code;
		},
		continent() {
			return random.pick(data.continents);
		},
		state(options = {}) {
			let state = random.pick(data.states);
			return options.abbreviated === true ? state.abbreviation : state.name;
		},
		county() {
			return random.pick(data.counties);
		},
		street() {
			return `${random.pick(data.streetNames)} ${random.pick(data.streetSuffixes)}`;
		},
		buildingNumber() {
			return String(random.int(1, 9999));
		},
		streetAddress(options = {}) {
			let base = `${location.buildingNumber()} ${location.street()}`;
			if (options.useFullAddress !== true) return base;
			return `${base} ${location.secondaryAddress()}`;
		},
		secondaryAddress() {
			return `${random.pick(data.secondaryAddressPrefixes)} ${random.int(1, 999)}`;
		},
		zipCode() {
			return String(random.int(10000, 99999));
		},
		postalAddress() {
			let country = random.pick(data.countries);
			let city = random.pick(country.cities);
			return `${location.streetAddress()}, ${city} ${location.zipCode()}, ${country.name}`;
		},
		direction() {
			return random.pick(data.directions);
		},
		cardinalDirection() {
			return random.pick(data.directions.slice(0, CARDINAL_COUNT));
		},
		ordinalDirection() {
			return random.pick(data.directions.slice(CARDINAL_COUNT));
		},
		language() {
			return random.pick(data.languages);
		},
		timeZone() {
			return random.pick(data.timeZones);
		},
		latitude(options) {
			return coordinate(LATITUDE_LIMIT, options);
		},
		longitude(options) {
			return coordinate(LONGITUDE_LIMIT, options);
		},
		nearbyGPSCoordinate(options) {
			let radius = options.radius ?? 10;
			let [originLatitude, originLongitude] = options.origin;
			let angle = random.float(0, 2 * Math.PI);
			let distance = random.float(0, radius) / KM_PER_DEGREE;
			let latitude = originLatitude + distance * Math.cos(angle);
			let scale = Math.cos((originLatitude * Math.PI) / 180) || 1;
			let longitude = originLongitude + (distance * Math.sin(angle)) / scale;
			return [
				Number(Math.max(-LATITUDE_LIMIT, Math.min(LATITUDE_LIMIT, latitude)).toFixed(4)),
				Number(Math.max(-LONGITUDE_LIMIT, Math.min(LONGITUDE_LIMIT, longitude)).toFixed(4)),
			];
		},
	};

	return location;
}
