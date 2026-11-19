/**
 * Bocado's Buenos Aires: invented restaurants on real Palermo streets with their menus and
 * option groups, the cuisines they file under, the visitor's saved addresses and fake payment
 * methods, and the orders already delivered. Every screen reads these fixtures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatAmount } from "@sdxc/money";

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
	| "empanada"
	| "steak"
	| "choripan"
	| "provoleta"
	| "milanesa"
	| "pizza"
	| "pasta"
	| "ramen"
	| "sushi"
	| "ceviche"
	| "paella"
	| "tart"
	| "croqueta"
	| "burger"
	| "bowl"
	| "dumpling"
	| "chicken"
	| "pastry"
	| "alfajor"
	| "icecream"
	| "flan"
	| "cake"
	| "drink"
	| "fries"
	| "coffee"
	| "mate";

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
	/** Where it sits, as longitude and latitude on a street in Palermo or Villa Crespo, Buenos Aires. */
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
	/** Where it sits, as longitude and latitude on the street in front of the door. */
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
	{ id: "empanadas", name: "Empanadas", dish: "empanada" },
	{ id: "parrilla", name: "Parrilla", dish: "steak" },
	{ id: "pizza", name: "Pizza", dish: "pizza" },
	{ id: "pasta", name: "Pasta", dish: "pasta" },
	{ id: "cafe", name: "Café", dish: "pastry" },
	{ id: "helado", name: "Helado", dish: "icecream" },
	{ id: "veggie", name: "Veggie", dish: "tart" },
	{ id: "japanese", name: "Japanese", dish: "sushi" },
	{ id: "peruvian", name: "Peruvian", dish: "ceviche" },
	{ id: "korean", name: "Korean", dish: "chicken" },
	{ id: "burgers", name: "Burgers", dish: "burger" },
	{ id: "spanish", name: "Spanish", dish: "paella" },
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
			{ id: `${prefix}-lemonade`, name: "Mint & ginger lemonade", price: 300 },
			{ id: `${prefix}-pomelo`, name: "Grapefruit soda", price: 250 },
			{ id: `${prefix}-water`, name: "Sparkling water", price: 200 },
		],
	};
}

/** Every restaurant in the demo's city. */
export const RESTAURANTS: Restaurant[] = [
	{
		id: "tres-empanadas",
		name: "Tres Empanadas",
		cuisine: "empanadas",
		blurb: "Order three, as one does, folded by hand and baked in a clay oven",
		dish: "empanada",
		tones: ["oklch(0.91 0.07 80)", "oklch(0.66 0.14 55)"],
		rating: 4.8,
		reviews: 2140,
		eta: [15, 25],
		fee: 0,
		distance: 0.4,
		price: 1,
		promo: "Free alfajor over $20",
		street: "Thames 1742",
		at: [-58.43102, -34.58798],
		groups: [
			{
				id: "bake",
				name: "Cooked",
				required: true,
				max: 1,
				choices: [
					{ id: "horno", name: "Baked in the clay oven", price: 0 },
					{ id: "frita", name: "Fried", price: 50 },
				],
			},
			{
				id: "dip",
				name: "Sauce",
				required: true,
				max: 1,
				choices: [
					{ id: "chimi", name: "Chimichurri", price: 0 },
					{ id: "criolla", name: "Salsa criolla", price: 0 },
					{ id: "picante", name: "Hot ají", price: 75 },
				],
			},
			{
				id: "empanada-adds",
				name: "Add one more",
				required: false,
				max: 3,
				choices: [
					{ id: "humita-add", name: "Humita", price: 150 },
					{ id: "caprese-add", name: "Caprese", price: 150 },
					{ id: "verdura-add", name: "Spinach & ricotta", price: 125 },
					{ id: "jyq-add", name: "Ham & cheese", price: 125 },
				],
			},
			drinks("lr"),
		],
		sections: [
			{
				id: "popular",
				name: "Popular",
				items: [
					item(
						"cuchillo",
						"Hand-cut beef trio",
						"Knife-cut beef, spring onion, egg and a green olive, the Salta way.",
						1150,
						"empanada",
						["bake", "dip", "empanada-adds", "lr-drink"],
						{ popular: true },
					),
					item(
						"humita",
						"Humita trio",
						"Sweet corn, squash, basil and melted cheese.",
						1050,
						"empanada",
						["bake", "dip", "empanada-adds", "lr-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
				],
			},
			{
				id: "empanadas",
				name: "Empanadas",
				items: [
					item(
						"pollo",
						"Chicken trio",
						"Braised chicken with red pepper and spring onion.",
						1090,
						"empanada",
						["bake", "dip", "empanada-adds", "lr-drink"],
					),
					item(
						"caprese",
						"Caprese trio",
						"Tomato, mozzarella and fresh basil.",
						1050,
						"empanada",
						["bake", "dip", "empanada-adds", "lr-drink"],
						{ tag: "Vegetarian" },
					),
					item(
						"tucumana",
						"Tucumán beef trio",
						"Juicy matambre with cumin and crushed red pepper.",
						1190,
						"empanada",
						["bake", "dip", "lr-drink"],
						{ tag: "Spicy" },
					),
				],
			},
			{
				id: "bowls",
				name: "From the pot",
				items: [
					item(
						"locro",
						"Locro",
						"Northern stew of white corn, squash, beans and pork, for a cold day.",
						890,
						"bowl",
					),
				],
			},
			{
				id: "sweets",
				name: "Drinks & sweets",
				items: [
					item(
						"limonada",
						"Mint & ginger lemonade",
						"Blended with ice, the way every café pours it.",
						400,
						"drink",
					),
					item(
						"alfajor-maicena",
						"Alfajor de maicena",
						"Crumbly cornstarch cookies, dulce de leche and coconut.",
						300,
						"alfajor",
						[],
						{ popular: true },
					),
				],
			},
		],
	},
	{
		id: "vacio-existencial",
		name: "Vacío Existencial",
		cuisine: "parrilla",
		blurb: "A wood-fire grill for the big questions: vacío, choripán, provoleta",
		dish: "steak",
		tones: ["oklch(0.88 0.05 35)", "oklch(0.48 0.13 30)"],
		rating: 4.9,
		reviews: 3210,
		eta: [30, 45],
		fee: 249,
		distance: 0.6,
		price: 3,
		street: "Honduras 5812",
		at: [-58.43661, -34.5839],
		groups: [
			{
				id: "doneness",
				name: "Cooked",
				required: true,
				max: 1,
				choices: [
					{ id: "jugoso", name: "Jugoso (rare)", price: 0 },
					{ id: "a-punto", name: "A punto (medium)", price: 0 },
					{ id: "cocido", name: "Cocido (well done)", price: 0 },
				],
			},
			{
				id: "garnish",
				name: "On the side",
				required: true,
				max: 1,
				choices: [
					{ id: "papas", name: "Fries", price: 0 },
					{ id: "pure", name: "Mashed potatoes", price: 0 },
					{ id: "mixta", name: "Lettuce, tomato & onion", price: 0 },
					{ id: "calabaza", name: "Roasted squash", price: 100 },
				],
			},
			{
				id: "grill-adds",
				name: "Extras",
				required: false,
				max: 2,
				choices: [
					{ id: "chimichurri", name: "Extra chimichurri", price: 100 },
					{ id: "criolla-side", name: "Salsa criolla", price: 100 },
					{ id: "huevo", name: "Fried egg on top", price: 150 },
				],
			},
			drinks("bl"),
		],
		sections: [
			{
				id: "popular",
				name: "Popular",
				items: [
					item(
						"bife",
						"Bife de chorizo",
						"A thick 400 g sirloin strip, salted and seared over quebracho.",
						2890,
						"steak",
						["doneness", "garnish", "grill-adds", "bl-drink"],
						{ popular: true },
					),
					item(
						"choripan",
						"Choripán",
						"Grilled pork chorizo split on crusty bread, chimichurri spooned over.",
						890,
						"choripan",
						["grill-adds", "bl-drink"],
						{ popular: true },
					),
				],
			},
			{
				id: "grill",
				name: "From the grill",
				items: [
					item("vacio", "Vacío", "Flank, crisp outside and juicy inside.", 2490, "steak", [
						"doneness",
						"garnish",
						"grill-adds",
						"bl-drink",
					]),
					item("asado-tira", "Asado de tira", "Short ribs cut across the bone.", 2390, "steak", [
						"garnish",
						"grill-adds",
						"bl-drink",
					]),
					item(
						"milanesa-napo",
						"Milanesa napolitana",
						"Breaded beef under ham, tomato sauce and melted mozzarella.",
						1890,
						"milanesa",
						["garnish", "bl-drink"],
						{ popular: true },
					),
				],
			},
			{
				id: "starters",
				name: "To start",
				items: [
					item(
						"provoleta",
						"Provoleta",
						"Provolone grilled until it crusts, oregano and chili flakes.",
						990,
						"provoleta",
						[],
						{ tag: "Vegetarian" },
					),
					item(
						"ensalada",
						"Mixed salad",
						"Lettuce, tomato and red onion, dressed with oil and vinegar.",
						690,
						"bowl",
						[],
						{ tag: "Vegan" },
					),
				],
			},
			{
				id: "desserts",
				name: "Desserts",
				items: [
					item(
						"flan",
						"Flan mixto",
						"House flan with dulce de leche and whipped cream.",
						650,
						"flan",
					),
				],
			},
		],
	},
	{
		id: "pizza-con-champan",
		name: "Pizza con Champán",
		cuisine: "pizza",
		blurb: "Thick, cheesy pies with nineties glamour; the champán is a lemonade",
		dish: "pizza",
		tones: ["oklch(0.92 0.06 95)", "oklch(0.58 0.17 30)"],
		rating: 4.6,
		reviews: 1980,
		eta: [20, 30],
		fee: 0,
		distance: 1.1,
		price: 1,
		promo: "20% off over $30",
		street: "Av. Scalabrini Ortiz 1384",
		at: [-58.42865, -34.59335],
		groups: [
			{
				id: "size",
				name: "Size",
				required: true,
				max: 1,
				choices: [
					{ id: "chica", name: "Small, 4 slices", price: 0 },
					{ id: "grande", name: "Large, 8 slices", price: 600 },
				],
			},
			{
				id: "pizza-adds",
				name: "Extras",
				required: false,
				max: 3,
				choices: [
					{ id: "faina-top", name: "A slice of fainá on top", price: 150 },
					{ id: "olives", name: "Green olives", price: 75 },
					{ id: "extra-muzza", name: "Extra mozzarella", price: 200 },
					{ id: "morron", name: "Roasted red pepper", price: 100 },
				],
			},
			drinks("hp"),
		],
		sections: [
			{
				id: "pizzas",
				name: "Pizzas",
				items: [
					item(
						"muzzarella",
						"Muzzarella",
						"A thick crust under a blanket of mozzarella, tomato and green olives.",
						1190,
						"pizza",
						["size", "pizza-adds", "hp-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
					item(
						"fugazzeta",
						"Fugazzeta",
						"Stuffed with mozzarella under a mountain of sweet onion.",
						1390,
						"pizza",
						["size", "pizza-adds", "hp-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
					item(
						"napolitana",
						"Napolitana",
						"Sliced tomato, garlic and fresh basil.",
						1290,
						"pizza",
						["size", "pizza-adds", "hp-drink"],
						{ tag: "Vegetarian" },
					),
					item(
						"jamon-morrones",
						"Ham & roasted peppers",
						"Cooked ham and charred red peppers.",
						1390,
						"pizza",
						["size", "pizza-adds", "hp-drink"],
					),
				],
			},
			{
				id: "slices",
				name: "On the side",
				items: [
					item(
						"faina",
						"Fainá",
						"Chickpea flatbread with black pepper; set it on your slice.",
						350,
						"tart",
						[],
						{ tag: "Vegan" },
					),
					item(
						"chocotorta",
						"Chocotorta",
						"Chocolate cookies layered with dulce de leche cream.",
						690,
						"cake",
						[],
						{ popular: true },
					),
				],
			},
		],
	},
	{
		id: "grasa-o-manteca",
		name: "¿Grasa o Manteca?",
		cuisine: "cafe",
		blurb: "The eternal question, answered with medialunas and café con leche",
		dish: "pastry",
		tones: ["oklch(0.92 0.04 70)", "oklch(0.52 0.08 55)"],
		rating: 4.7,
		reviews: 2580,
		eta: [10, 20],
		fee: 0,
		distance: 0.4,
		price: 1,
		street: "Niceto Vega 4921",
		at: [-58.43368, -34.59067],
		groups: [
			{
				id: "milk",
				name: "Milk",
				required: true,
				max: 1,
				choices: [
					{ id: "whole", name: "Whole", price: 0 },
					{ id: "oat", name: "Oat", price: 75 },
					{ id: "almond", name: "Almond", price: 75 },
				],
			},
			{
				id: "shots",
				name: "Extras",
				required: false,
				max: 2,
				choices: [
					{ id: "extra-shot", name: "Extra shot", price: 100 },
					{ id: "ddl-drizzle", name: "Dulce de leche drizzle", price: 75 },
				],
			},
		],
		sections: [
			{
				id: "bakery",
				name: "Bakery",
				items: [
					item(
						"medialunas",
						"Three medialunas",
						"Small butter croissants with a sticky syrup glaze.",
						450,
						"pastry",
						[],
						{ popular: true },
					),
					item(
						"facturas",
						"Half a dozen facturas",
						"Vigilantes, bolas de fraile and cañoncitos filled with dulce de leche.",
						790,
						"pastry",
					),
					item(
						"alfajor-chocolate",
						"Chocolate alfajor",
						"Two soft cookies, dulce de leche, dipped in dark chocolate.",
						350,
						"alfajor",
						[],
						{ popular: true },
					),
				],
			},
			{
				id: "coffee",
				name: "Coffee & more",
				items: [
					item(
						"cafe-con-leche",
						"Café con leche",
						"Espresso and plenty of steamed milk, in a big cup.",
						400,
						"coffee",
						["milk", "shots"],
						{ popular: true },
					),
					item("cortado", "Cortado", "Espresso cut with a little milk.", 350, "coffee", [
						"milk",
						"shots",
					]),
					item(
						"submarino",
						"Submarino",
						"Hot milk with a bar of dark chocolate to sink and stir.",
						450,
						"coffee",
						["milk"],
					),
					item(
						"mate-cocido",
						"Mate cocido",
						"Yerba mate steeped like tea, with milk if you like.",
						300,
						"mate",
						["milk"],
					),
				],
			},
		],
	},
	{
		id: "ni-frio-ni-calor",
		name: "Ni Frío Ni Calor",
		cuisine: "helado",
		blurb: "Helado so good you'll stop shrugging, packed by the quarter kilo",
		dish: "icecream",
		tones: ["oklch(0.93 0.05 350)", "oklch(0.62 0.15 350)"],
		rating: 4.9,
		reviews: 1420,
		eta: [15, 25],
		fee: 149,
		distance: 0.9,
		price: 1,
		opensAt: "4:00 PM",
		street: "Soler 4380",
		at: [-58.42492, -34.58693],
		groups: [
			{
				id: "size",
				name: "Size",
				required: true,
				max: 1,
				choices: [
					{ id: "cuarto", name: "¼ kg, two flavours", price: 0 },
					{ id: "medio", name: "½ kg, three flavours", price: 700 },
					{ id: "kilo", name: "1 kg, four flavours", price: 1600 },
				],
			},
			{
				id: "helado-adds",
				name: "Extras",
				required: false,
				max: 2,
				choices: [
					{ id: "cones", name: "Cones", price: 100 },
					{ id: "fudge", name: "Hot fudge", price: 150 },
				],
			},
		],
		sections: [
			{
				id: "flavours",
				name: "Flavours",
				items: [
					item(
						"ddl-granizado",
						"Dulce de leche granizado",
						"Dulce de leche with shards of dark chocolate.",
						950,
						"icecream",
						["size", "helado-adds"],
						{ popular: true },
					),
					item(
						"sambayon",
						"Sambayón",
						"Egg-yolk custard with a splash of Marsala.",
						950,
						"icecream",
						["size", "helado-adds"],
					),
					item(
						"chocolate-amargo",
						"Dark chocolate",
						"Bitter and dense, made with water.",
						950,
						"icecream",
						["size", "helado-adds"],
						{ tag: "Vegan" },
					),
					item(
						"frutilla",
						"Strawberries & cream",
						"Fresh strawberries folded into sweet cream.",
						950,
						"icecream",
						["size", "helado-adds"],
					),
				],
			},
		],
	},
	{
		id: "noqui-del-29",
		name: "Ñoqui del 29",
		cuisine: "pasta",
		blurb: "Fresh pasta, and gnocchi for luck on every 29th",
		dish: "pasta",
		tones: ["oklch(0.92 0.06 100)", "oklch(0.55 0.15 30)"],
		rating: 4.7,
		reviews: 1390,
		eta: [25, 40],
		fee: 199,
		distance: 0.8,
		price: 2,
		street: "Loyola 1046",
		at: [-58.44058, -34.59055],
		groups: [
			{
				id: "sauce",
				name: "Sauce",
				required: true,
				max: 1,
				choices: [
					{ id: "fileto", name: "Fileto, tomato & basil", price: 0 },
					{ id: "bolognesa", name: "Bolognesa", price: 200 },
					{ id: "crema", name: "Cream & mushrooms", price: 150 },
					{ id: "mixta-sauce", name: "Mixta, fileto and cream", price: 100 },
					{ id: "pesto", name: "Pesto", price: 150 },
				],
			},
			{
				id: "pasta-adds",
				name: "Extras",
				required: false,
				max: 2,
				choices: [
					{ id: "rallado", name: "Extra grated cheese", price: 75 },
					{ id: "garlic-bread", name: "Garlic bread", price: 150 },
				],
			},
			drinks("nd"),
		],
		sections: [
			{
				id: "pasta",
				name: "Fresh pasta",
				items: [
					item(
						"noquis",
						"Potato ñoquis",
						"Pillowy and hand-rolled; leave a bill under the plate for luck.",
						1290,
						"pasta",
						["sauce", "pasta-adds", "nd-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
					item(
						"sorrentinos",
						"Ham & cheese sorrentinos",
						"Big round stuffed pasta, a Mar del Plata invention.",
						1490,
						"pasta",
						["sauce", "pasta-adds", "nd-drink"],
						{ popular: true },
					),
					item(
						"ravioles",
						"Spinach & ricotta ravioles",
						"Thin egg pasta, a generous filling.",
						1390,
						"pasta",
						["sauce", "pasta-adds", "nd-drink"],
						{ tag: "Vegetarian" },
					),
					item(
						"tallarines",
						"Egg tallarines",
						"Long ribbons cut that morning.",
						1190,
						"pasta",
						["sauce", "pasta-adds", "nd-drink"],
						{ tag: "Vegetarian" },
					),
					item(
						"canelones",
						"Chard cannelloni",
						"Chard and ricotta baked under white sauce and fileto.",
						1490,
						"pasta",
						["pasta-adds", "nd-drink"],
						{ tag: "Vegetarian" },
					),
				],
			},
			{
				id: "desserts",
				name: "Desserts",
				items: [
					item(
						"panqueque",
						"Panqueque with dulce de leche",
						"A thin crêpe rolled around dulce de leche, sugar burnt on top.",
						650,
						"flan",
					),
				],
			},
		],
	},
	{
		id: "todo-con-philadelphia",
		name: "Todo con Philadelphia",
		cuisine: "japanese",
		blurb: "Ramen, and rolls with cream cheese in nearly all of them",
		dish: "ramen",
		tones: ["oklch(0.88 0.05 30)", "oklch(0.55 0.16 25)"],
		rating: 4.7,
		reviews: 1832,
		eta: [25, 35],
		fee: 199,
		distance: 0.9,
		price: 2,
		street: "Arévalo 1652",
		at: [-58.43918, -34.57986],
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
			{
				id: "pieces",
				name: "Pieces",
				required: true,
				max: 1,
				choices: [
					{ id: "eight", name: "8 pieces", price: 0 },
					{ id: "fifteen", name: "15 pieces", price: 900 },
				],
			},
			drinks("nm"),
		],
		sections: [
			{
				id: "ramen",
				name: "Ramen",
				items: [
					item(
						"nami-bowl",
						"Nami bowl",
						"Our house ramen: chashu, scallion, bamboo and a jammy egg.",
						1650,
						"ramen",
						["broth", "firmness", "toppings", "nm-drink"],
						{ popular: true },
					),
					item(
						"spicy-tantan",
						"Spicy tantan",
						"Sesame broth, chili pork mince and bok choy.",
						1590,
						"ramen",
						["firmness", "toppings", "nm-drink"],
						{ tag: "Spicy" },
					),
					item(
						"garden-shio",
						"Garden shio",
						"Light kombu broth with roasted squash and greens.",
						1450,
						"ramen",
						["firmness", "toppings", "nm-drink"],
						{ tag: "Vegan" },
					),
				],
			},
			{
				id: "rolls",
				name: "Rolls",
				items: [
					item(
						"philadelphia",
						"Philadelphia roll",
						"Salmon, cream cheese and avocado, the city's favourite roll.",
						1290,
						"sushi",
						["pieces", "nm-drink"],
						{ popular: true },
					),
					item(
						"crispy-shrimp",
						"Crispy shrimp roll",
						"Tempura shrimp, scallion and spicy mayo.",
						1390,
						"sushi",
						["pieces", "nm-drink"],
					),
					item(
						"avocado-roll",
						"Avocado & cucumber roll",
						"Sesame on the outside, crisp inside.",
						990,
						"sushi",
						["pieces", "nm-drink"],
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
					item("karaage", "Karaage", "Ginger-soy fried chicken, lemon and kewpie.", 890, "chicken"),
					item("edamame", "Edamame", "Sea salt and yuzu zest.", 490, "bowl", [], {
						tag: "Vegan",
					}),
				],
			},
		],
	},
	{
		id: "ceviche-che",
		name: "Ceviche, Che",
		cuisine: "peruvian",
		blurb: "Lima's ceviche and lomo saltado, ordered in porteño",
		dish: "ceviche",
		tones: ["oklch(0.92 0.05 160)", "oklch(0.52 0.12 300)"],
		rating: 4.8,
		reviews: 990,
		eta: [25, 40],
		fee: 249,
		distance: 1.4,
		price: 2,
		promo: "Free chicha morada over $25",
		street: "Thames 948",
		at: [-58.44409, -34.59592],
		groups: [
			{
				id: "heat",
				name: "Heat",
				required: true,
				max: 1,
				choices: [
					{ id: "suave", name: "Mild", price: 0 },
					{ id: "medio-heat", name: "Medium", price: 0 },
					{ id: "rocoto", name: "Hot, with rocoto", price: 0 },
				],
			},
			{
				id: "ceviche-adds",
				name: "Extras",
				required: false,
				max: 3,
				choices: [
					{ id: "choclo", name: "Giant Andean corn", price: 100 },
					{ id: "camote", name: "Glazed sweet potato", price: 100 },
					{ id: "cancha", name: "Toasted cancha corn", price: 75 },
					{ id: "pulpo", name: "Add octopus", price: 350 },
				],
			},
			drinks("lt"),
		],
		sections: [
			{
				id: "ceviches",
				name: "Ceviches",
				items: [
					item(
						"ceviche-clasico",
						"Ceviche clásico",
						"White fish cured in lime with red onion and ají limo.",
						1590,
						"ceviche",
						["heat", "ceviche-adds", "lt-drink"],
						{ popular: true },
					),
					item(
						"ceviche-mixto",
						"Ceviche mixto",
						"Fish, shrimp and squid in leche de tigre.",
						1790,
						"ceviche",
						["heat", "ceviche-adds", "lt-drink"],
					),
				],
			},
			{
				id: "mains",
				name: "Mains",
				items: [
					item(
						"lomo-saltado",
						"Lomo saltado",
						"Wok-seared beef, tomato and onion, with fries and white rice.",
						1690,
						"bowl",
						["heat", "lt-drink"],
						{ popular: true },
					),
					item(
						"aji-de-gallina",
						"Ají de gallina",
						"Shredded chicken in a creamy yellow-pepper sauce over rice.",
						1490,
						"bowl",
						["lt-drink"],
					),
					item(
						"causa",
						"Causa limeña",
						"Cold layered potato with ají amarillo, avocado and lime.",
						990,
						"tart",
						[],
						{ tag: "Vegetarian" },
					),
				],
			},
			{
				id: "drinks",
				name: "Drinks & sweets",
				items: [
					item(
						"chicha",
						"Chicha morada",
						"Purple corn steeped with pineapple and cinnamon.",
						400,
						"drink",
					),
					item(
						"suspiro",
						"Suspiro limeño",
						"Milk caramel custard under a cloud of port meringue.",
						690,
						"flan",
					),
				],
			},
		],
	},
	{
		id: "seul-de-mayo",
		name: "Seúl de Mayo",
		cuisine: "korean",
		blurb: "Double-fried chicken, bibimbap and mandu, a national holiday of crunch",
		dish: "chicken",
		tones: ["oklch(0.92 0.06 60)", "oklch(0.55 0.18 25)"],
		rating: 4.6,
		reviews: 1210,
		eta: [20, 30],
		fee: 149,
		distance: 1.1,
		price: 2,
		street: "Carranza 1478",
		at: [-58.44555, -34.58846],
		groups: [
			{
				id: "portion",
				name: "Portion",
				required: true,
				max: 1,
				choices: [
					{ id: "half", name: "Half chicken", price: 0 },
					{ id: "whole", name: "Whole chicken", price: 1100 },
				],
			},
			{
				id: "glaze",
				name: "Glaze",
				required: true,
				max: 1,
				choices: [
					{ id: "soy-garlic", name: "Soy garlic", price: 0 },
					{ id: "yangnyeom", name: "Sweet & spicy yangnyeom", price: 0 },
					{ id: "plain", name: "Plain and crisp", price: 0 },
				],
			},
			{
				id: "k-adds",
				name: "Extras",
				required: false,
				max: 3,
				choices: [
					{ id: "radish", name: "Pickled radish", price: 75 },
					{ id: "rice", name: "Steamed rice", price: 150 },
					{ id: "kimchi", name: "Kimchi", price: 200 },
					{ id: "cheese", name: "Melted cheese", price: 200 },
				],
			},
			drinks("hb"),
		],
		sections: [
			{
				id: "chicken",
				name: "Fried chicken",
				items: [
					item(
						"korean-fried",
						"Korean fried chicken",
						"Fried twice for a glassy crust, then tossed in your glaze.",
						1590,
						"chicken",
						["portion", "glaze", "k-adds", "hb-drink"],
						{ popular: true },
					),
				],
			},
			{
				id: "plates",
				name: "Rice, noodles & more",
				items: [
					item(
						"bibimbap",
						"Bibimbap",
						"Rice, sesame greens, carrot, a fried egg and gochujang.",
						1390,
						"bowl",
						["k-adds", "hb-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
					item("mandu", "Mandu", "Six pork and chive dumplings, pan-fried.", 790, "dumpling"),
					item(
						"tteokbokki",
						"Tteokbokki",
						"Chewy rice cakes in a sweet, spicy red sauce.",
						890,
						"bowl",
						[],
						{ tag: "Spicy" },
					),
					item(
						"kimchi-jeon",
						"Kimchi pancake",
						"Crisp-edged and cut in wedges, with a soy dip.",
						790,
						"tart",
						[],
						{ tag: "Vegetarian" },
					),
				],
			},
		],
	},
	{
		id: "sin-grieta",
		name: "Sin Grieta",
		cuisine: "burgers",
		blurb: "Smash burgers everyone agrees on, whichever side of the table",
		dish: "burger",
		tones: ["oklch(0.9 0.08 90)", "oklch(0.5 0.12 40)"],
		rating: 4.5,
		reviews: 4290,
		eta: [15, 25],
		fee: 99,
		distance: 0.6,
		price: 1,
		street: "Soler 4910",
		at: [-58.42997, -34.58297],
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
					item(
						"ddl-shake",
						"Dulce de leche shake",
						"Thick enough for a spoon.",
						650,
						"icecream",
						[],
						{ popular: true },
					),
				],
			},
		],
	},
	{
		id: "el-gallego",
		name: "El Gallego de la Esquina",
		cuisine: "spanish",
		blurb: "The corner Spanish bar every barrio has: tapas, paella, tortilla",
		dish: "paella",
		tones: ["oklch(0.92 0.07 85)", "oklch(0.5 0.14 260)"],
		rating: 4.5,
		reviews: 760,
		eta: [35, 50],
		fee: 299,
		distance: 1.2,
		price: 3,
		street: "Aráoz 1621",
		at: [-58.42437, -34.59163],
		groups: [
			{
				id: "serves",
				name: "Serves",
				required: true,
				max: 1,
				choices: [
					{ id: "for-two", name: "Two", price: 0 },
					{ id: "for-four", name: "Four", price: 2200 },
				],
			},
			{
				id: "tortilla-style",
				name: "How you like it",
				required: true,
				max: 1,
				choices: [
					{ id: "jugosa", name: "Runny in the middle", price: 0 },
					{ id: "cuajada", name: "Set through", price: 0 },
				],
			},
			{
				id: "tapas-adds",
				name: "Extras",
				required: false,
				max: 2,
				choices: [
					{ id: "alioli", name: "Alioli", price: 100 },
					{ id: "pan-tomate", name: "Pan con tomate", price: 250 },
				],
			},
			drinks("tg"),
		],
		sections: [
			{
				id: "paellas",
				name: "Paellas",
				items: [
					item(
						"paella-mixta",
						"Paella mixta",
						"Saffron rice, chicken, prawns and mussels, crisp at the bottom.",
						3290,
						"paella",
						["serves", "tg-drink"],
						{ popular: true },
					),
					item(
						"paella-verduras",
						"Vegetable paella",
						"Artichoke, green beans, peppers and saffron.",
						2790,
						"paella",
						["serves", "tg-drink"],
						{ tag: "Vegan" },
					),
				],
			},
			{
				id: "tapas",
				name: "Tapas",
				items: [
					item(
						"tortilla-patatas",
						"Tortilla de patatas",
						"Potato and onion omelette, cut in wedges.",
						990,
						"tart",
						["tortilla-style", "tapas-adds"],
						{ popular: true, tag: "Vegetarian" },
					),
					item(
						"croquetas",
						"Ham croquetas",
						"Six of them, crisp outside and creamy inside.",
						890,
						"croqueta",
						["tapas-adds"],
					),
					item(
						"gambas",
						"Gambas al ajillo",
						"Prawns sizzling in garlic and chili oil, bread to mop it up.",
						1290,
						"bowl",
						["tapas-adds"],
						{ tag: "Spicy" },
					),
				],
			},
			{
				id: "desserts",
				name: "Desserts",
				items: [
					item(
						"crema-catalana",
						"Crema catalana",
						"Citrus custard under a burnt-sugar crust.",
						690,
						"flan",
					),
				],
			},
		],
	},
	{
		id: "y-la-carne",
		name: "¿Y la Carne?",
		cuisine: "veggie",
		blurb: "What your uncle asks; tartas, salads and plates with none of it",
		dish: "tart",
		tones: ["oklch(0.93 0.06 130)", "oklch(0.55 0.13 145)"],
		rating: 4.7,
		reviews: 640,
		eta: [20, 30],
		fee: 0,
		distance: 0.9,
		price: 1,
		promo: "15% off your first order",
		street: "Castillo 1180",
		at: [-58.4348, -34.59488],
		groups: [
			{
				id: "tart-side",
				name: "On the side",
				required: true,
				max: 1,
				choices: [
					{ id: "green-salad", name: "Green salad", price: 0 },
					{ id: "roasted-veg", name: "Roasted vegetables", price: 0 },
					{ id: "no-side", name: "Just the slice", price: 0 },
				],
			},
			{
				id: "bowl-adds",
				name: "Extras",
				required: false,
				max: 3,
				choices: [
					{ id: "avocado", name: "Avocado", price: 200 },
					{ id: "soft-egg", name: "Soft egg", price: 150 },
					{ id: "seeds", name: "Toasted seeds", price: 75 },
					{ id: "quinoa", name: "Quinoa", price: 150 },
				],
			},
			drinks("hu"),
		],
		sections: [
			{
				id: "tartas",
				name: "Tartas",
				items: [
					item(
						"tarta-calabaza",
						"Squash & goat cheese tart",
						"Flaky crust, roasted squash and caramelised onion.",
						1090,
						"tart",
						["tart-side", "hu-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
					item(
						"tarta-acelga",
						"Chard & egg tart",
						"Tarta de acelga, the one every grandmother bakes.",
						990,
						"tart",
						["tart-side", "hu-drink"],
						{ tag: "Vegetarian" },
					),
				],
			},
			{
				id: "plates",
				name: "Plates",
				items: [
					item(
						"milanesa-berenjena",
						"Eggplant milanesa",
						"Breaded eggplant with lemon and a side of mashed squash.",
						1190,
						"milanesa",
						["hu-drink"],
						{ popular: true, tag: "Vegetarian" },
					),
					item(
						"humita-olla",
						"Humita en olla",
						"Creamy sweet corn stewed with squash and basil.",
						1090,
						"bowl",
						["hu-drink"],
						{ tag: "Vegetarian" },
					),
					item(
						"big-salad",
						"Big garden salad",
						"Leaves, roasted beet, chickpeas and lemon tahini.",
						1190,
						"bowl",
						["bowl-adds", "hu-drink"],
						{ tag: "Vegan" },
					),
				],
			},
			{
				id: "drinks",
				name: "Drinks",
				items: [
					item(
						"licuado",
						"Banana licuado",
						"Banana blended with cold milk, or oat milk.",
						450,
						"drink",
					),
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
		line: "Gorriti 4766, Apt 3B",
		note: "Ring 3B, then the second door on the left.",
		at: [-58.43437, -34.58714],
	},
	{
		id: "studio",
		label: "Studio",
		line: "Cabrera 5640, Floor 2",
		note: "Leave it at reception.",
		at: [-58.43962, -34.58461],
	},
	{
		id: "parents",
		label: "Mamá's",
		line: "Lerma 452",
		note: "Blue gate, the dog is friendly.",
		at: [-58.42844, -34.59786],
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

/** The service fee as a percent of the subtotal, with its floor in cents. */
export const SERVICE_PERCENT = 8;

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
			restaurant: "todo-con-philadelphia",
			lines: [
				{ item: "nami-bowl", choices: ["tonkotsu", "firm", "egg", "chili-oil"], qty: 2 },
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
			restaurant: "tres-empanadas",
			lines: [
				{ item: "cuchillo", choices: ["horno", "chimi", "humita-add"], qty: 1 },
				{ item: "humita", choices: ["horno", "criolla"], qty: 1 },
				{ item: "limonada", choices: [], qty: 2 },
			],
			placedAt: now - 6 * DAY_MS - 5 * 60 * 60 * 1000,
			tip: 10,
			address: "studio",
			payment: "work",
			priority: true,
		},
		{
			id: "0190d1b7-9a28-7e65-a4f1-7c2d8b3e6f03",
			restaurant: "grasa-o-manteca",
			lines: [
				{ item: "medialunas", choices: [], qty: 2 },
				{ item: "cafe-con-leche", choices: ["oat", "extra-shot"], qty: 1 },
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

/** The currency every price in Bocado's city is in. */
export const CURRENCY = "USD";

/**
 * Writes cents as the city's prices read, in US English.
 *
 * @example money(1150) // "$11.50"
 */
export function money(cents: number): string {
	return formatAmount(cents, CURRENCY, { locale: "en-US" });
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
