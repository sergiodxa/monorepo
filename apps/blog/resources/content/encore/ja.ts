/**
 * Encore's pages in Japanese, in the app's casual, friendly voice. Card titles and prompts,
 * hints and labels are the app's own Japanese strings, so the page shows exactly what a
 * player reads on the card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EncoreCopy, EncorePagesCopy } from "~/resources/content/encore/copy";

/** The landing, header and footer in Japanese. */
export const JA: EncoreCopy = {
	locale: "ja",
	badge: "ja-jp",
	languageName: "日本語",
	meta: {
		title: "Encore：iPhone、iPad、Apple Watch、Mac で遊べる音楽パーティーゲーム",
		description:
			"カードを引いて、お題をめくって、ぴったりの曲を歌おう。手書きのお題は108枚、日本語・英語・スペイン語に対応。お支払いは一度きりの US$4.99 です。",
	},
	header: { support: "サポート", privacy: "プライバシー", navLabel: "Encore" },
	footer: {
		tagline: "おなじみの一曲を、みんなの思い出に。",
		columns: { encore: "Encore", more: "Sergio のほかの作品", elsewhere: "SNS" },
		download: "ダウンロード",
		blog: "ブログ",
		madeBy: "制作：",
		languages: "言語",
	},
	appStore: "App Store からダウンロード",
	hero: {
		eyebrow: "iPhone・iPad・Apple Watch・Mac の音楽パーティーゲーム",
		title: "次の夜は、一曲から始まる。",
		description:
			"カードを引いて、お題をめくって、ぴったりの曲を歌おう。「実は好きな曲」から「初めての二人でデュエット」まで、手書きのお題が108枚。さっき歌ったばかりのお題とは、なるべくかぶらないように配ります。",
		tour: "遊び方を見る",
		note: "US$4.99 の買い切り。サブスクも広告もなく、すべてのカード入り。",
	},
	tour: {
		eyebrow: "遊び方",
		title: "カードを引いて、みんなで歌おう。",
		description:
			"ゲームはカード一枚だけ。メニューも、プレイヤー登録も、点数もありません。タップして、歌って、スワイプ。",
		stageLabel: "1ラウンドの4つの動き",
		steps: [
			{
				title: "タップして表示",
				body: "テーブルの真ん中に裏向きのカード。タップするとくるっとめくれます。",
			},
			{
				title: "お題に合わせて歌う",
				body: "声に出して読んで、ぴったりの曲を選ぼう。最初に思いついた人がマイクを握ります。",
			},
			{
				title: "終わったらスワイプ",
				body: "カードを払いのけると、次のお題がもう表向きで待っています。",
			},
			{
				title: "振ってシャッフル",
				body: "iPhone を振ると新しいデッキに。カードはまた裏向きから。キーボードがあれば Command-R でも。",
			},
		],
	},
	deck: {
		eyebrow: "デッキ",
		title: "手書きのお題、108枚",
		description:
			"どのカードも、そのグループにしか選べない曲を求めます。自分のこと、その場にいるみんなのこと、曲のタイトルのこと。同じ雰囲気のお題が続かないように Encore が混ぜて配り、iPhone を振ればいつでも新しいデッキに。",
		listLabel: "デッキのカード",
		generated: "組み合わせのお題",
	},
	cards: {
		a001: { title: "実は好きな曲", prompt: "ちょっと恥ずかしいけど、実は大好きな曲を歌おう。" },
		a002: {
			title: "主人公",
			prompt: "自分の人生が映画なら、いちばん大事なシーンで流れる曲を歌おう。",
		},
		a060: {
			title: "初めての二人でデュエット",
			prompt: "今まで一緒に歌ったことのない人を選ぼう。今すぐ一緒にデュエットしよう。",
		},
		a100: {
			title: "アンコール",
			prompt: "ここまでよくやった！好きな曲を自由に歌おう。ルールはなし。",
		},
		generated: { prompt: "90年代のなつかしい曲を歌おう。" },
	},
	watch: {
		eyebrow: "Apple Watch",
		title: "手首から、夜を回そう",
		description:
			"iPhone はみんなが読めるようにテーブルに置いたまま。Apple Watch にカードが表示され、iPhone のカードをめくったり、配ったり、シャッフルしたりできます。",
		items: [
			"「カードはOK！」、そしてお題そのものが手首に",
			"「カードを見る」「次へ」「シャッフル」を、手応えのあるタップで",
			"iPhone と自動でつながるので、サインインは不要",
			"近くで Encore を開いている iPhone のリモコンとして動きます",
		],
	},
	details: {
		eyebrow: "細かいところ",
		title: "その場に合わせて",
		description: "手元の画面に合わせて、あなたの言葉で。音は、オンにするまで鳴りません。",
		items: {
			mac: {
				title: "Mac で",
				body: "iPad 版アプリが Apple シリコン搭載の Mac でもそのまま動きます。キーボードなら Command-R でシャッフル。",
			},
			ipad: {
				title: "iPad で",
				body: "どの向きでも使えるので、テーブルの真ん中に立てておけます。",
			},
			languages: {
				title: "あなたの言葉で",
				body: "すべてのカードを、日本語・英語・スペイン語・アルゼンチンのスペイン語で。",
			},
			undo: {
				title: "早くスワイプしすぎた？",
				body: "取り消すと直前のカードが戻ります。次のシャッフルまで使えます。",
			},
			feedback: {
				title: "サウンドと振動",
				body: "設定でオンにするまではオフ。iPhone が消音モードなら効果音も鳴りません。",
			},
			access: {
				title: "テーブルのみんなに",
				body: "VoiceOver がカードを読み上げ、「視差効果を減らす」ではカードがめくれずにフェードします。",
			},
		},
		app: {
			game: "ゲーム",
			shuffleDeck: "デッキをシャッフル",
			previousCard: "前のカード",
			feedback: "タップと音の設定",
			haptics: "タップの振動",
			sounds: "効果音",
			faceDown: "裏向きのカード。タップして表示。",
		},
	},
	privacy: {
		eyebrow: "プライバシー",
		title: "誰も聞いていません",
		description:
			"Encore はマイクを一切使いません。歌声はその部屋の中だけ。ゲームは何も記録しません。",
		checks: [
			"アカウントもサインインも不要",
			"マイク、録音、音声認識は使いません",
			"広告、分析、トラッキングなし",
			"すべてのカードがアプリに入っていて、オフラインで遊べます",
			"iPhone と Apple Watch のやりとりは、2台の間だけ",
		],
		policy: "プライバシーポリシーを読む",
	},
	faq: {
		eyebrow: "よくある質問",
		title: "最初の一曲の前に",
		columns: [
			[
				[
					"Encore は音楽を流しますか？",
					"いいえ。Encore はお題を配るだけで、曲はみなさんが用意します。カラオケの音源でも、スピーカーでも、ギターでも、歌声だけでも。",
				],
				[
					"何人で遊べますか？",
					"ひとつの画面を読める人数なら何人でも。プレイヤー登録も、順番も、点数もないので、誰でもカードを引けます。",
				],
				[
					"インターネット接続は必要ですか？",
					"いいえ。すべてのカードがアプリに入っているので、電車でも、山小屋でも、地下でも同じように遊べます。",
				],
				[
					"子どもも遊べますか？",
					"はい。App Store の年齢制限は 4+ です。どのカードも、曲を歌うお題だけです。",
				],
				[
					"同じカードがまた出ますか？",
					"手書きの108枚が全部出るまでは出ません。その後は組み合わせのお題を少しはさんで次の一巡へ。iPhone を振れば、いつでも新しいデッキにできます。",
				],
			],
			[
				[
					"対応している言語は？",
					"日本語、英語、スペイン語、アルゼンチンのスペイン語です。デバイスの言語に合わせて表示されます。",
				],
				[
					"Apple Watch だけで遊べますか？",
					"Apple Watch は iPhone のゲームのリモコンです。近くの iPhone で Encore を開いている間、カードの表示、めくる・配る・シャッフルができます。",
				],
				[
					"価格はいくらですか？",
					"App Store で US$4.99（お住まいの地域の相当額）の買い切りです。サブスク、アプリ内課金、広告はありません。",
				],
				[
					"家族で共有できますか？",
					"はい。ファミリー共有に対応しているので、一度購入すればファミリーグループの全員がダウンロードできます。",
				],
				[
					"効果音や振動はありますか？",
					"あります。最初はどちらもオフなので、「設定」アプリの Encore からオンにしてください。",
				],
			],
		],
	},
	closing: {
		title: "歌は、まだまだ続く。",
		description: "みんなで集まろう。おなじみの一曲を、みんなの思い出に。",
		support: "お困りですか？サポートはこちら",
	},
	screens: {
		"card-back": "「タップして表示」のヒントがついた裏向きのカード",
		challenge: "めくった手書きのお題カード",
		swipe: "横に払われたカードと、その後ろの次のお題",
		shuffle: "振った後の新しい裏向きのカードと、広がったデッキ",
		generated: "タイトルのない組み合わせのお題",
		"watch-ready": "「カードはOK！」と「カードを見る」「シャッフル」を表示した Apple Watch",
		"watch-challenge": "お題と「次へ」「シャッフル」を表示した Apple Watch",
	},
	placeholder: "スクリーンショット準備中",
};

/** The privacy and support pages in Japanese. */
export const JA_PAGES: EncorePagesCopy = {
	privacy: {
		forLine: "iPhone、iPad、Apple Watch、Mac 版 Encore のプライバシーポリシーです。",
		viewMarkdown: "Markdown で見る",
	},
	support: {
		title: "Encore サポート",
		description:
			"iPhone、iPad、Apple Watch、Mac 向け Encore: Music Party Game のサポート。不具合の報告、ご質問、機能のご提案はこちらから。",
		intro: [
			"ご質問、不具合、Encore へのアイデアがあれば、下のフォームからお送りください。",
			"うまく動かないときは、お使いのデバイス、起きたこと、期待していた動きを教えてください。再現手順や、わかれば OS とアプリのバージョンも書いていただけると助かります。",
		],
		formTitle: "サポートフォーム",
		sent: "サポートのお問い合わせを送信しました。ご入力いただいたメールアドレスにご返信します。",
		sendAnother: "別のお問い合わせを送る",
		failed: "送信できませんでした。メッセージは残っていますので、もう一度お試しください。",
		rateLimited:
			"短い時間に何度も送信されています。メッセージは残っていますので、1分ほど待ってからもう一度お試しください。",
		resubmit:
			"送信前にフォームの有効期限が切れました。メッセージは残っていますので、もう一度送信してください。",
		invalid: "赤く表示された項目を直してから、もう一度送信してください。",
		name: "お名前（任意）",
		email: "メールアドレス",
		topic: "お問い合わせの種類",
		chooseTopic: "種類を選んでください",
		device: "デバイス",
		chooseDevice: "デバイスを選んでください",
		osVersion: "OS のバージョン（任意）",
		osPlaceholder: "例：iOS 26.1",
		appVersion: "アプリのバージョン（任意）",
		appPlaceholder: "例：1.2",
		message: "メッセージ",
		messagePlaceholder: "ご質問、不具合、ご提案の内容をお書きください…",
		notice:
			"お送りいただいた情報は、お問い合わせへの返信と不具合の調査に使います。パスワード、支払い情報などの機密情報は書かないでください。詳しくは",
		privacyLink: "プライバシーポリシー",
		noticeJoiner: "",
		noticeEnd: "をご覧ください。",
		submit: "お問い合わせを送信",
		pending: "送信中…",
		topics: {
			"Bug report": "不具合の報告",
			Question: "ご質問",
			"Feature request": "機能のご提案",
			Other: "その他",
		},
		platforms: {
			iPhone: "iPhone",
			iPad: "iPad",
			"Apple Watch": "Apple Watch",
			Mac: "Mac",
			Other: "その他",
		},
	},
};
