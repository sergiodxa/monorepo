/**
 * Every sticker in the pack, in the order the app lists them: the mood it belongs to, the alt
 * text that describes it, and a friend's message it answers, in each language the landing is
 * written in. The artwork is served from `/apps/malfoid/stickers/` as WebP at 240 and 480 pixels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PageLocale } from "~/app/services/page-locale";

/** The six moods the pack is grouped by, in the order the app shows them. */
export const STICKER_CATEGORIES = [
	"pride-and-sarcasm",
	"anger-and-frustration",
	"tsundere-and-embarrassment",
	"happiness-and-affection",
	"sadness-and-exhaustion",
	"everyday-reactions",
] as const;

/** One of the pack's six moods. */
export type StickerCategory = (typeof STICKER_CATEGORIES)[number];

/** What a sticker shows, the mood it belongs to and the message it is the perfect reply to. */
export interface StickerEntry {
	category: StickerCategory;
	alt: Record<PageLocale, string>;
	/** A friend's message the sticker answers, for the gallery's example conversation. */
	prompt: Record<PageLocale, string>;
}

/** All 60 stickers by file name, ten per mood, in the app's order. */
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
} as const satisfies Record<string, StickerEntry>;

/** A sticker's file name without its size or extension. */
export type StickerId = keyof typeof STICKER_CATALOG;

/** One sticker with its id, as the gallery lists it. */
export interface Sticker extends StickerEntry {
	id: StickerId;
}

/** Every sticker in the app's order. */
export const STICKERS: ReadonlyArray<Sticker> = Object.entries(STICKER_CATALOG).map(
	([id, entry]) => ({ id: id as StickerId, ...entry }),
);
