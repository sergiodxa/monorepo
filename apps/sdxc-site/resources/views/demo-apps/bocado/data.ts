/**
 * Bocado's city: invented restaurants with their menus and option groups, the cuisines they
 * file under, the visitor's saved addresses and fake payment methods, and the orders already
 * delivered. Every screen reads these fixtures; nothing here names a real place or service.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppHref, demoAppStreamHref } from "~/resources/views/demo-apps";

/** The folder name the app is served under. */
export const SLUG = "bocado";

/** The address of a Bocado screen. */
export const href = demoAppHref(SLUG);

/** The address a Bocado form posts to. */
export const actionHref = demoAppActionHref(SLUG);

/** The address of a live part of a Bocado screen. */
export const streamHref = demoAppStreamHref(SLUG);

/** The dish a piece of food art draws, each an original flat illustration. */
export type Dish =
	| "taco"
	| "ramen"
	| "pizza"
	| "burger"
	| "bowl"
	| "dumpling"
	| "arepa"
	| "curry"
	| "pastry"
	| "icecream"
	| "chicken"
	| "falafel"
	| "drink"
	| "fries"
	| "coffee"
	| "cake";

/** A cuisine a restaurant files under, shown as a chip on home and search. */
export interface Cuisine {
	id: string;
	name: string;
	dish: Dish;
}

/** One pick inside an option group, with what it adds to the item's price. */
export interface Choice {
	/** Unique within its restaurant, so a cart line names a choice by its id alone. */
	id: string;
	name: string;
	/** In cents; `0` for a pick included in the price. */
	price: number;
}

/** A set of choices an item asks for: one required pick, or up to `max` optional extras. */
export interface OptionGroup {
	id: string;
	name: string;
	/** A required group takes exactly one pick and draws as radios. */
	required: boolean;
	/** How many picks an optional group allows. */
	max: number;
	choices: Choice[];
}

/** One dish on a menu. */
export interface MenuItem {
	id: string;
	name: string;
	description: string;
	/** In cents, before any choice. */
	price: number;
	dish: Dish;
	/** The option groups the item asks for, by id, in the order the dialog shows them. */
	groups: string[];
	popular?: boolean;
	/** A dietary tag, such as "Vegetarian" or "Spicy". */
	tag?: string;
}

/** A heading on a menu and the dishes under it. */
export interface MenuSection {
	id: string;
	name: string;
	items: MenuItem[];
}

/** One restaurant, its delivery terms and its whole menu. */
export interface Restaurant {
	id: string;
	name: string;
	/** The cuisine id the restaurant files under. */
	cuisine: string;
	/** A few words under the name. */
	blurb: string;
	/** The dish its hero and card draw. */
	dish: Dish;
	/** The hero's background and pattern colours. */
	tones: readonly [string, string];
	rating: number;
	reviews: number;
	/** The delivery estimate's range in minutes. */
	eta: readonly [number, number];
	/** The delivery fee in cents; `0` for free delivery. */
	fee: number;
	/** How far it is, in kilometres. */
	distance: number;
	/** One to three, drawn as `$`, `$$` or `$$$`. */
	price: 1 | 2 | 3;
	/** A promotion its card and hero carry. */
	promo?: string;
	/** Opens later today; it takes no orders until then. */
	opensAt?: string;
	street: string;
	/** Where it sits on the delivery map, in the map's 400 × 300 drawing. */
	at: readonly [number, number];
	groups: OptionGroup[];
	sections: MenuSection[];
}

/** A place the visitor has delivered to before. */
export interface Address {
	id: string;
	label: string;
	line: string;
	/** What the courier is told at the door. */
	note: string;
	/** Where it sits on the delivery map. */
	at: readonly [number, number];
}

/** A saved, invented way to pay; nothing here is or collects real card data. */
export interface PaymentMethod {
	id: string;
	label: string;
	detail: string;
	kind: "card" | "wallet" | "cash";
}

/** A dish in a cart or an order: the item, its picks and how many. */
export interface Line {
	item: string;
	/** Choice ids, in the order the item's groups ask for them. */
	choices: string[];
	qty: number;
}

/** A placed order, as the visitor's cookie or the seeded history keeps it. */
export interface Order {
	/** The order's record id. */
	id: string;
	restaurant: string;
	lines: Line[];
	/** When it was placed, in milliseconds since the epoch. */
	placedAt: number;
	/** The tip, as a percent of the subtotal. */
	tip: number;
	address: string;
	payment: string;
	priority: boolean;
}

/** One cuisine chip per kind of food the city serves. */
export const CUISINES: Cuisine[] = [
	{ id: "tacos", name: "Tacos", dish: "taco" },
	{ id: "noodles", name: "Noodles", dish: "ramen" },
	{ id: "pizza", name: "Pizza", dish: "pizza" },
	{ id: "burgers", name: "Burgers", dish: "burger" },
	{ id: "healthy", name: "Healthy", dish: "bowl" },
	{ id: "dumplings", name: "Dumplings", dish: "dumpling" },
	{ id: "arepas", name: "Arepas", dish: "arepa" },
	{ id: "curry", name: "Curry", dish: "curry" },
	{ id: "bakery", name: "Bakery", dish: "pastry" },
	{ id: "dessert", name: "Dessert", dish: "icecream" },
	{ id: "chicken", name: "Chicken", dish: "chicken" },
	{ id: "mezze", name: "Mezze", dish: "falafel" },
];

/** Builds a menu item; `groups` lists the option groups the dialog asks for. */
function item(
	id: string,
	name: string,
	description: string,
	price: number,
	dish: Dish,
	groups: string[] = [],
	extra: Partial<Pick<MenuItem, "popular" | "tag">> = {},
): MenuItem {
	return { id, name, description, price, dish, groups, ...extra };
}

/** A drink choice group most restaurants share, with ids scoped by a prefix. */
function drinks(prefix: string): OptionGroup {
	return {
		id: `${prefix}-drink`,
		name: "Add a drink",
		required: false,
		max: 2,
		choices: [
			{ id: `${prefix}-lime-soda`, name: "Lime soda", price: 250 },
			{ id: `${prefix}-hibiscus`, name: "Hibiscus iced tea", price: 300 },
			{ id: `${prefix}-water`, name: "Sparkling water", price: 200 },
		],
	};
}

/** Every restaurant in the demo's city. */
export const RESTAURANTS: Restaurant[] = [
	{
		id: "comal-y-cobre",
		name: "Comal y Cobre",
		cuisine: "tacos",
		blurb: "Hand-pressed tortillas off a copper comal",
		dish: "taco",
		tones: ["oklch(0.9 0.07 75)", "oklch(0.72 0.15 45)"],
		rating: 4.8,
		reviews: 2140,
		eta: [15, 25],
		fee: 0,
		distance: 1.2,
		price: 1,
		promo: "Free horchata over $20",
		street: "Calle Olmo 31",
		at: [96, 84],
		groups: [
			{
				id: "tortilla",
				name: "Tortilla",
				required: true,
				max: 1,
				choices: [
					{ id: "corn", name: "Blue corn", price: 0 },
					{ id: "flour", name: "Flour", price: 50 },
					{ id: "lettuce", name: "Lettuce wrap", price: 0 },
				],
			},
			{
				id: "salsa",
				name: "Salsa",
				required: true,
				max: 1,
				choices: [
					{ id: "verde", name: "Tomatillo verde", price: 0 },
					{ id: "roja", name: "Roasted roja", price: 0 },
					{ id: "habanero", name: "Habanero mango", price: 75 },
				],
			},
			{
				id: "taco-extras",
				name: "Extras",
				required: false,
				max: 3,
				choices: [
					{ id: "guac", name: "Guacamole", price: 150 },
					{ id: "queso", name: "Queso fresco", price: 100 },
					{ id: "onions", name: "Pickled onions", price: 50 },
					{ id: "chicharron", name: "Chicharrón crumble", price: 125 },
				],
			},
			drinks("cc"),
		],
		sections: [
			{
				id: "popular",
				name: "Popular",
				items: [
					item(
						"al-pastor",
						"Al pastor trio",
						"Spit-roasted pork, charred pineapple, cilantro and onion.",
						1150,
						"taco",
						["tortilla", "salsa", "taco-extras", "cc-drink"],
						{ popular: true },
					),
					item(
						"hongos",
						"Hongos trio",
						"Garlic oyster mushrooms, epazote, black beans and cotija.",
						1050,
						"taco",
						["tortilla", "salsa", "taco-extras", "cc-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
				],
			},
			{
				id: "tacos",
				name: "Tacos",
				items: [
					item(
						"carnitas",
						"Carnitas trio",
						"Slow-braised pork shoulder with orange and bay.",
						1150,
						"taco",
						["tortilla", "salsa", "taco-extras", "cc-drink"],
					),
					item(
						"pescado",
						"Baja fish trio",
						"Beer-battered hake, chipotle crema and lime slaw.",
						1290,
						"taco",
						["tortilla", "salsa", "taco-extras", "cc-drink"],
					),
					item(
						"birria",
						"Birria trio with consomé",
						"Chile-braised beef, melted cheese and a cup of broth to dip.",
						1390,
						"taco",
						["tortilla", "salsa", "cc-drink"],
						{ tag: "Spicy" },
					),
				],
			},
			{
				id: "sides",
				name: "Sides",
				items: [
					item(
						"elote",
						"Street corn",
						"Grilled cob, lime mayo, chile and cotija.",
						550,
						"fries",
						[],
						{ tag: "Vegetarian" },
					),
					item("chips", "Chips & guacamole", "Warm totopos and a generous bowl.", 690, "bowl"),
				],
			},
			{
				id: "drinks",
				name: "Drinks",
				items: [
					item("horchata", "Horchata", "Rice, cinnamon and vanilla, over ice.", 400, "drink"),
					item("jamaica", "Agua de jamaica", "Hibiscus and a little piloncillo.", 350, "drink"),
				],
			},
		],
	},
	{
		id: "lantern-noodle",
		name: "Lantern Noodle House",
		cuisine: "noodles",
		blurb: "Broths simmered overnight, noodles pulled to order",
		dish: "ramen",
		tones: ["oklch(0.88 0.05 30)", "oklch(0.55 0.16 25)"],
		rating: 4.7,
		reviews: 1832,
		eta: [25, 35],
		fee: 199,
		distance: 2.4,
		price: 2,
		street: "Riverside Walk 8",
		at: [292, 70],
		groups: [
			{
				id: "broth",
				name: "Broth",
				required: true,
				max: 1,
				choices: [
					{ id: "tonkotsu", name: "Rich pork bone", price: 0 },
					{ id: "shoyu", name: "Clear shoyu", price: 0 },
					{ id: "miso", name: "Red miso", price: 100 },
					{ id: "kombu", name: "Kombu & shiitake", price: 0 },
				],
			},
			{
				id: "firmness",
				name: "Noodle firmness",
				required: true,
				max: 1,
				choices: [
					{ id: "soft", name: "Soft", price: 0 },
					{ id: "regular", name: "Regular", price: 0 },
					{ id: "firm", name: "Firm", price: 0 },
				],
			},
			{
				id: "toppings",
				name: "Toppings",
				required: false,
				max: 4,
				choices: [
					{ id: "egg", name: "Jammy egg", price: 200 },
					{ id: "chashu", name: "Extra chashu", price: 350 },
					{ id: "corn-butter", name: "Corn & butter", price: 150 },
					{ id: "nori", name: "Nori", price: 75 },
					{ id: "chili-oil", name: "Chili oil", price: 50 },
				],
			},
			drinks("ln"),
		],
		sections: [
			{
				id: "ramen",
				name: "Ramen",
				items: [
					item(
						"lantern-bowl",
						"Lantern bowl",
						"Our house ramen: chashu, scallion, bamboo and a jammy egg.",
						1650,
						"ramen",
						["broth", "firmness", "toppings", "ln-drink"],
						{ popular: true },
					),
					item(
						"spicy-tantan",
						"Spicy tantan",
						"Sesame broth, chili pork mince and bok choy.",
						1590,
						"ramen",
						["firmness", "toppings", "ln-drink"],
						{ tag: "Spicy", popular: true },
					),
					item(
						"garden-shio",
						"Garden shio",
						"Light kombu broth with roasted squash and greens.",
						1450,
						"ramen",
						["firmness", "toppings", "ln-drink"],
						{ tag: "Vegan" },
					),
				],
			},
			{
				id: "small-plates",
				name: "Small plates",
				items: [
					item(
						"gyoza",
						"Pan-fried gyoza",
						"Six pork and cabbage dumplings with black vinegar.",
						790,
						"dumpling",
					),
					item(
						"karaage",
						"Karaage",
						"Ginger-soy fried chicken, lemon and kewpie.",
						890,
						"chicken",
						[],
						{ popular: true },
					),
					item("edamame", "Edamame", "Sea salt and yuzu zest.", 490, "bowl", [], {
						tag: "Vegan",
					}),
				],
			},
			{
				id: "sweets",
				name: "Sweets",
				items: [
					item("black-sesame", "Black sesame soft serve", "With a crisp tuile.", 550, "icecream"),
				],
			},
		],
	},
	{
		id: "forno-nove",
		name: "Forno Nove",
		cuisine: "pizza",
		blurb: "Blistered pies from a nine-hundred-degree oven",
		dish: "pizza",
		tones: ["oklch(0.9 0.05 95)", "oklch(0.6 0.17 30)"],
		rating: 4.6,
		reviews: 3105,
		eta: [20, 30],
		fee: 149,
		distance: 1.8,
		price: 2,
		promo: "20% off over $30",
		street: "Plaza Lumen 2",
		at: [182, 132],
		groups: [
			{
				id: "size",
				name: "Size",
				required: true,
				max: 1,
				choices: [
					{ id: "ten", name: '10" personal', price: 0 },
					{ id: "fourteen", name: '14" to share', price: 600 },
				],
			},
			{
				id: "crust",
				name: "Crust",
				required: true,
				max: 1,
				choices: [
					{ id: "classic", name: "Classic", price: 0 },
					{ id: "sourdough", name: "48-hour sourdough", price: 150 },
					{ id: "gluten-free", name: "Gluten free", price: 250 },
				],
			},
			{
				id: "pizza-extras",
				name: "Extra toppings",
				required: false,
				max: 4,
				choices: [
					{ id: "burrata", name: "Burrata", price: 350 },
					{ id: "nduja", name: "Nduja", price: 250 },
					{ id: "olives", name: "Olives", price: 125 },
					{ id: "hot-honey", name: "Hot honey", price: 100 },
					{ id: "basil", name: "Fresh basil", price: 0 },
				],
			},
			drinks("fn"),
		],
		sections: [
			{
				id: "pizze",
				name: "Pizze",
				items: [
					item(
						"margherita",
						"Margherita",
						"San Marzano tomato, fior di latte, basil, olive oil.",
						1300,
						"pizza",
						["size", "crust", "pizza-extras", "fn-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
					item(
						"diavola",
						"Diavola",
						"Spicy salami, chili, mozzarella and oregano.",
						1550,
						"pizza",
						["size", "crust", "pizza-extras", "fn-drink"],
						{ popular: true, tag: "Spicy" },
					),
					item(
						"bianca",
						"Funghi bianca",
						"Roasted mushrooms, thyme, ricotta and lemon.",
						1490,
						"pizza",
						["size", "crust", "pizza-extras", "fn-drink"],
						{ tag: "Vegetarian" },
					),
					item(
						"nove",
						"La Nove",
						"Nduja, burrata, hot honey and a crack of pepper.",
						1690,
						"pizza",
						["size", "crust", "fn-drink"],
					),
				],
			},
			{
				id: "antipasti",
				name: "Antipasti",
				items: [
					item(
						"garlic-knots",
						"Garlic knots",
						"Six knots, parmesan and a pot of marinara.",
						650,
						"pastry",
					),
					item(
						"caesar",
						"Little gem Caesar",
						"Anchovy dressing and sourdough crumbs.",
						890,
						"bowl",
					),
				],
			},
			{
				id: "dolci",
				name: "Dolci",
				items: [
					item("tiramisu", "Tiramisù", "Espresso-soaked savoiardi and mascarpone.", 750, "cake"),
				],
			},
		],
	},
	{
		id: "patty-theory",
		name: "Patty Theory",
		cuisine: "burgers",
		blurb: "Smashed thin, stacked high, toasted buns",
		dish: "burger",
		tones: ["oklch(0.9 0.08 90)", "oklch(0.5 0.12 40)"],
		rating: 4.5,
		reviews: 4290,
		eta: [15, 25],
		fee: 99,
		distance: 0.9,
		price: 1,
		street: "Market Row 14",
		at: [136, 196],
		groups: [
			{
				id: "patties",
				name: "Patties",
				required: true,
				max: 1,
				choices: [
					{ id: "single", name: "Single", price: 0 },
					{ id: "double", name: "Double", price: 300 },
					{ id: "triple", name: "Triple", price: 550 },
				],
			},
			{
				id: "burger-adds",
				name: "Add-ons",
				required: false,
				max: 4,
				choices: [
					{ id: "bacon", name: "Smoked bacon", price: 200 },
					{ id: "pickles", name: "Extra pickles", price: 0 },
					{ id: "jalapenos", name: "Jalapeños", price: 75 },
					{ id: "egg-fried", name: "Fried egg", price: 150 },
				],
			},
			{
				id: "side",
				name: "Make it a meal",
				required: false,
				max: 1,
				choices: [
					{ id: "fries-side", name: "Crinkle fries", price: 350 },
					{ id: "rings", name: "Onion rings", price: 400 },
				],
			},
		],
		sections: [
			{
				id: "burgers",
				name: "Burgers",
				items: [
					item(
						"theory",
						"The Theory",
						"Smashed beef, American cheese, onions, pickles, house sauce.",
						1090,
						"burger",
						["patties", "burger-adds", "side"],
						{ popular: true },
					),
					item(
						"mushroom-swiss",
						"Mushroom Swiss",
						"Seared mushrooms, Swiss cheese and garlic aioli.",
						1190,
						"burger",
						["patties", "burger-adds", "side"],
					),
					item(
						"garden",
						"Garden smash",
						"Black bean and beet patty, cheddar and slaw.",
						1050,
						"burger",
						["burger-adds", "side"],
						{ tag: "Vegetarian" },
					),
				],
			},
			{
				id: "fries",
				name: "Fries & sides",
				items: [
					item("crinkle", "Crinkle fries", "Seasoned salt.", 450, "fries", [], { popular: true }),
					item("loaded", "Loaded fries", "Cheese sauce, bacon bits and scallions.", 690, "fries"),
				],
			},
			{
				id: "shakes",
				name: "Shakes",
				items: [
					item("malted", "Malted vanilla shake", "Thick enough for a spoon.", 650, "icecream"),
				],
			},
		],
	},
	{
		id: "green-ledger",
		name: "Green Ledger",
		cuisine: "healthy",
		blurb: "Grain bowls and big salads, built your way",
		dish: "bowl",
		tones: ["oklch(0.93 0.05 140)", "oklch(0.58 0.12 150)"],
		rating: 4.6,
		reviews: 980,
		eta: [15, 20],
		fee: 0,
		distance: 0.7,
		price: 2,
		promo: "15% off your first bowl",
		street: "Calle Olmo 5",
		at: [70, 150],
		groups: [
			{
				id: "base",
				name: "Base",
				required: true,
				max: 1,
				choices: [
					{ id: "quinoa", name: "Warm quinoa", price: 0 },
					{ id: "rice", name: "Brown rice", price: 0 },
					{ id: "greens", name: "Mixed greens", price: 0 },
				],
			},
			{
				id: "protein",
				name: "Protein",
				required: true,
				max: 1,
				choices: [
					{ id: "tofu", name: "Sesame tofu", price: 0 },
					{ id: "chicken-thigh", name: "Herb chicken", price: 200 },
					{ id: "salmon", name: "Roast salmon", price: 400 },
				],
			},
			{
				id: "dressing",
				name: "Dressing",
				required: false,
				max: 1,
				choices: [
					{ id: "tahini", name: "Lemon tahini", price: 0 },
					{ id: "miso-ginger", name: "Miso ginger", price: 0 },
					{ id: "green-goddess", name: "Green goddess", price: 0 },
				],
			},
		],
		sections: [
			{
				id: "bowls",
				name: "Bowls",
				items: [
					item(
						"harvest",
						"Harvest bowl",
						"Roast squash, kale, pickled shallot and toasted seeds.",
						1290,
						"bowl",
						["base", "protein", "dressing"],
						{ popular: true },
					),
					item(
						"glow",
						"Glow bowl",
						"Avocado, cucumber, edamame, radish and furikake.",
						1350,
						"bowl",
						["base", "protein", "dressing"],
						{ tag: "Vegan" },
					),
				],
			},
			{
				id: "juices",
				name: "Juices",
				items: [
					item("greens-juice", "Green press", "Apple, celery, spinach and ginger.", 650, "drink"),
					item("citrus", "Sunrise", "Orange, carrot and turmeric.", 650, "drink"),
				],
			},
		],
	},
	{
		id: "dumpling-parade",
		name: "Dumpling Parade",
		cuisine: "dumplings",
		blurb: "Pleated by hand, steamed or pan-fried",
		dish: "dumpling",
		tones: ["oklch(0.93 0.03 60)", "oklch(0.55 0.14 160)"],
		rating: 4.9,
		reviews: 1264,
		eta: [25, 40],
		fee: 249,
		distance: 3.1,
		price: 2,
		street: "Lantern Lane 40",
		at: [330, 150],
		groups: [
			{
				id: "cook",
				name: "Cooked",
				required: true,
				max: 1,
				choices: [
					{ id: "steamed", name: "Steamed", price: 0 },
					{ id: "pan-fried", name: "Pan-fried", price: 100 },
				],
			},
			{
				id: "count",
				name: "How many",
				required: true,
				max: 1,
				choices: [
					{ id: "eight", name: "Eight", price: 0 },
					{ id: "twelve", name: "Twelve", price: 450 },
				],
			},
			{
				id: "dips",
				name: "Dips",
				required: false,
				max: 2,
				choices: [
					{ id: "black-vinegar", name: "Black vinegar & ginger", price: 0 },
					{ id: "chili-crisp", name: "Chili crisp", price: 100 },
					{ id: "sesame-soy", name: "Sesame soy", price: 0 },
				],
			},
		],
		sections: [
			{
				id: "dumplings",
				name: "Dumplings",
				items: [
					item(
						"pork-chive",
						"Pork & chive",
						"The classic, juicy and bright.",
						990,
						"dumpling",
						["cook", "count", "dips"],
						{ popular: true },
					),
					item(
						"shrimp",
						"Shrimp & bamboo",
						"Translucent wrappers, sweet shrimp.",
						1190,
						"dumpling",
						["cook", "count", "dips"],
					),
					item(
						"veg",
						"Mushroom & cabbage",
						"Three mushrooms, napa cabbage and glass noodles.",
						950,
						"dumpling",
						["cook", "count", "dips"],
						{ tag: "Vegan" },
					),
				],
			},
			{
				id: "noodles",
				name: "Noodles",
				items: [
					item(
						"dan-dan",
						"Dan dan noodles",
						"Peanut, chili oil and minced pork.",
						1190,
						"ramen",
						[],
						{ tag: "Spicy", popular: true },
					),
				],
			},
		],
	},
	{
		id: "arepa-alta",
		name: "Arepa Alta",
		cuisine: "arepas",
		blurb: "Griddled corn cakes split and stuffed",
		dish: "arepa",
		tones: ["oklch(0.93 0.07 95)", "oklch(0.6 0.13 60)"],
		rating: 4.7,
		reviews: 742,
		eta: [20, 30],
		fee: 149,
		distance: 1.5,
		price: 1,
		street: "Calle Ceiba 19",
		at: [214, 230],
		groups: [
			{
				id: "arepa-cheese",
				name: "Cheese",
				required: true,
				max: 1,
				choices: [
					{ id: "blanco", name: "Queso blanco", price: 0 },
					{ id: "guayanes", name: "Soft guayanés", price: 100 },
					{ id: "no-cheese", name: "No cheese", price: 0 },
				],
			},
			{
				id: "arepa-adds",
				name: "Extras",
				required: false,
				max: 3,
				choices: [
					{ id: "avocado", name: "Avocado", price: 150 },
					{ id: "plantain", name: "Sweet plantain", price: 125 },
					{ id: "black-beans", name: "Black beans", price: 75 },
				],
			},
		],
		sections: [
			{
				id: "arepas",
				name: "Arepas",
				items: [
					item(
						"reina",
						"Reina pepiada",
						"Chicken and avocado salad, the classic.",
						950,
						"arepa",
						["arepa-cheese", "arepa-adds"],
						{ popular: true },
					),
					item(
						"pabellon",
						"Pabellón",
						"Shredded beef, black beans, plantain and cheese.",
						1050,
						"arepa",
						["arepa-cheese", "arepa-adds"],
						{ popular: true },
					),
					item(
						"domino",
						"Dominó",
						"Black beans and white cheese.",
						850,
						"arepa",
						["arepa-cheese", "arepa-adds"],
						{ tag: "Vegetarian" },
					),
				],
			},
			{
				id: "sides",
				name: "Sides",
				items: [
					item("tequenos", "Tequeños", "Five cheese sticks wrapped in dough.", 690, "fries"),
					item("papelon", "Papelón con limón", "Raw cane sugar and lime.", 350, "drink"),
				],
			},
		],
	},
	{
		id: "saffron-steps",
		name: "Saffron Steps",
		cuisine: "curry",
		blurb: "Slow curries, tandoor breads and chutneys",
		dish: "curry",
		tones: ["oklch(0.9 0.08 80)", "oklch(0.58 0.16 50)"],
		rating: 4.8,
		reviews: 1508,
		eta: [30, 45],
		fee: 199,
		distance: 3.6,
		price: 2,
		promo: "Free naan over $25",
		street: "Hillcrest Road 77",
		at: [352, 236],
		groups: [
			{
				id: "heat",
				name: "Heat",
				required: true,
				max: 1,
				choices: [
					{ id: "mild", name: "Mild", price: 0 },
					{ id: "medium", name: "Medium", price: 0 },
					{ id: "hot", name: "Hot", price: 0 },
				],
			},
			{
				id: "bread",
				name: "With",
				required: true,
				max: 1,
				choices: [
					{ id: "basmati", name: "Saffron basmati", price: 0 },
					{ id: "naan", name: "Butter naan", price: 150 },
					{ id: "both", name: "Rice and naan", price: 300 },
				],
			},
		],
		sections: [
			{
				id: "curries",
				name: "Curries",
				items: [
					item(
						"butter-chicken",
						"Butter chicken",
						"Tandoor chicken in a tomato and fenugreek gravy.",
						1590,
						"curry",
						["heat", "bread"],
						{ popular: true },
					),
					item(
						"chana",
						"Chana masala",
						"Chickpeas, tomato and amchur.",
						1290,
						"curry",
						["heat", "bread"],
						{ tag: "Vegan" },
					),
					item(
						"lamb-rogan",
						"Lamb rogan josh",
						"Kashmiri chili and a long braise.",
						1790,
						"curry",
						["heat", "bread"],
						{ tag: "Spicy" },
					),
				],
			},
			{
				id: "breads",
				name: "Breads",
				items: [
					item("garlic-naan", "Garlic naan", "Brushed with ghee and cilantro.", 390, "pastry"),
				],
			},
			{
				id: "drinks",
				name: "Drinks",
				items: [item("lassi", "Mango lassi", "Alphonso mango and yogurt.", 450, "drink")],
			},
		],
	},
	{
		id: "little-crumb",
		name: "Little Crumb",
		cuisine: "bakery",
		blurb: "Morning pastries, loaves and good coffee",
		dish: "pastry",
		tones: ["oklch(0.93 0.04 70)", "oklch(0.55 0.08 55)"],
		rating: 4.9,
		reviews: 655,
		eta: [10, 20],
		fee: 99,
		distance: 0.5,
		price: 1,
		street: "Calle Olmo 2",
		at: [52, 110],
		groups: [
			{
				id: "milk",
				name: "Milk",
				required: true,
				max: 1,
				choices: [
					{ id: "whole", name: "Whole", price: 0 },
					{ id: "oat", name: "Oat", price: 75 },
					{ id: "none", name: "No milk", price: 0 },
				],
			},
			{
				id: "shots",
				name: "Extra",
				required: false,
				max: 2,
				choices: [
					{ id: "extra-shot", name: "Extra shot", price: 100 },
					{ id: "vanilla", name: "Vanilla syrup", price: 75 },
				],
			},
		],
		sections: [
			{
				id: "pastries",
				name: "Pastries",
				items: [
					item(
						"croissant",
						"Butter croissant",
						"Seventy-two hour laminated dough.",
						425,
						"pastry",
						[],
						{ popular: true },
					),
					item("cardamom", "Cardamom bun", "Knotted and glazed.", 475, "pastry", [], {
						popular: true,
					}),
					item("loaf-cake", "Lemon poppy loaf", "A thick slice.", 450, "cake"),
				],
			},
			{
				id: "coffee",
				name: "Coffee",
				items: [
					item("flat-white", "Flat white", "Double ristretto.", 450, "coffee", ["milk", "shots"]),
					item("cold-brew", "Cold brew", "Steeped for eighteen hours.", 475, "coffee", ["shots"]),
				],
			},
		],
	},
	{
		id: "cold-spoon",
		name: "Cold Spoon",
		cuisine: "dessert",
		blurb: "Small-batch ice cream and sundaes",
		dish: "icecream",
		tones: ["oklch(0.93 0.05 350)", "oklch(0.62 0.15 350)"],
		rating: 4.8,
		reviews: 1120,
		eta: [15, 25],
		fee: 149,
		distance: 1.9,
		price: 1,
		opensAt: "4:00 PM",
		street: "Plaza Lumen 9",
		at: [196, 104],
		groups: [
			{
				id: "scoops",
				name: "Scoops",
				required: true,
				max: 1,
				choices: [
					{ id: "pint", name: "Pint", price: 0 },
					{ id: "quart", name: "Quart", price: 700 },
				],
			},
		],
		sections: [
			{
				id: "pints",
				name: "Pints",
				items: [
					item(
						"brown-butter",
						"Brown butter pecan",
						"Toasted pecans in a nutty base.",
						950,
						"icecream",
						["scoops"],
						{ popular: true },
					),
					item("strawberry", "Roasted strawberry", "With a balsamic swirl.", 950, "icecream", [
						"scoops",
					]),
				],
			},
		],
	},
	{
		id: "ember-rotisserie",
		name: "Ember Rotisserie",
		cuisine: "chicken",
		blurb: "Charcoal chicken, green sauce, crisp potatoes",
		dish: "chicken",
		tones: ["oklch(0.9 0.06 60)", "oklch(0.5 0.14 35)"],
		rating: 4.6,
		reviews: 2210,
		eta: [20, 30],
		fee: 0,
		distance: 2.0,
		price: 2,
		promo: "Free potatoes over $25",
		street: "Market Row 3",
		at: [160, 244],
		groups: [
			{
				id: "portion",
				name: "Portion",
				required: true,
				max: 1,
				choices: [
					{ id: "quarter", name: "Quarter", price: 0 },
					{ id: "half", name: "Half", price: 500 },
					{ id: "whole-bird", name: "Whole", price: 1300 },
				],
			},
			{
				id: "sauces",
				name: "Sauces",
				required: false,
				max: 2,
				choices: [
					{ id: "aji", name: "Ají verde", price: 0 },
					{ id: "garlic-toum", name: "Garlic toum", price: 0 },
					{ id: "peri", name: "Smoky peri", price: 50 },
				],
			},
		],
		sections: [
			{
				id: "chicken",
				name: "Chicken",
				items: [
					item(
						"rotisserie",
						"Charcoal chicken",
						"Brined, rubbed and turned over embers.",
						990,
						"chicken",
						["portion", "sauces"],
						{ popular: true },
					),
				],
			},
			{
				id: "sides",
				name: "Sides",
				items: [
					item("smashed", "Crispy potatoes", "Smashed, fried and salted.", 550, "fries", [], {
						popular: true,
					}),
					item("slaw", "Lime slaw", "Cabbage, carrot and cilantro.", 450, "bowl"),
				],
			},
		],
	},
	{
		id: "pita-parlor",
		name: "Pita Parlor",
		cuisine: "mezze",
		blurb: "Falafel, hummus and puffed pita off the stone",
		dish: "falafel",
		tones: ["oklch(0.92 0.05 110)", "oklch(0.55 0.11 130)"],
		rating: 4.7,
		reviews: 890,
		eta: [20, 35],
		fee: 149,
		distance: 2.7,
		price: 1,
		street: "Hillcrest Road 12",
		at: [262, 188],
		groups: [
			{
				id: "wrap",
				name: "Serve it as",
				required: true,
				max: 1,
				choices: [
					{ id: "pita", name: "Stuffed pita", price: 0 },
					{ id: "plate", name: "Plate with salad", price: 300 },
				],
			},
			{
				id: "mezze-adds",
				name: "Extras",
				required: false,
				max: 3,
				choices: [
					{ id: "halloumi", name: "Grilled halloumi", price: 250 },
					{ id: "pickles-turnip", name: "Pink pickles", price: 50 },
					{ id: "amba", name: "Amba", price: 50 },
				],
			},
		],
		sections: [
			{
				id: "pitas",
				name: "Pitas",
				items: [
					item(
						"falafel-pita",
						"Falafel pita",
						"Herby falafel, tahini, salad and pickles.",
						990,
						"falafel",
						["wrap", "mezze-adds"],
						{ popular: true, tag: "Vegan" },
					),
					item(
						"sabich",
						"Sabich",
						"Fried eggplant, egg, potato and amba.",
						1050,
						"falafel",
						["wrap", "mezze-adds"],
						{ tag: "Vegetarian" },
					),
				],
			},
			{
				id: "mezze",
				name: "Mezze",
				items: [
					item("hummus", "Hummus with pine nuts", "Warm pita on the side.", 790, "bowl", [], {
						popular: true,
					}),
				],
			},
		],
	},
];

/** The visitor's saved addresses; the first is where Bocado delivers until they pick. */
export const ADDRESSES: Address[] = [
	{
		id: "home",
		label: "Home",
		line: "Calle Ceiba 48, Apt 3B",
		note: "Ring 3B, then the second door on the left.",
		at: [188, 178],
	},
	{
		id: "studio",
		label: "Studio",
		line: "Riverside Walk 21, Floor 2",
		note: "Leave it at reception.",
		at: [250, 92],
	},
	{
		id: "parents",
		label: "Mamá's",
		line: "Hillcrest Road 90",
		note: "Blue gate, the dog is friendly.",
		at: [318, 262],
	},
];

/** The visitor's saved, invented payment methods. */
export const PAYMENT_METHODS: PaymentMethod[] = [
	{ id: "everyday", label: "Everyday card", detail: "Credit ending 4417", kind: "card" },
	{ id: "work", label: "Work card", detail: "Debit ending 9032", kind: "card" },
	{ id: "wallet", label: "Bocado balance", detail: "$18.40 available", kind: "wallet" },
	{ id: "cash", label: "Cash on delivery", detail: "The courier carries change", kind: "cash" },
];

/** The tips a visitor can add, as percents of the subtotal. */
export const TIPS = [0, 10, 15, 20] as const;

/** What priority delivery adds, in cents, for a courier who goes straight to the door. */
export const PRIORITY_FEE = 249;

/** The service fee as a fraction of the subtotal, with its floor in cents. */
export const SERVICE_RATE = 0.08;

/** The smallest service fee, in cents. */
export const SERVICE_MIN = 99;

/** One day, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The orders the visitor placed before the demo opened, each delivered days ago. They are
 * placed relative to `now`, so the history always reads "3 days ago" whenever it is opened.
 *
 * @param now The current time, in milliseconds since the epoch.
 */
export function pastOrders(now: number): Order[] {
	return [
		{
			id: "0190f2a1-6c3e-7b10-9c52-3a8e4f6d2b01",
			restaurant: "lantern-noodle",
			lines: [
				{ item: "lantern-bowl", choices: ["tonkotsu", "firm", "egg", "chili-oil"], qty: 2 },
				{ item: "gyoza", choices: [], qty: 1 },
			],
			placedAt: now - 2 * DAY_MS - 3 * 60 * 60 * 1000,
			tip: 15,
			address: "home",
			payment: "everyday",
			priority: false,
		},
		{
			id: "0190e8c4-2f71-7d4a-8b03-5e1c9a7f4d02",
			restaurant: "comal-y-cobre",
			lines: [
				{ item: "al-pastor", choices: ["corn", "verde", "guac"], qty: 1 },
				{ item: "hongos", choices: ["corn", "roja"], qty: 1 },
				{ item: "horchata", choices: [], qty: 2 },
			],
			placedAt: now - 6 * DAY_MS - 5 * 60 * 60 * 1000,
			tip: 10,
			address: "studio",
			payment: "work",
			priority: true,
		},
		{
			id: "0190d1b7-9a28-7e65-a4f1-7c2d8b3e6f03",
			restaurant: "little-crumb",
			lines: [
				{ item: "croissant", choices: [], qty: 2 },
				{ item: "flat-white", choices: ["oat", "extra-shot"], qty: 1 },
			],
			placedAt: now - 13 * DAY_MS - 2 * 60 * 60 * 1000,
			tip: 20,
			address: "home",
			payment: "wallet",
			priority: false,
		},
	];
}

/** Looks a restaurant up by id. */
export function findRestaurant(id: string): Restaurant | undefined {
	return RESTAURANTS.find((restaurant) => restaurant.id === id);
}

/** Looks a cuisine up by id. */
export function findCuisine(id: string): Cuisine | undefined {
	return CUISINES.find((cuisine) => cuisine.id === id);
}

/** Looks a saved address up by id. */
export function findAddress(id: string): Address | undefined {
	return ADDRESSES.find((address) => address.id === id);
}

/** Looks a payment method up by id. */
export function findPayment(id: string): PaymentMethod | undefined {
	return PAYMENT_METHODS.find((method) => method.id === id);
}

/** Every dish a restaurant serves, in menu order. */
export function menuItems(restaurant: Restaurant): MenuItem[] {
	return restaurant.sections.flatMap((section) => section.items);
}

/** Looks a dish up on a restaurant's menu. */
export function findItem(restaurant: Restaurant, id: string): MenuItem | undefined {
	return menuItems(restaurant).find((entry) => entry.id === id);
}

/** The option groups an item asks for, in its order. */
export function itemGroups(restaurant: Restaurant, entry: MenuItem): OptionGroup[] {
	return entry.groups
		.map((id) => restaurant.groups.find((group) => group.id === id))
		.filter((group): group is OptionGroup => group !== undefined);
}

/** Looks a choice up across a restaurant's groups. */
export function findChoice(restaurant: Restaurant, id: string): Choice | undefined {
	for (let group of restaurant.groups) {
		let choice = group.choices.find((entry) => entry.id === id);
		if (choice !== undefined) return choice;
	}
	return undefined;
}

/**
 * Formats cents as dollars with two decimals.
 *
 * @example money(1150) // "$11.50"
 */
export function money(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

/**
 * A restaurant's delivery fee as its card says it.
 *
 * @example deliveryFee(restaurant) // "$1.99 delivery" or "Free delivery"
 */
export function deliveryFee(restaurant: Restaurant): string {
	return restaurant.fee === 0 ? "Free delivery" : `${money(restaurant.fee)} delivery`;
}

/** A restaurant's delivery estimate, such as "15–25 min". */
export function etaLabel(restaurant: Restaurant): string {
	return `${restaurant.eta[0]}–${restaurant.eta[1]} min`;
}

/** A review count as its card prints it, such as "2.1k". */
export function reviewCount(count: number): string {
	return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(count);
}

/** The sorts the search screen offers, by their address value. */
export const SORTS = {
	relevance: "Recommended",
	fastest: "Fastest delivery",
	rating: "Top rated",
	fee: "Lowest delivery fee",
	distance: "Nearest",
} as const;

/** A sort the search screen offers. */
export type Sort = keyof typeof SORTS;

/** What the search screen filters by, as its address carries them. */
export interface SearchQuery {
	q: string;
	cuisine?: Cuisine;
	sort: Sort;
	/** Only restaurants with free delivery. */
	freeDelivery: boolean;
	/** The lowest rating shown, such as 4.5; `0` for any. */
	rating: number;
	/** Only restaurants that deliver within 30 minutes at most. */
	fast: boolean;
	/** Only restaurants taking orders now. */
	open: boolean;
	/** The most `$` signs shown; `3` for any. */
	price: number;
}

/**
 * Reads the search screen's filters from its address. Unknown values read as unfiltered, so
 * a tampered address shows more rather than failing.
 *
 * @param params The address's query.
 */
export function readSearch(params: URLSearchParams): SearchQuery {
	let sort = params.get("sort") ?? "relevance";
	let rating = Number(params.get("rating") ?? "0");
	let price = Number(params.get("price") ?? "3");
	return {
		q: (params.get("q") ?? "").trim(),
		cuisine: findCuisine(params.get("cuisine") ?? ""),
		sort: Object.hasOwn(SORTS, sort) ? (sort as Sort) : "relevance",
		freeDelivery: params.get("free") === "1",
		rating: [4, 4.5, 4.8].includes(rating) ? rating : 0,
		fast: params.get("fast") === "1",
		open: params.get("open") === "1",
		price: [1, 2].includes(price) ? price : 3,
	};
}

/** The text a restaurant is searched by: its name, cuisine, blurb and every dish. */
function searchText(restaurant: Restaurant): string {
	return [
		restaurant.name,
		findCuisine(restaurant.cuisine)?.name ?? "",
		restaurant.blurb,
		...menuItems(restaurant).flatMap((entry) => [entry.name, entry.description, entry.tag ?? ""]),
	]
		.join(" ")
		.toLowerCase();
}

/**
 * The restaurants a search shows, filtered then sorted. A query ranks a restaurant whose
 * name matches before one matched by a dish, and "Recommended" keeps that rank, then rating.
 *
 * @param query The search screen's filters.
 */
export function searchRestaurants(query: SearchQuery): Restaurant[] {
	let words = query.q.toLowerCase().split(/\s+/).filter(Boolean);
	let found = RESTAURANTS.filter(
		(restaurant) =>
			words.every((word) => searchText(restaurant).includes(word)) &&
			(query.cuisine === undefined || restaurant.cuisine === query.cuisine.id) &&
			(!query.freeDelivery || restaurant.fee === 0) &&
			restaurant.rating >= query.rating &&
			(!query.fast || restaurant.eta[1] <= 30) &&
			(!query.open || restaurant.opensAt === undefined) &&
			restaurant.price <= query.price,
	);
	let nameRank = (restaurant: Restaurant) =>
		words.length > 0 && words.every((word) => restaurant.name.toLowerCase().includes(word)) ? 0 : 1;
	let compare: Record<Sort, (a: Restaurant, b: Restaurant) => number> = {
		relevance: (a, b) => nameRank(a) - nameRank(b) || b.rating - a.rating,
		fastest: (a, b) => a.eta[0] - b.eta[0] || a.eta[1] - b.eta[1],
		rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
		fee: (a, b) => a.fee - b.fee || a.eta[0] - b.eta[0],
		distance: (a, b) => a.distance - b.distance,
	};
	return found.sort(compare[query.sort]);
}

/**
 * The dishes in a search that match the query by name, so a search for "dumpling" also lists
 * the dishes themselves under the restaurants that serve them.
 *
 * @param q The search text.
 */
export function searchDishes(q: string): Array<{ restaurant: Restaurant; item: MenuItem }> {
	let words = q.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	return RESTAURANTS.flatMap((restaurant) =>
		menuItems(restaurant)
			.filter((entry) => words.every((word) => entry.name.toLowerCase().includes(word)))
			.map((entry) => ({ restaurant, item: entry })),
	).slice(0, 8);
}
