/**
 * Every sticker in the pack, in the order the app lists them: the set it belongs to, the alt
 * text that describes it, and a friend's message it answers, in each language the landing is
 * written in. The artwork is served from `/apps/malfoid/stickers/` as WebP at 240 and 480 pixels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PageLocale } from "~/app/services/page-locale";

/**
 * The pack's sets of ten, grouped as the landing shows them: the everyday sets (six moods,
 * friendship and memes) and then the occasions, each group in the app's order.
 */
export const STICKER_GROUPS = {
	everyday: [
		"pride-and-sarcasm",
		"anger-and-frustration",
		"tsundere-and-embarrassment",
		"happiness-and-affection",
		"sadness-and-exhaustion",
		"everyday-reactions",
		"friendship",
		"memes",
	],
	occasions: [
		"thanksgiving",
		"christmas",
		"valentines-day",
		"new-year",
		"halloween",
		"lunar-new-year",
		"easter",
		"parents-day",
		"earth-day",
	],
} as const;

/** One of the landing's two groups of sets. */
export type StickerGroup = keyof typeof STICKER_GROUPS;

/** Every set in the order the gallery and the viewer list them. */
export const STICKER_CATEGORIES = [...STICKER_GROUPS.everyday, ...STICKER_GROUPS.occasions];

/** One of the pack's sets of ten. */
export type StickerCategory = (typeof STICKER_CATEGORIES)[number];

/** What a sticker shows, the set it belongs to and the message it is the perfect reply to. */
export interface StickerEntry {
	category: StickerCategory;
	alt: Record<PageLocale, string>;
	/** A friend's message the sticker answers, for the gallery's example conversation. */
	prompt: Record<PageLocale, string>;
}

/** All 170 stickers by file name, ten per set, in the app's order. */
export const STICKER_CATALOG = {
	smug: {
		category: "pride-and-sarcasm",
		alt: {
			en: "Malfoid smiles smugly with her arms crossed.",
			"es-AR": "Malfoid sonríe con aire de superioridad y los brazos cruzados.",
		},
		prompt: { en: "Okay, you were right. Happy?", "es-AR": "Ok, tenías razón. ¿Contenta?" },
	},
	"superior-look": {
		category: "pride-and-sarcasm",
		alt: {
			en: "Malfoid gives a superior look with her chin raised.",
			"es-AR": "Malfoid mira con superioridad y la barbilla levantada.",
		},
		prompt: { en: "Do you even know who I am?", "es-AR": "¿Sabes quién soy yo?" },
	},
	"eye-roll": {
		category: "pride-and-sarcasm",
		alt: {
			en: "Malfoid rolls her eyes in exasperation.",
			"es-AR": "Malfoid pone los ojos en blanco con fastidio.",
		},
		prompt: { en: "Brb, just one more episode.", "es-AR": "Ya voy, un capítulo más y salgo." },
	},
	"disappointed-stare": {
		category: "pride-and-sarcasm",
		alt: { en: "Malfoid gives a disappointed stare.", "es-AR": "Malfoid mira con decepción." },
		prompt: {
			en: "I forgot your birthday again.",
			"es-AR": "Me volví a olvidar de tu cumpleaños.",
		},
	},
	"judging-you": {
		category: "pride-and-sarcasm",
		alt: {
			en: "Malfoid points at you with a judging look.",
			"es-AR": "Malfoid te señala con una mirada crítica.",
		},
		prompt: {
			en: "Pineapple is the best pizza topping.",
			"es-AR": "La piña es lo mejor en la pizza.",
		},
	},
	"sarcastic-applause": {
		category: "pride-and-sarcasm",
		alt: { en: "Malfoid claps sarcastically.", "es-AR": "Malfoid aplaude con sarcasmo." },
		prompt: { en: "I’m only 40 minutes late!", "es-AR": "¡Solo llego 40 minutos tarde!" },
	},
	"arms-crossed": {
		category: "pride-and-sarcasm",
		alt: {
			en: "Malfoid stands stubbornly with her arms crossed.",
			"es-AR": "Malfoid cruza los brazos con terquedad.",
		},
		prompt: {
			en: "Can you just admit you were wrong?",
			"es-AR": "¿Puedes admitir que te equivocaste?",
		},
	},
	"dismissive-look-away": {
		category: "pride-and-sarcasm",
		alt: {
			en: "Malfoid looks away dismissively and raises a hand.",
			"es-AR": "Malfoid aparta la mirada con desdén y levanta una mano.",
		},
		prompt: {
			en: "Let me explain my crypto strategy.",
			"es-AR": "Déjame explicarte mi estrategia con cripto.",
		},
	},
	"condescending-laugh": {
		category: "pride-and-sarcasm",
		alt: {
			en: "Malfoid covers her mouth while laughing condescendingly.",
			"es-AR": "Malfoid se tapa la boca mientras se ríe con aire de superioridad.",
		},
		prompt: { en: "I bet I could beat you at chess.", "es-AR": "Seguro que te gano al ajedrez." },
	},
	unimpressed: {
		category: "pride-and-sarcasm",
		alt: {
			en: "Malfoid rests her cheek on her hand, unimpressed.",
			"es-AR": "Malfoid apoya la mejilla en una mano, sin impresionarse.",
		},
		prompt: { en: "Look, I made toast!", "es-AR": "¡Mira, hice una tostada!" },
	},
	"angry-pout": {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid puffs out her cheeks in an angry pout.",
			"es-AR": "Malfoid infla las mejillas con un puchero de enojo.",
		},
		prompt: {
			en: "I ate the fries you were saving.",
			"es-AR": "Me comí las papas que estabas guardando.",
		},
	},
	furious: {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid clenches her fists, furious.",
			"es-AR": "Malfoid aprieta los puños, furiosa.",
		},
		prompt: {
			en: "The group project is due tomorrow and nobody started.",
			"es-AR": "El trabajo grupal es para mañana y nadie empezó.",
		},
	},
	screaming: {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid cups her hands around her mouth and screams.",
			"es-AR": "Malfoid se lleva las manos a la boca y grita.",
		},
		prompt: { en: "Your flight got delayed again.", "es-AR": "Tu vuelo se volvió a retrasar." },
	},
	stomping: {
		category: "anger-and-frustration",
		alt: { en: "Malfoid stomps her foot angrily.", "es-AR": "Malfoid da un pisotón de enojo." },
		prompt: { en: "They canceled the concert.", "es-AR": "Cancelaron el concierto." },
	},
	"extremely-annoyed": {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid pinches the bridge of her nose, extremely annoyed.",
			"es-AR": "Malfoid se pellizca el puente de la nariz, muy molesta.",
		},
		prompt: {
			en: "Quick question: can you explain it one more time?",
			"es-AR": "Pregunta rápida: ¿me lo explicas otra vez?",
		},
	},
	facepalm: {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid covers her forehead with her palm in frustration.",
			"es-AR": "Malfoid se tapa la frente con una mano, frustrada.",
		},
		prompt: {
			en: "I hit reply-all on the company email.",
			"es-AR": "Respondí a todos en el correo de la empresa.",
		},
	},
	"silent-rage": {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid stares in silent rage with her hands clasped.",
			"es-AR": "Malfoid mira con furia contenida y las manos juntas.",
		},
		prompt: { en: "Per my last email…", "es-AR": "Según mi último correo…" },
	},
	"death-stare": {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid gives an intense angry glare.",
			"es-AR": "Malfoid lanza una mirada de furia intensa.",
		},
		prompt: {
			en: "I ate the last slice of your cake.",
			"es-AR": "Me comí la última porción de tu torta.",
		},
	},
	tantrum: {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid throws a tantrum, kicking and waving her fists.",
			"es-AR": "Malfoid hace un berrinche, pataleando y agitando los puños.",
		},
		prompt: {
			en: "The Wi-Fi is down all weekend.",
			"es-AR": "No hay wifi en todo el fin de semana.",
		},
	},
	offended: {
		category: "anger-and-frustration",
		alt: {
			en: "Malfoid presses a hand to her chest, completely offended.",
			"es-AR": "Malfoid se lleva una mano al pecho, totalmente ofendida.",
		},
		prompt: {
			en: "Are you sure you can handle spicy food?",
			"es-AR": "¿Seguro que aguantas el picante?",
		},
	},
	blushing: {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid blushes and touches her fingertips together shyly.",
			"es-AR": "Malfoid se sonroja y junta las puntas de los dedos con timidez.",
		},
		prompt: { en: "You look really cute today.", "es-AR": "Hoy estás muy linda." },
	},
	"blushing-look-away": {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid looks away while blushing shyly.",
			"es-AR": "Malfoid aparta la mirada mientras se sonroja con timidez.",
		},
		prompt: { en: "I think I like you.", "es-AR": "Creo que me gustas." },
	},
	"pretending-not-to-care": {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid blushes while pretending not to care.",
			"es-AR": "Malfoid se sonroja mientras finge que no le importa.",
		},
		prompt: { en: "Did you miss me?", "es-AR": "¿Me extrañaste?" },
	},
	"hiding-smile": {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid hides a pleased smile behind her sleeve.",
			"es-AR": "Malfoid oculta una sonrisa de alegría detrás de la manga.",
		},
		prompt: { en: "I’ll bake you a whole new one?", "es-AR": "¿Te hago una torta nueva entera?" },
	},
	"embarrassed-panic": {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid waves her hands in embarrassed panic.",
			"es-AR": "Malfoid agita las manos, avergonzada y en pánico.",
		},
		prompt: {
			en: "Wait, did you send that to the group chat?",
			"es-AR": "Espera, ¿eso lo mandaste al grupo?",
		},
	},
	"covering-face": {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid covers her blushing face with both hands.",
			"es-AR": "Malfoid se tapa la cara sonrojada con ambas manos.",
		},
		prompt: { en: "I saw you singing in the car.", "es-AR": "Te vi cantando en el auto." },
	},
	"offering-heart": {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid reluctantly offers a heart while blushing.",
			"es-AR": "Malfoid ofrece un corazón a regañadientes mientras se sonroja.",
		},
		prompt: { en: "Happy Valentine’s Day!", "es-AR": "¡Feliz día de los enamorados!" },
	},
	"blushing-arms-crossed": {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid blushes with her arms crossed.",
			"es-AR": "Malfoid se sonroja con los brazos cruzados.",
		},
		prompt: {
			en: "Admit it, you made this playlist for me.",
			"es-AR": "Admítelo, hiciste esta playlist para mí.",
		},
	},
	jealous: {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid sulks jealously with a sideways glance.",
			"es-AR": "Malfoid hace un puchero de celos y mira de reojo.",
		},
		prompt: { en: "My new coworker is so funny.", "es-AR": "Mi compañero nuevo es muy gracioso." },
	},
	"secretly-happy": {
		category: "tsundere-and-embarrassment",
		alt: {
			en: "Malfoid tries to hide how happy she is.",
			"es-AR": "Malfoid intenta ocultar lo feliz que está.",
		},
		prompt: { en: "I got you the limited edition.", "es-AR": "Te conseguí la edición limitada." },
	},
	"genuine-smile": {
		category: "happiness-and-affection",
		alt: {
			en: "Malfoid smiles warmly and sincerely.",
			"es-AR": "Malfoid sonríe con calidez y sinceridad.",
		},
		prompt: { en: "Thanks for always being there.", "es-AR": "Gracias por estar siempre." },
	},
	laughing: {
		category: "happiness-and-affection",
		alt: { en: "Malfoid laughs joyfully.", "es-AR": "Malfoid se ríe con alegría." },
		prompt: {
			en: "I tripped walking into the meeting.",
			"es-AR": "Me tropecé al entrar a la reunión.",
		},
	},
	excited: {
		category: "happiness-and-affection",
		alt: { en: "Malfoid jumps with excitement.", "es-AR": "Malfoid salta de emoción." },
		prompt: { en: "Road trip this weekend?", "es-AR": "¿Viaje este fin de semana?" },
	},
	"sparkling-eyes": {
		category: "happiness-and-affection",
		alt: {
			en: "Malfoid clasps her hands with sparkling eyes.",
			"es-AR": "Malfoid junta las manos con los ojos llenos de ilusión.",
		},
		prompt: { en: "I’m bringing you dessert.", "es-AR": "Te llevo postre." },
	},
	"sending-kiss": {
		category: "happiness-and-affection",
		alt: {
			en: "Malfoid winks and blows a kiss.",
			"es-AR": "Malfoid guiña un ojo y manda un beso.",
		},
		prompt: { en: "Goodnight!", "es-AR": "¡Buenas noches!" },
	},
	"hugging-heart": {
		category: "happiness-and-affection",
		alt: {
			en: "Malfoid hugs a large pink heart.",
			"es-AR": "Malfoid abraza un gran corazón rosa.",
		},
		prompt: { en: "I love you, you know that?", "es-AR": "Te quiero, ¿sabías?" },
	},
	celebrating: {
		category: "happiness-and-affection",
		alt: {
			en: "Malfoid raises both arms to celebrate.",
			"es-AR": "Malfoid levanta ambos brazos para celebrar.",
		},
		prompt: { en: "I GOT THE JOB!", "es-AR": "¡ME DIERON EL TRABAJO!" },
	},
	"thumbs-up": {
		category: "happiness-and-affection",
		alt: {
			en: "Malfoid smiles and gives a thumbs-up.",
			"es-AR": "Malfoid sonríe y levanta el pulgar.",
		},
		prompt: { en: "Dinner at 8?", "es-AR": "¿Cenamos a las 8?" },
	},
	"proud-of-you": {
		category: "happiness-and-affection",
		alt: {
			en: "Malfoid smiles proudly and offers encouragement.",
			"es-AR": "Malfoid sonríe con orgullo y da ánimos.",
		},
		prompt: { en: "I finally finished my thesis.", "es-AR": "Por fin terminé la tesis." },
	},
	"asking-for-hug": {
		category: "happiness-and-affection",
		alt: {
			en: "Malfoid opens her arms, asking for a hug.",
			"es-AR": "Malfoid abre los brazos para pedir un abrazo.",
		},
		prompt: { en: "Today was a really long day.", "es-AR": "Hoy fue un día larguísimo." },
	},
	crying: {
		category: "sadness-and-exhaustion",
		alt: {
			en: "Malfoid wipes away tears as she cries.",
			"es-AR": "Malfoid se limpia las lágrimas mientras llora.",
		},
		prompt: { en: "They’re out of your favorite flavor.", "es-AR": "Se acabó tu sabor favorito." },
	},
	"dramatic-crying": {
		category: "sadness-and-exhaustion",
		alt: {
			en: "Malfoid wails with dramatic streams of tears.",
			"es-AR": "Malfoid llora a gritos con chorros de lágrimas.",
		},
		prompt: {
			en: "The show got canceled after one season.",
			"es-AR": "Cancelaron la serie después de una temporada.",
		},
	},
	"sad-pout": {
		category: "sadness-and-exhaustion",
		alt: {
			en: "Malfoid makes a sad little pout.",
			"es-AR": "Malfoid hace un pequeño puchero de tristeza.",
		},
		prompt: { en: "Sorry, I can’t make it tonight.", "es-AR": "Perdón, hoy no puedo ir." },
	},
	disappointed: {
		category: "sadness-and-exhaustion",
		alt: {
			en: "Malfoid sits with slumped shoulders, disappointed.",
			"es-AR": "Malfoid se sienta con los hombros caídos, decepcionada.",
		},
		prompt: {
			en: "The package is delayed another week.",
			"es-AR": "El paquete se atrasa otra semana.",
		},
	},
	exhausted: {
		category: "sadness-and-exhaustion",
		alt: { en: "Malfoid droops with exhaustion.", "es-AR": "Malfoid está rendida de cansancio." },
		prompt: { en: "How was your day?", "es-AR": "¿Qué tal tu día?" },
	},
	sleeping: {
		category: "sadness-and-exhaustion",
		alt: {
			en: "Malfoid sleeps curled up peacefully.",
			"es-AR": "Malfoid duerme acurrucada y tranquila.",
		},
		prompt: { en: "Are you still up?", "es-AR": "¿Sigues despierta?" },
	},
	bored: {
		category: "sadness-and-exhaustion",
		alt: { en: "Malfoid yawns with boredom.", "es-AR": "Malfoid bosteza de aburrimiento." },
		prompt: {
			en: "That’s the third hour of this meeting.",
			"es-AR": "Ya van tres horas de reunión.",
		},
	},
	"emotionally-defeated": {
		category: "sadness-and-exhaustion",
		alt: {
			en: "Malfoid slumps down, emotionally defeated.",
			"es-AR": "Malfoid se desploma, sin ánimos.",
		},
		prompt: { en: "Tomorrow is Monday again.", "es-AR": "Mañana es lunes otra vez." },
	},
	"under-blanket": {
		category: "sadness-and-exhaustion",
		alt: {
			en: "Malfoid hides beneath an emerald blanket.",
			"es-AR": "Malfoid se esconde bajo una manta verde esmeralda.",
		},
		prompt: { en: "Want to go out tonight?", "es-AR": "¿Salimos esta noche?" },
	},
	"seeking-comfort": {
		category: "sadness-and-exhaustion",
		alt: {
			en: "Malfoid hugs a cushion, seeking comfort.",
			"es-AR": "Malfoid abraza un cojín en busca de consuelo.",
		},
		prompt: { en: "It’s okay, I’m here.", "es-AR": "Tranquila, aquí estoy." },
	},
	confused: {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid tilts her head in confusion.",
			"es-AR": "Malfoid inclina la cabeza, confundida.",
		},
		prompt: { en: "Wait, which Sam?", "es-AR": "Espera, ¿qué Sam?" },
	},
	shocked: {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid gasps in shock with her hands on her cheeks.",
			"es-AR": "Malfoid se lleva las manos a las mejillas, sorprendida.",
		},
		prompt: { en: "They’re getting married!", "es-AR": "¡Se casan!" },
	},
	suspicious: {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid looks sideways suspiciously.",
			"es-AR": "Malfoid mira de reojo con sospecha.",
		},
		prompt: { en: "I didn’t touch your chocolate.", "es-AR": "No toqué tu chocolate." },
	},
	thinking: {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid rests a finger on her chin, thinking.",
			"es-AR": "Malfoid apoya un dedo en la barbilla mientras piensa.",
		},
		prompt: { en: "Pizza or sushi?", "es-AR": "¿Pizza o sushi?" },
	},
	"waving-hello": {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid waves hello with a cheerful smile.",
			"es-AR": "Malfoid saluda con la mano y una sonrisa alegre.",
		},
		prompt: { en: "Hey, you there?", "es-AR": "Hola, ¿estás?" },
	},
	"waving-goodbye": {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid gives a gentle goodbye wave.",
			"es-AR": "Malfoid se despide con un gesto cariñoso de la mano.",
		},
		prompt: { en: "Gotta go, talk later!", "es-AR": "Me voy, ¡hablamos luego!" },
	},
	"eating-popcorn": {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid eats popcorn while watching with amusement.",
			"es-AR": "Malfoid come palomitas mientras observa con diversión.",
		},
		prompt: {
			en: "And then she replied to his story…",
			"es-AR": "Y entonces ella le respondió la historia…",
		},
	},
	"using-phone": {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid checks her phone with an amused smile.",
			"es-AR": "Malfoid mira su teléfono con una sonrisa divertida.",
		},
		prompt: { en: "Did you see what I posted?", "es-AR": "¿Viste lo que publiqué?" },
	},
	"holding-tea": {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid calmly holds a cup of tea and saucer.",
			"es-AR": "Malfoid sostiene con calma una taza de té y su platillo.",
		},
		prompt: { en: "So… did you hear the news?", "es-AR": "Entonces… ¿te enteraste?" },
	},
	"dramatic-thumbs-down": {
		category: "everyday-reactions",
		alt: {
			en: "Malfoid gives a dramatic thumbs-down.",
			"es-AR": "Malfoid baja el pulgar con dramatismo.",
		},
		prompt: { en: "Should I text my ex?", "es-AR": "¿Le escribo a mi ex?" },
	},
	"thanksgiving-turkey-platter": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid proudly presents a roast turkey for Thanksgiving.",
			"es-AR": "Malfoid presenta con orgullo un pavo asado para Acción de Gracias.",
		},
		prompt: { en: "Who's hosting dinner this year?", "es-AR": "¿Quién organiza la cena este año?" },
	},
	"thanksgiving-pumpkin-pie": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid enjoys a slice of pumpkin pie.",
			"es-AR": "Malfoid disfruta una porción de pastel de calabaza.",
		},
		prompt: { en: "Did you save me any dessert?", "es-AR": "¿Me guardaste algo de postre?" },
	},
	"thanksgiving-grateful-heart": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid clasps her hands gratefully with an amber heart.",
			"es-AR": "Malfoid junta las manos con gratitud junto a un corazón ámbar.",
		},
		prompt: { en: "Thank you for always being there.", "es-AR": "Gracias por estar siempre." },
	},
	"thanksgiving-harvest-basket": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid holds a basket of autumn harvest treats.",
			"es-AR": "Malfoid sostiene una canasta con frutos de la cosecha de otoño.",
		},
		prompt: {
			en: "Bring something for the potluck!",
			"es-AR": "¡Trae algo para compartir en la cena!",
		},
	},
	"thanksgiving-autumn-leaves": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid joyfully tosses colorful autumn leaves.",
			"es-AR": "Malfoid lanza hojas de otoño de colores con alegría.",
		},
		prompt: { en: "It finally feels like fall!", "es-AR": "¡Por fin se siente el otoño!" },
	},
	"thanksgiving-turkey-plush": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid shyly hugs a Thanksgiving turkey plush.",
			"es-AR": "Malfoid abraza con timidez un peluche de pavo de Acción de Gracias.",
		},
		prompt: { en: "I got you a little something.", "es-AR": "Te traje un regalito." },
	},
	"thanksgiving-after-dinner-nap": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid looks sleepy and content after Thanksgiving dinner.",
			"es-AR": "Malfoid se ve somnolienta y satisfecha después de la cena de Acción de Gracias.",
		},
		prompt: { en: "Still alive after that dinner?", "es-AR": "¿Sobreviviste a esa cena?" },
	},
	"thanksgiving-helping-cook": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid carefully helps prepare Thanksgiving dinner.",
			"es-AR": "Malfoid ayuda con cuidado a preparar la cena de Acción de Gracias.",
		},
		prompt: { en: "Can you help me in the kitchen?", "es-AR": "¿Me ayudas en la cocina?" },
	},
	"thanksgiving-sharing-rolls": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid offers a warm bread roll to share.",
			"es-AR": "Malfoid ofrece un panecillo caliente para compartir.",
		},
		prompt: { en: "I'm starving.", "es-AR": "Me muero de hambre." },
	},
	"thanksgiving-apple-cider": {
		category: "thanksgiving",
		alt: {
			en: "Malfoid warms her hands around a mug of apple cider.",
			"es-AR": "Malfoid se calienta las manos con una taza de sidra de manzana.",
		},
		prompt: { en: "It's freezing out there.", "es-AR": "Hace un frío terrible afuera." },
	},
	"christmas-gift": {
		category: "christmas",
		alt: {
			en: "Malfoid excitedly offers a wrapped Christmas present.",
			"es-AR": "Malfoid ofrece con emoción un regalo de Navidad envuelto.",
		},
		prompt: {
			en: "You didn't have to get me anything!",
			"es-AR": "¡No tenías que regalarme nada!",
		},
	},
	"christmas-tangled-lights": {
		category: "christmas",
		alt: {
			en: "Malfoid looks annoyed at a tangled string of Christmas lights.",
			"es-AR": "Malfoid mira molesta una guirnalda de luces de Navidad enredada.",
		},
		prompt: { en: "Can you help me decorate the tree?", "es-AR": "¿Me ayudas a armar el árbol?" },
	},
	"christmas-gingerbread": {
		category: "christmas",
		alt: {
			en: "Malfoid happily nibbles a gingerbread cookie.",
			"es-AR": "Malfoid mordisquea feliz una galleta de jengibre.",
		},
		prompt: { en: "I baked cookies!", "es-AR": "¡Hice galletas!" },
	},
	"christmas-snow-globe": {
		category: "christmas",
		alt: {
			en: "Malfoid admires a Christmas tree inside a snow globe.",
			"es-AR": "Malfoid admira un árbol de Navidad dentro de una bola de nieve.",
		},
		prompt: { en: "Is it Christmas yet?", "es-AR": "¿Ya es Navidad?" },
	},
	"christmas-candy-cane": {
		category: "christmas",
		alt: {
			en: "Malfoid poses smugly with a striped candy cane.",
			"es-AR": "Malfoid posa con aire de superioridad y un bastón de caramelo a rayas.",
		},
		prompt: {
			en: "I finished all my shopping in October.",
			"es-AR": "Terminé de comprar los regalos en octubre.",
		},
	},
	"christmas-hot-cocoa": {
		category: "christmas",
		alt: {
			en: "Malfoid cozies up with hot chocolate and marshmallows.",
			"es-AR": "Malfoid se acurruca con chocolate caliente y malvaviscos.",
		},
		prompt: { en: "Movie night by the fire?", "es-AR": "¿Noche de películas junto al fuego?" },
	},
	"christmas-ornament": {
		category: "christmas",
		alt: {
			en: "Malfoid proudly shows an emerald Christmas ornament.",
			"es-AR": "Malfoid muestra con orgullo una esfera navideña verde esmeralda.",
		},
		prompt: { en: "Look at the tree I decorated!", "es-AR": "¡Mira el árbol que decoré!" },
	},
	"christmas-little-tree": {
		category: "christmas",
		alt: {
			en: "Malfoid hugs a tiny decorated Christmas tree.",
			"es-AR": "Malfoid abraza un pequeño árbol de Navidad decorado.",
		},
		prompt: {
			en: "Our apartment only fits a tiny tree.",
			"es-AR": "En el departamento solo entra un árbol chiquito.",
		},
	},
	"christmas-stocking-surprise": {
		category: "christmas",
		alt: {
			en: "Malfoid peeks into a Christmas stocking with surprise.",
			"es-AR": "Malfoid mira dentro de una bota navideña con sorpresa.",
		},
		prompt: { en: "Did you check your stocking?", "es-AR": "¿Ya revisaste tu bota?" },
	},
	"christmas-snowflake": {
		category: "christmas",
		alt: {
			en: "Malfoid joyfully catches a snowflake in her mitten.",
			"es-AR": "Malfoid atrapa con alegría un copo de nieve en su manopla.",
		},
		prompt: { en: "It's snowing!", "es-AR": "¡Está nevando!" },
	},
	"valentines-day-hidden-rose": {
		category: "valentines-day",
		alt: {
			en: "Malfoid tries to look casual with a flustered sideways glance, hiding a red rose behind her back.",
			"es-AR": "Malfoid oculta una rosa roja detrás de la espalda e intenta disimular su timidez.",
		},
		prompt: {
			en: "Did you get me anything for Valentine's?",
			"es-AR": "¿Me compraste algo para San Valentín?",
		},
	},
	"valentines-day-offering-chocolates": {
		category: "valentines-day",
		alt: {
			en: "Malfoid reluctantly offers a heart-shaped box of chocolates, looking away with a blush.",
			"es-AR":
				"Malfoid ofrece una caja de chocolates en forma de corazón mientras mira hacia otro lado sonrojada.",
		},
		prompt: { en: "Are those for me?", "es-AR": "¿Eso es para mí?" },
	},
	"valentines-day-receiving-flowers": {
		category: "valentines-day",
		alt: {
			en: "Malfoid holds a small bouquet to her chest, flustered and delighted.",
			"es-AR": "Malfoid sostiene un ramo recién recibido contra el pecho, muy sonrojada y feliz.",
		},
		prompt: { en: "Did the flowers arrive?", "es-AR": "¿Llegaron las flores?" },
	},
	"valentines-day-oversized-bouquet": {
		category: "valentines-day",
		alt: {
			en: "Malfoid struggles to carry a bouquet bigger than she is, her face peeking over the blooms.",
			"es-AR": "Malfoid intenta cargar un ramo enorme con el rostro asomado entre las flores.",
		},
		prompt: { en: "Go big or go home.", "es-AR": "Si vas a hacerlo, hazlo en grande." },
	},
	"valentines-day-love-letter": {
		category: "valentines-day",
		alt: {
			en: "Malfoid nervously holds out a love letter sealed with a small heart.",
			"es-AR": "Malfoid entrega con nervios una carta de amor cerrada con un sello de corazón.",
		},
		prompt: {
			en: "Is there something you want to tell me?",
			"es-AR": "¿Hay algo que quieras decirme?",
		},
	},
	"valentines-day-heart-balloon": {
		category: "valentines-day",
		alt: {
			en: "Malfoid floats off the ground holding a big pink heart balloon, eyes wide in surprise.",
			"es-AR":
				"Malfoid flota sujetando un globo de corazón rosa con los pies colgando y una expresión sorprendida.",
		},
		prompt: { en: "How do you feel right now?", "es-AR": "¿Cómo te sientes ahora mismo?" },
	},
	"valentines-day-sneaking-chocolate": {
		category: "valentines-day",
		alt: {
			en: "Malfoid sneaks a chocolate from a heart-shaped box with a guilty sideways glance.",
			"es-AR":
				"Malfoid saca a escondidas un chocolate de una caja de regalo con una mirada culpable.",
		},
		prompt: { en: "Who opened the chocolates?", "es-AR": "¿Quién abrió los chocolates?" },
	},
	"valentines-day-guarding-chocolates": {
		category: "valentines-day",
		alt: {
			en: "Malfoid crouches around a heart-shaped box of chocolates with a fierce, possessive pout.",
			"es-AR":
				"Malfoid protege celosamente una caja de chocolates en forma de corazón con un puchero feroz.",
		},
		prompt: { en: "Can I have one?", "es-AR": "¿Me das uno?" },
	},
	"valentines-day-cupid-misfire": {
		category: "valentines-day",
		alt: {
			en: "Malfoid's little Cupid wand sprays pink hearts back into her startled face.",
			"es-AR":
				"Malfoid se sorprende cuando su varita de Cupido lanza pequeños corazones hacia su rostro.",
		},
		prompt: { en: "How's the matchmaking going?", "es-AR": "¿Cómo va eso de hacer de Cupido?" },
	},
	"valentines-day-tea-for-two": {
		category: "valentines-day",
		alt: {
			en: "Malfoid kneels to set out two matching teacups and a heart-shaped biscuit, with a shy, hopeful smile.",
			"es-AR":
				"Malfoid prepara dos tazas de té en una bandeja con una sonrisa tímida y esperanzada.",
		},
		prompt: { en: "Are you free this weekend?", "es-AR": "¿Estás libre este fin de semana?" },
	},
	"new-year-confetti-explosion": {
		category: "new-year",
		alt: {
			en: "Malfoid throws her arms up as confetti bursts around her, grinning.",
			"es-AR": "Malfoid levanta los brazos con alegría entre una explosión de confeti.",
		},
		prompt: { en: "Happy New Year!", "es-AR": "¡Feliz Año Nuevo!" },
	},
	"new-year-sleepy-toast": {
		category: "new-year",
		alt: {
			en: "Malfoid sleepily raises a glass of sparkling apple juice, her party hat crooked.",
			"es-AR": "Malfoid brinda con jugo de manzana con sueño y un gorrito de fiesta torcido.",
		},
		prompt: { en: "Ten minutes to midnight!", "es-AR": "¡Faltan diez minutos para las doce!" },
	},
	"new-year-tangled-streamers": {
		category: "new-year",
		alt: {
			en: "Malfoid stares in exasperation at party streamers tangled between her hands.",
			"es-AR": "Malfoid mira con fastidio unas serpentinas enredadas entre sus manos.",
		},
		prompt: {
			en: "How's the party prep going?",
			"es-AR": "¿Cómo van los preparativos de la fiesta?",
		},
	},
	"new-year-party-popper": {
		category: "new-year",
		alt: {
			en: "Malfoid fires a party popper and is startled by the huge burst of streamers.",
			"es-AR": "Malfoid da un respingo al disparar un lanzador de confeti lleno de serpentinas.",
		},
		prompt: { en: "3… 2… 1…", "es-AR": "3… 2… 1…" },
	},
	"new-year-oversized-party-hat": {
		category: "new-year",
		alt: {
			en: "Malfoid steadies an enormous party hat with both hands, annoyed eyes peeking from under the brim.",
			"es-AR": "Malfoid sujeta un gorro de fiesta enorme que casi le tapa los ojos.",
		},
		prompt: {
			en: "You have to wear the hat. House rules.",
			"es-AR": "Tienes que ponerte el gorro. Son las reglas.",
		},
	},
	"new-year-watching-fireworks": {
		category: "new-year",
		alt: {
			en: "Malfoid clasps her hands in wonder at small colorful fireworks beside her.",
			"es-AR": "Malfoid admira con asombro pequeños fuegos artificiales junto a ella.",
		},
		prompt: {
			en: "Are you watching the fireworks?",
			"es-AR": "¿Estás viendo los fuegos artificiales?",
		},
	},
	"new-year-fresh-calendar": {
		category: "new-year",
		alt: {
			en: "Malfoid proudly presents a new calendar with a sunrise on it.",
			"es-AR": "Malfoid muestra con orgullo un calendario nuevo con un pequeño amanecer.",
		},
		prompt: { en: "New year, new me.", "es-AR": "Año nuevo, vida nueva." },
	},
	"new-year-confetti-cleanup": {
		category: "new-year",
		alt: {
			en: "Malfoid wearily sweeps up a pile of confetti, her party hat drooping.",
			"es-AR": "Malfoid barre confeti con cansancio y un gorro de fiesta caído.",
		},
		prompt: { en: "Best party ever!", "es-AR": "¡La mejor fiesta de todas!" },
	},
	"new-year-midnight-wish": {
		category: "new-year",
		alt: {
			en: "Malfoid closes her eyes to make a wish, holding a tiny glowing star.",
			"es-AR": "Malfoid cierra los ojos y pide un deseo sujetando una pequeña estrella brillante.",
		},
		prompt: { en: "What did you wish for?", "es-AR": "¿Qué deseo pediste?" },
	},
	"new-year-asleep-before-midnight": {
		category: "new-year",
		alt: {
			en: "Malfoid falls asleep hugging a party cushion beside a clock before midnight.",
			"es-AR": "Malfoid se queda dormida abrazando un cojín de fiesta antes de medianoche.",
		},
		prompt: {
			en: "You're staying up for midnight, right?",
			"es-AR": "Vas a aguantar hasta medianoche, ¿no?",
		},
	},
	"halloween-pumpkin-hug": {
		category: "halloween",
		alt: {
			en: "Malfoid sits hugging a jack-o'-lantern with a smug, pleased smile.",
			"es-AR": "Malfoid abraza una calabaza de Halloween sentada con una sonrisa satisfecha.",
		},
		prompt: { en: "Pumpkin spice season is back.", "es-AR": "Volvió la temporada de calabaza." },
	},
	"halloween-tiny-ghost": {
		category: "halloween",
		alt: {
			en: "Malfoid jumps at a tiny friendly ghost floating beside her shoulder.",
			"es-AR": "Malfoid se sobresalta ante un pequeño fantasma amistoso junto a su hombro.",
		},
		prompt: { en: "Did you hear that noise?", "es-AR": "¿Escuchaste ese ruido?" },
	},
	"halloween-vampire-cape": {
		category: "halloween",
		alt: {
			en: "Malfoid smugly spreads a little vampire cape over her uniform, showing tiny playful fangs.",
			"es-AR":
				"Malfoid presume una pequeña capa de vampiro y colmillos juguetones sobre su uniforme.",
		},
		prompt: { en: "What are you dressing up as?", "es-AR": "¿De qué te vas a disfrazar?" },
	},
	"halloween-candy-bucket": {
		category: "halloween",
		alt: {
			en: "Malfoid proudly holds a pumpkin bucket overflowing with candy.",
			"es-AR": "Malfoid muestra con orgullo un cubo de calabaza rebosante de dulces.",
		},
		prompt: { en: "How much candy did you get?", "es-AR": "¿Cuántos dulces juntaste?" },
	},
	"halloween-haunted-doorway": {
		category: "halloween",
		alt: {
			en: "Malfoid peeks suspiciously around a small crooked haunted door.",
			"es-AR": "Malfoid se asoma con desconfianza detrás de una pequeña puerta embrujada.",
		},
		prompt: { en: "Want to go to the haunted house?", "es-AR": "¿Vamos a la casa embrujada?" },
	},
	"halloween-cobweb-tangle": {
		category: "halloween",
		alt: {
			en: "Malfoid pulls cobwebs off her sleeves with an indignant pout.",
			"es-AR": "Malfoid intenta quitarse telarañas de las mangas con un puchero indignado.",
		},
		prompt: { en: "How was the attic?", "es-AR": "¿Qué tal el ático?" },
	},
	"halloween-crooked-pumpkin": {
		category: "halloween",
		alt: {
			en: "Malfoid proudly shows off a carved pumpkin with a comically crooked grin.",
			"es-AR": "Malfoid muestra orgullosa una calabaza tallada con una sonrisa torcida.",
		},
		prompt: { en: "Show me your pumpkin!", "es-AR": "¡Muéstrame tu calabaza!" },
	},
	"halloween-broom-malfunction": {
		category: "halloween",
		alt: {
			en: "Malfoid clings to a sputtering flying broom, hair blown back and eyes alarmed.",
			"es-AR": "Malfoid se asusta cuando su escoba voladora falla y suelta chispas inofensivas.",
		},
		prompt: { en: "Are you on your way?", "es-AR": "¿Ya vienes en camino?" },
	},
	"halloween-mummy-wrap": {
		category: "halloween",
		alt: {
			en: "Malfoid stands awkwardly in loose mummy bandages over her uniform.",
			"es-AR":
				"Malfoid posa torpemente con vendas de disfraz de momia sobre el uniforme y el rostro descubierto.",
		},
		prompt: { en: "Did you finish your costume?", "es-AR": "¿Terminaste tu disfraz?" },
	},
	"halloween-bat-on-head": {
		category: "halloween",
		alt: {
			en: "Malfoid looks up cross-eyed at a tiny bat perched on her hair.",
			"es-AR": "Malfoid mira hacia arriba a un pequeño murciélago posado en su cabello.",
		},
		prompt: {
			en: "Don't move. There's something on your head.",
			"es-AR": "No te muevas. Tienes algo en la cabeza.",
		},
	},
	"lunar-new-year-red-envelope": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid holds out a red envelope decorated with a gold flower, smiling generously.",
			"es-AR": "Malfoid entrega un sobre rojo con una flor dorada y una sonrisa generosa.",
		},
		prompt: { en: "Happy Lunar New Year!", "es-AR": "¡Feliz Año Nuevo Lunar!" },
	},
	"lunar-new-year-envelope-surprise": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid clutches a red envelope to her chest, eyes shining with excitement.",
			"es-AR": "Malfoid sujeta un sobre rojo recién recibido contra el pecho con ojos emocionados.",
		},
		prompt: {
			en: "Did Grandma give you a red envelope?",
			"es-AR": "¿La abuela te dio un sobre rojo?",
		},
	},
	"lunar-new-year-lantern": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid carefully carries a round red paper lantern with a gold tassel.",
			"es-AR": "Malfoid lleva con cuidado un farol rojo de papel con una borla dorada.",
		},
		prompt: {
			en: "Are you coming to the lantern festival?",
			"es-AR": "¿Vienes al festival de faroles?",
		},
	},
	"lunar-new-year-lucky-oranges": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid balances three mandarins with fresh leaves in her cupped hands.",
			"es-AR":
				"Malfoid sostiene tres mandarinas con hojas entre las manos con una expresión feliz.",
		},
		prompt: { en: "Wishing you a lucky year!", "es-AR": "¡Que tengas un año de buena suerte!" },
	},
	"lunar-new-year-hanging-decoration": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid stretches up to hang a red knot ornament with gold tassels.",
			"es-AR": "Malfoid levanta los brazos para colocar un adorno rojo de nudos y borlas.",
		},
		prompt: {
			en: "Is the house ready for tomorrow?",
			"es-AR": "¿La casa ya está lista para mañana?",
		},
	},
	"lunar-new-year-sharing-dumplings": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid offers a bamboo steamer with three dumplings, smiling warmly.",
			"es-AR": "Malfoid ofrece una vaporera de bambú con tres dumplings y una sonrisa cálida.",
		},
		prompt: { en: "What's for the reunion dinner?", "es-AR": "¿Qué hay para la cena familiar?" },
	},
	"lunar-new-year-golden-fireworks": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid admires small red and gold fireworks, hands on her cheeks in wonder.",
			"es-AR": "Malfoid admira con asombro pequeños fuegos artificiales rojos y dorados.",
		},
		prompt: { en: "The fireworks are starting!", "es-AR": "¡Empiezan los fuegos artificiales!" },
	},
	"lunar-new-year-red-ribbons": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid sits comically tangled in red gift ribbons.",
			"es-AR": "Malfoid se sienta enredada en cintas rojas de regalo sobre las mangas y el regazo.",
		},
		prompt: { en: "How's the gift wrapping going?", "es-AR": "¿Cómo vas con los regalos?" },
	},
	"lunar-new-year-lion-mask": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid peeks playfully from behind a red and gold lion dance mask.",
			"es-AR": "Malfoid se asoma juguetona detrás de una máscara de danza del león roja y dorada.",
		},
		prompt: { en: "Did you see the lion dance?", "es-AR": "¿Viste la danza del león?" },
	},
	"lunar-new-year-treat-tower": {
		category: "lunar-new-year",
		alt: {
			en: "Malfoid carefully balances a tall stack of festive treat trays, concentrating hard.",
			"es-AR":
				"Malfoid equilibra una torre de bandejas con dulces festivos y una expresión concentrada.",
		},
		prompt: { en: "Can you bring the snacks?", "es-AR": "¿Puedes traer los bocadillos?" },
	},
	"easter-painting-egg": {
		category: "easter",
		alt: {
			en: "Malfoid carefully paints a pastel egg, a dot of paint on her cheek.",
			"es-AR":
				"Malfoid pinta un huevo de Pascua con cuidado y una manchita de pintura en la mejilla.",
		},
		prompt: { en: "Want to decorate eggs?", "es-AR": "¿Pintamos huevos?" },
	},
	"easter-chocolate-discovery": {
		category: "easter",
		alt: {
			en: "Malfoid opens a big foil-wrapped chocolate egg with wide, delighted eyes.",
			"es-AR":
				"Malfoid abre un huevo de chocolate envuelto en papel brillante con ojos de alegría.",
		},
		prompt: { en: "The Easter bunny came!", "es-AR": "¡Pasó el conejo de Pascua!" },
	},
	"easter-reluctant-bunny-ears": {
		category: "easter",
		alt: {
			en: "Malfoid wears a floppy bunny-ear headband with a deeply unimpressed look.",
			"es-AR": "Malfoid lleva una diadema de orejas de conejo con una expresión de fastidio.",
		},
		prompt: {
			en: "Matching bunny ears for the family photo!",
			"es-AR": "¡Orejas de conejo para la foto familiar!",
		},
	},
	"easter-egg-basket": {
		category: "easter",
		alt: {
			en: "Malfoid struggles to carry a basket overflowing with pastel eggs.",
			"es-AR": "Malfoid intenta cargar una cesta rebosante de huevos de colores pastel.",
		},
		prompt: { en: "How many did you find?", "es-AR": "¿Cuántos encontraste?" },
	},
	"easter-failed-egg-hunt": {
		category: "easter",
		alt: {
			en: "Malfoid holds up a completely empty egg basket with a dramatic disappointed pout.",
			"es-AR": "Malfoid muestra una cesta de huevos vacía con un puchero de decepción.",
		},
		prompt: { en: "How did the egg hunt go?", "es-AR": "¿Cómo te fue en la búsqueda de huevos?" },
	},
	"easter-last-chocolate-bunny": {
		category: "easter",
		alt: {
			en: "Malfoid protectively shields the last chocolate bunny behind one arm while glaring possessively.",
			"es-AR": "Malfoid protege el último conejo de chocolate con una mirada posesiva.",
		},
		prompt: { en: "Is there any chocolate left?", "es-AR": "¿Queda chocolate?" },
	},
	"easter-chick-on-head": {
		category: "easter",
		alt: {
			en: "Malfoid looks up with a surprised tiny smile at a fluffy yellow chick perched on her head.",
			"es-AR": "Malfoid mira sorprendida a un pollito amarillo posado en su cabeza.",
		},
		prompt: { en: "Look behind you.", "es-AR": "Mira detrás de ti." },
	},
	"easter-cracked-egg": {
		category: "easter",
		alt: {
			en: "Malfoid gasps as a decorated egg cracks open in her hands, revealing a tiny chick.",
			"es-AR": "Malfoid se sorprende cuando un huevo decorado se abre y aparece un pollito.",
		},
		prompt: { en: "Guess what I found.", "es-AR": "Adivina qué encontré." },
	},
	"easter-spring-flowers": {
		category: "easter",
		alt: {
			en: "Malfoid arranges pastel spring flowers around an Easter basket.",
			"es-AR": "Malfoid adorna una cesta de Pascua con flores de primavera y una sonrisa suave.",
		},
		prompt: { en: "Spring is finally here.", "es-AR": "Por fin llegó la primavera." },
	},
	"easter-egg-hunt-victory": {
		category: "easter",
		alt: {
			en: "Malfoid triumphantly raises a golden egg above her head.",
			"es-AR": "Malfoid levanta triunfal un huevo dorado que acaba de encontrar.",
		},
		prompt: { en: "Who found the golden egg?", "es-AR": "¿Quién encontró el huevo dorado?" },
	},
	"friendship-half-a-snack": {
		category: "friendship",
		alt: {
			en: "Malfoid holds out half of a biscuit and keeps the other half, with a shy, friendly smile.",
			"es-AR": "Malfoid ofrece la mitad de una galleta con una sonrisa tímida y amistosa.",
		},
		prompt: { en: "I forgot my lunch.", "es-AR": "Me olvidé el almuerzo." },
	},
	"friendship-bracelet": {
		category: "friendship",
		alt: {
			en: "Malfoid proudly shows a handmade friendship bracelet in her palm.",
			"es-AR": "Malfoid muestra con orgullo una pulsera de amistad hecha a mano.",
		},
		prompt: { en: "Best friends forever?", "es-AR": "¿Amistad para siempre?" },
	},
	"friendship-matching-charms": {
		category: "friendship",
		alt: {
			en: "Malfoid holds up two matching star charms, smiling affectionately.",
			"es-AR": "Malfoid levanta dos llaveros de estrella a juego con una expresión cariñosa.",
		},
		prompt: { en: "We should get matching ones.", "es-AR": "Deberíamos tener unos iguales." },
	},
	"friendship-saving-a-seat": {
		category: "friendship",
		alt: {
			en: "Malfoid sits on a stool and points to the empty one beside her.",
			"es-AR": "Malfoid invita a sentarse en un pequeño asiento vacío junto a ella.",
		},
		prompt: { en: "Running late, save me a seat!", "es-AR": "¡Llego tarde, guárdame un lugar!" },
	},
	"friendship-shoulder-pat": {
		category: "friendship",
		alt: {
			en: "Malfoid reaches out a reassuring hand, eyes soft with sympathy.",
			"es-AR": "Malfoid extiende una mano para dar una palmada de apoyo en el hombro.",
		},
		prompt: { en: "Today was rough.", "es-AR": "Hoy fue un día difícil." },
	},
	"friendship-pinky-promise": {
		category: "friendship",
		alt: {
			en: "Malfoid holds out her little finger for a pinky promise, smiling earnestly.",
			"es-AR": "Malfoid extiende el meñique para hacer una promesa con una sonrisa sincera.",
		},
		prompt: { en: "Promise you won't tell anyone?", "es-AR": "¿Prometes no contarle a nadie?" },
	},
	"friendship-shared-umbrella": {
		category: "friendship",
		alt: {
			en: "Malfoid tilts an open umbrella toward the empty space beside her.",
			"es-AR": "Malfoid inclina un paraguas abierto para compartirlo con alguien.",
		},
		prompt: { en: "Ugh, I forgot my umbrella.", "es-AR": "Uf, me olvidé el paraguas." },
	},
	"friendship-spare-cup": {
		category: "friendship",
		alt: {
			en: "Malfoid offers a spare warm drink while holding her own cup, smiling.",
			"es-AR":
				"Malfoid ofrece una taza de bebida caliente mientras sostiene la suya con la otra mano.",
		},
		prompt: { en: "Long day. Need caffeine.", "es-AR": "Día largo. Necesito café." },
	},
	"friendship-repaired-trinket": {
		category: "friendship",
		alt: {
			en: "Malfoid presents a little star charm mended with a neat gold seam.",
			"es-AR": "Malfoid muestra un pequeño dije de estrella reparado con una unión dorada.",
		},
		prompt: { en: "I think I broke it…", "es-AR": "Creo que lo rompí…" },
	},
	"friendship-high-five": {
		category: "friendship",
		alt: {
			en: "Malfoid raises an open palm for a high five, cheerful and leaning in.",
			"es-AR": "Malfoid levanta una mano con entusiasmo para chocar los cinco.",
		},
		prompt: { en: "I passed the exam!", "es-AR": "¡Aprobé el examen!" },
	},
	"parents-day-handmade-card": {
		category: "parents-day",
		alt: {
			en: "Malfoid holds out a handmade card decorated with hearts and flowers, smiling hopefully.",
			"es-AR": "Malfoid entrega una tarjeta hecha a mano decorada con corazones y flores.",
		},
		prompt: {
			en: "Did you remember Mom's card?",
			"es-AR": "¿Te acordaste de la tarjeta para mamá?",
		},
	},
	"parents-day-wonky-cake": {
		category: "parents-day",
		alt: {
			en: "Malfoid proudly carries a homemade cake with comically uneven icing.",
			"es-AR": "Malfoid lleva con orgullo una torta casera con el glaseado torcido.",
		},
		prompt: { en: "Did you bake that yourself?", "es-AR": "¿La hiciste tú?" },
	},
	"parents-day-breakfast-tray": {
		category: "parents-day",
		alt: {
			en: "Malfoid carefully offers a breakfast tray with toast, a little cup and a single flower.",
			"es-AR": "Malfoid ofrece una bandeja de desayuno con tostadas, una taza y una flor.",
		},
		prompt: { en: "Breakfast in bed for Dad?", "es-AR": "¿Desayuno en la cama para papá?" },
	},
	"parents-day-thank-you-flowers": {
		category: "parents-day",
		alt: {
			en: "Malfoid bows politely, holding out a small bouquet tied with a cream bow.",
			"es-AR": "Malfoid hace una pequeña reverencia al entregar un ramo con un lazo color crema.",
		},
		prompt: { en: "Thanks for everything, really.", "es-AR": "Gracias por todo, de verdad." },
	},
	"parents-day-wrapped-present": {
		category: "parents-day",
		alt: {
			en: "Malfoid presents a carefully wrapped gift with an emerald bow.",
			"es-AR": "Malfoid entrega un regalo envuelto con cuidado y un lazo esmeralda.",
		},
		prompt: { en: "What did you get them?", "es-AR": "¿Qué les regalaste?" },
	},
	"parents-day-oversized-trophy": {
		category: "parents-day",
		alt: {
			en: "Malfoid struggles to lift a huge gold trophy with a heart on it.",
			"es-AR": "Malfoid intenta levantar un trofeo dorado enorme con un corazón.",
		},
		prompt: { en: "Best parents in the world.", "es-AR": "Los mejores padres del mundo." },
	},
	"parents-day-photo-album": {
		category: "parents-day",
		alt: {
			en: "Malfoid sits smiling at you while presenting an open family photo album.",
			"es-AR": "Malfoid sonríe sentada mientras te muestra un álbum de fotos familiar abierto.",
		},
		prompt: {
			en: "Remember when we were little?",
			"es-AR": "¿Te acuerdas de cuando éramos chicos?",
		},
	},
	"parents-day-burnt-breakfast": {
		category: "parents-day",
		alt: {
			en: "Malfoid looks sheepishly at two very burnt slices of toast.",
			"es-AR": "Malfoid mira avergonzada un plato con dos tostadas quemadas.",
		},
		prompt: { en: "How did breakfast go?", "es-AR": "¿Cómo salió el desayuno?" },
	},
	"parents-day-gift-plant": {
		category: "parents-day",
		alt: {
			en: "Malfoid waters a small potted flower wrapped with a gift ribbon.",
			"es-AR": "Malfoid riega una pequeña planta con flores y una cinta de regalo.",
		},
		prompt: { en: "Mom loves plants.", "es-AR": "A mamá le encantan las plantas." },
	},
	"parents-day-handmade-craft": {
		category: "parents-day",
		alt: {
			en: "Malfoid proudly shows a slightly wonky handmade clay heart.",
			"es-AR": "Malfoid muestra orgullosa un corazón de arcilla hecho a mano un poco irregular.",
		},
		prompt: { en: "I made something for Dad.", "es-AR": "Le hice algo a papá." },
	},
	"earth-day-globe-hug": {
		category: "earth-day",
		alt: {
			en: "Malfoid hugs a small globe, eyes closed with an affectionate smile.",
			"es-AR": "Malfoid abraza un pequeño globo terráqueo con una sonrisa cariñosa.",
		},
		prompt: { en: "Happy Earth Day!", "es-AR": "¡Feliz Día de la Tierra!" },
	},
	"earth-day-planting-sapling": {
		category: "earth-day",
		alt: {
			en: "Malfoid kneels to plant a leafy sapling with a little trowel.",
			"es-AR": "Malfoid planta un pequeño árbol de hojas verdes con una pala de jardinería.",
		},
		prompt: {
			en: "We're planting trees on Saturday.",
			"es-AR": "El sábado vamos a plantar árboles.",
		},
	},
	"earth-day-protecting-seedling": {
		category: "earth-day",
		alt: {
			en: "Malfoid cups her hands around a tiny potted seedling with fierce, determined eyes.",
			"es-AR": "Malfoid protege un pequeño brote en una maceta entre sus manos.",
		},
		prompt: {
			en: "The cat keeps going after my plants.",
			"es-AR": "El gato no deja en paz mis plantas.",
		},
	},
	"earth-day-recycling": {
		category: "earth-day",
		alt: {
			en: "Malfoid drops an empty bottle into a small recycling bin.",
			"es-AR": "Malfoid deposita una botella vacía en un pequeño contenedor de reciclaje.",
		},
		prompt: { en: "Where does this go?", "es-AR": "¿Dónde va esto?" },
	},
	"earth-day-litter-pickup": {
		category: "earth-day",
		alt: {
			en: "Malfoid uses a little litter grabber to put a wrapper in a bag.",
			"es-AR": "Malfoid recoge un envoltorio con una pinza y lo guarda en una bolsa.",
		},
		prompt: {
			en: "Beach cleanup this weekend?",
			"es-AR": "¿Limpieza de playa este fin de semana?",
		},
	},
	"earth-day-reusable-bags": {
		category: "earth-day",
		alt: {
			en: "Malfoid proudly raises two reusable cloth bags full of vegetables.",
			"es-AR": "Malfoid levanta con orgullo dos bolsas de tela reutilizables con verduras.",
		},
		prompt: { en: "Did you remember the bags?", "es-AR": "¿Te acordaste de las bolsas?" },
	},
	"earth-day-watering-flowers": {
		category: "earth-day",
		alt: {
			en: "Malfoid gently waters three flowers with a small emerald watering can.",
			"es-AR": "Malfoid riega con delicadeza tres flores con una regadera esmeralda.",
		},
		prompt: {
			en: "Can you water my plants while I'm away?",
			"es-AR": "¿Me riegas las plantas mientras no estoy?",
		},
	},
	"earth-day-bicycle": {
		category: "earth-day",
		alt: {
			en: "Malfoid rides a small emerald bicycle in a matching helmet, beaming.",
			"es-AR": "Malfoid pedalea en una pequeña bicicleta esmeralda con un casco a juego.",
		},
		prompt: { en: "How are you getting here?", "es-AR": "¿Cómo vas a venir?" },
	},
	"earth-day-plant-rescue": {
		category: "earth-day",
		alt: {
			en: "Malfoid tends a drooping houseplant with a worried face, holding a little cup of water.",
			"es-AR": "Malfoid cuida una planta marchita sujetando una hoja y una pequeña taza de agua.",
		},
		prompt: { en: "My plant is dying.", "es-AR": "Mi planta se está muriendo." },
	},
	"earth-day-butterfly-friend": {
		category: "earth-day",
		alt: {
			en: "Malfoid watches a butterfly land on her fingertip with a gentle, amazed smile.",
			"es-AR": "Malfoid observa maravillada una mariposa posada en su dedo.",
		},
		prompt: {
			en: "Look outside, it's so pretty today.",
			"es-AR": "Mira afuera, está precioso hoy.",
		},
	},
	"memes-temple-tap": {
		category: "memes",
		alt: {
			en: "Malfoid taps her temple with a knowing smirk.",
			"es-AR": "Malfoid se toca la sien con una sonrisa astuta.",
		},
		prompt: { en: "How did you get out of that one?", "es-AR": "¿Cómo te salvaste de esa?" },
	},
	"memes-this-is-fine": {
		category: "memes",
		alt: {
			en: "Malfoid calmly sips tea beside a smoking cauldron.",
			"es-AR": "Malfoid toma té con calma junto a un caldero humeante.",
		},
		prompt: { en: "How's your week going?", "es-AR": "¿Cómo va tu semana?" },
	},
	"memes-confused-calculations": {
		category: "memes",
		alt: {
			en: "Malfoid looks baffled as geometric figures float around her head.",
			"es-AR":
				"Malfoid mira confundida mientras figuras geométricas flotan alrededor de su cabeza.",
		},
		prompt: { en: "Can you split the bill?", "es-AR": "¿Puedes dividir la cuenta?" },
	},
	"memes-take-my-money": {
		category: "memes",
		alt: {
			en: "Malfoid eagerly thrusts a bulging coin pouch forward, gold coins flying.",
			"es-AR": "Malfoid lanza hacia adelante una bolsa de monedas con entusiasmo.",
		},
		prompt: { en: "They're making a sequel.", "es-AR": "Van a hacer una secuela." },
	},
	"memes-tiny-victory": {
		category: "memes",
		alt: {
			en: "Malfoid makes a small clenched fist with a tight, satisfied grin.",
			"es-AR": "Malfoid cierra un puño junto al pecho con una pequeña sonrisa de triunfo.",
		},
		prompt: {
			en: "The printer worked on the first try.",
			"es-AR": "La impresora funcionó a la primera.",
		},
	},
	"memes-salt-bae": {
		category: "memes",
		alt: {
			en: "Malfoid sprinkles golden sparkles with the bent-wrist Salt Bae gesture.",
			"es-AR": "Malfoid esparce destellos dorados con el gesto del meme Salt Bae.",
		},
		prompt: { en: "Add a little extra to mine.", "es-AR": "Al mío ponle un poco más." },
	},
	"memes-disaster-smirk": {
		category: "memes",
		alt: {
			en: "Malfoid smirks guiltily beside a toppled potion flask, hands behind her back.",
			"es-AR":
				"Malfoid sonríe con culpa junto a un frasco de poción volcado con las manos detrás de la espalda.",
		},
		prompt: { en: "What happened in the kitchen?", "es-AR": "¿Qué pasó en la cocina?" },
	},
	"memes-brain-buffering": {
		category: "memes",
		alt: {
			en: "Malfoid stares blankly with a loading ring above her head.",
			"es-AR":
				"Malfoid se queda inmóvil con la mirada perdida y un círculo de carga sobre la cabeza.",
		},
		prompt: {
			en: "Did you read my 12-paragraph message?",
			"es-AR": "¿Leíste mi mensaje de 12 párrafos?",
		},
	},
	"memes-reject-approve": {
		category: "memes",
		alt: {
			en: "Malfoid pushes away a gray ball and proudly presents a golden star.",
			"es-AR": "Malfoid rechaza una esfera gris y presenta con orgullo una estrella dorada.",
		},
		prompt: { en: "Salad or pizza?", "es-AR": "¿Ensalada o pizza?" },
	},
	"memes-table-flip": {
		category: "memes",
		alt: {
			en: "Malfoid angrily flips a tiny table with both hands.",
			"es-AR": "Malfoid voltea una mesita con ambas manos, furiosa.",
		},
		prompt: {
			en: "The update deleted all my work.",
			"es-AR": "La actualización borró todo mi trabajo.",
		},
	},
} as const satisfies Record<string, StickerEntry>;

/** A sticker's file name without its size or extension. */
export type StickerId = keyof typeof STICKER_CATALOG;

/** One sticker with its id, as the gallery lists it. */
export interface Sticker extends StickerEntry {
	id: StickerId;
}

/**
 * Every sticker in the gallery's order, set by set, so stepping through the viewer follows the
 * page and a tile's index is its slide.
 */
export const STICKERS: ReadonlyArray<Sticker> = STICKER_CATEGORIES.flatMap((category) =>
	Object.entries(STICKER_CATALOG)
		.filter(([, entry]) => entry.category === category)
		.map(([id, entry]) => ({ id: id as StickerId, ...entry })),
);
