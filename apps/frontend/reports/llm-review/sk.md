# LLM Review: Slovak (sk)

**Model:** gemini-2.5-flash  
**Took:** 188.6s  
**Fixes proposed:** 182 (valid after placeholder-check: 173)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | Izby | **Miestnosti** | Use 'Miestnosti' for general rooms, 'Izby' is more for hotel rooms. |
| `nav.enterpriseSettings` | Podnikové nastavenia | **Nastavenia Enterprise** | Preserve 'Enterprise' as a tier name. |
| `nav.createRoom` | Vytvorte miestnosť | **Vytvoriť miestnosť** | Use infinitive 'Vytvoriť' for menu items, not imperative. |
| `rooms.tabs.questFlow` | Priebeh úloh | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `rooms.noRoomsInCategory` | V tejto kategórii zatiaľ nie sú žiadne izby. | **V tejto kategórii zatiaľ nie sú žiadne miestnosti.** | Use 'miestnosti' for general rooms, 'izby' is more for hotel rooms. |
| `rooms.closed` | ZATVORENÉ | **Zatvorená** | Avoid all caps in UI. 'Zatvorená' agrees with 'miestnosť'. |
| `rooms.actions.open` | Prihlásenie | **Vstúpiť** | 'Prihlásenie' means 'login'. 'Vstúpiť' means 'enter'. |
| `common.open` | OTVORENÉ | **Otvoriť** | Avoid all caps in UI. Use infinitive 'Otvoriť'. |
| `common.select` | Vyberte | **Vybrať** | Use infinitive 'Vybrať' for button labels, not imperative. |
| `common.edit` | Zmena | **Zmeniť** | 'Zmena' is a noun. Use infinitive 'Zmeniť' for button labels. |
| `common.success` | Pripravený | **Hotovo** | 'Pripravený' means 'ready'. 'Hotovo' means 'done/success'. |
| `balance.minutes_few` | {{count}} minút | **{{count}} minúty** | Correct plural form for 'few' minutes in Slovak. |
| `balance.openPlans` | Otvorené tarify a zostatok | **Otvoriť tarify a zostatok** | Use infinitive 'Otvoriť' for menu items, not adjective 'Otvorené'. |
| `tier.plus` | Navyše | **Plus** | Preserve 'Plus' as a tier name. |
| `tier.enterprise` | Podnik | **Enterprise** | Preserve 'Enterprise' as a tier name. |
| `settings.themeDarkSub` | Abyss Aurora (temná) | **Abyss Aurora (Dark)** | Preserve 'Dark' as part of the theme name. |
| `settings.themeLightSub` | Polárna žiara v oblakoch (svetlá) | **Cloud Aurora (Light)** | Preserve 'Cloud Aurora' and 'Light' as part of the theme name. |
| `partner.subtitle` | Share your link and earn | **Zdieľajte svoj odkaz a zarábajte** | Translate English string to Slovak. |
| `partner.yourLink` | Your link | **Váš odkaz** | Translate English string to Slovak. |
| `partner.copy` | Copy | **Kopírovať** | Translate English string to Slovak. |
| `partner.copied` | ✓ Link copied | **✓ Odkaz skopírovaný** | Translate English string to Slovak. |
| `partner.stats.clicks` | Clicks | **Kliknutia** | Translate English string to Slovak. |
| `partner.stats.registrations` | Sign-ups | **Registrácie** | Translate English string to Slovak. |
| `partner.stats.paid` | Payments | **Platby** | Translate English string to Slovak. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} používateľov · {{minutes}} min** | Translate English string to Slovak. |
| `partner.terms` | Program terms | **Podmienky programu** | Translate English string to Slovak. |
| `partner.contact` | Contact us | **Kontaktujte nás** | Translate English string to Slovak. |
| `partner.termsModalTitle` | Partner program terms | **Podmienky partnerského programu** | Translate English string to Slovak. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Podmienky programu zatiaľ nie sú nastavené. Kontaktujte, prosím, SuperAdmina.** | Translate English string to Slovak. |
| `partner.loadError` | Failed to load partner data | **Nepodarilo sa načítať partnerské údaje** | Translate English string to Slovak. |
| `toneMenu.explainIn` | Vysvetlite tónom | **Vysvetliť v tóne** | Use infinitive 'Vysvetliť' for menu items, not imperative. |
| `toneMenu.generating` | UI generuje vysvetlenie… | **AI generuje vysvetlenie…** | Correct 'UI' to 'AI'. |
| `sip.subtitle` | Nastavenie trunkov pre prichádzajúce a odchádzajúce hovory | **Nastavenie SIP trunkov pre prichádzajúce a odchádzajúce hovory** | Clarify 'trunkov' with 'SIP'. |
| `sip.editTrunk` | Zmeniť nastavenia kufra | **Zmeniť nastavenia SIP trunku** | 'Kufor' means 'suitcase'. Use 'SIP trunku' for technical term. |
| `sip.trunkId` | ID kufra | **ID trunku** | 'Kufor' means 'suitcase'. Use 'trunku' for technical term. |
| `sip.passwordChangeLabel` | Nové heslo (nechajte prázdne, ak ho chcete zmeniť) | **Nové heslo (nechajte prázdne, ak ho nechcete zmeniť)** | Correct the logic: 'if you DON'T want to change it'. |
| `sip.createTrunk` | Vytvorte kmeň | **Vytvoriť SIP trunk** | Use infinitive 'Vytvoriť' for button labels. 'Kmeň' is incorrect for SIP trunk. |
| `sip.incoming.create` | Vytvorenie SIP adresy pre prichádzajúce hovory | **Vytvoriť SIP adresu pre prichádzajúce hovory** | 'Vytvorenie' is a noun. Use infinitive 'Vytvoriť' for button labels. |
| `sip.incoming.activeHint` | Prekladač Bridge počúva rozprávanie v miestnosti. Každý hovor je prekladaný v reálnom čase. | **Prekladač Bridge počúva miestnosť. Každý hovor je prekladaný v reálnom čase.** | 'Počúva rozprávanie v miestnosti' is verbose. 'Počúva miestnosť' is more natural. |
| `sip.incoming.pausedHint` | Aktivujte príjem, aby VibeVox začal presmerovávať prichádzajúce hovory. | **Aktivujte príjem, aby VibeVox začal prekladať prichádzajúce hovory.** | 'Presmerovávať' means 'redirect'. The source implies 'translate'. |
| `sip.incoming.reissue` | Znovu vydané | **Znovu vydať** | Use infinitive 'Znovu vydať' for button labels, not past participle. |
| `sip.outbound.lead` | Zavolajte na telefónne číslo z webového rozhrania a VibeVox automaticky prenesie váš rozhovor v reálnom čase. | **Zavolajte na telefónne číslo z webového rozhrania a VibeVox automaticky preloží váš rozhovor v reálnom čase.** | 'Prenesie' means 'transfer'. The source implies 'translate'. |
| `sip.toasts.saveFailed` | Nepodarilo sa uložiť kmeň | **Nepodarilo sa uložiť trunk** | 'Kmeň' is incorrect for SIP trunk. |
| `sip.toasts.deleted` | Kmeň bol odstránený. | **Trunk bol odstránený.** | 'Kmeň' is incorrect for SIP trunk. |
| `sip.toasts.deleteFailed` | Nepodarilo sa odstrániť kmeň | **Nepodarilo sa odstrániť trunk** | 'Kmeň' is incorrect for SIP trunk. |
| `sip.tenantOnly.title` | SIP trunkové linky sú konfigurované na úrovni nájomníka | **SIP trunky sú konfigurované na úrovni nájomníka** | 'SIP trunky' is more direct than 'SIP trunkové linky'. |
| `sip.danger.deleteTrunk` | Odstrániť kmeň | **Odstrániť trunk** | 'Kmeň' is incorrect for SIP trunk. |
| `sip.danger.deleteTrunkHint` | Konfigurácia bude vymazaná. Odchádzajúce hovory sa zastavia, kým znovu nevytvoríte kmeňovú linku. | **Konfigurácia bude vymazaná. Odchádzajúce hovory sa zastavia, kým znovu nevytvoríte trunk.** | 'Kmeňovú linku' is incorrect for SIP trunk. |
| `sip.danger.deleteInboundHint` | Pravidlo pre prichádzajúce linky a dispečing LiveKit bude odstránené. Prichádzajúce hovory už nebudú prijímané. | **LiveKit inbound trunk a dispatch rule budú odstránené. Prichádzajúce hovory už nebudú prijímané.** | Preserve technical terms 'inbound trunk' and 'dispatch rule'. |
| `sip.danger.reissueHint` | Znovu vydajte prihlasovacie meno a heslo pre SIP adresu. Staré informácie už nebudú fungovať. | **Znovu vydať prihlasovacie meno a heslo pre SIP adresu. Staré informácie už nebudú fungovať.** | Use infinitive 'Znovu vydať' for a hint/description. |
| `sip.outbound2.callButton` | Zavolajte | **Zavolať** | Use infinitive 'Zavolať' for button labels, not imperative. |
| `sip.confirm.deleteTrunkBody` | Táto akcia je nezvratná. Po odstránení sa odchádzajúce hovory zastavia, kým sa nevytvorí nový kanál. | **Táto akcia je nezvratná. Po odstránení sa odchádzajúce hovory zastavia, kým sa nevytvorí nový trunk.** | 'Kanál' means 'channel'. Use 'trunk' for SIP trunk. |
| `sip.confirm.deleteInboundTitle` | Odstrániť SIP adresu pre prichádzajúce správy? | **Odstrániť SIP adresu pre prichádzajúce hovory?** | 'Správy' means 'messages'. Should be 'hovory' (calls). |
| `sip.confirm.deleteInboundBody` | Táto akcia je nezvratná. Pravidlo pre prichádzajúce linky a odosielanie v službe LiveKit Cloud bude odstránené. | **Táto akcia je nezvratná. Inbound trunk a dispatch rule v LiveKit Cloud budú odstránené.** | Preserve technical terms 'inbound trunk' and 'dispatch rule'. |
| `enterprise.page.title` | Podnikové nastavenia | **Nastavenia Enterprise** | Preserve 'Enterprise' as a tier name. |
| `enterprise.page.upsellTitle` | Táto sekcia je k dispozícii v rámci podnikového plánu. | **Táto sekcia je k dispozícii v rámci plánu Enterprise.** | Preserve 'Enterprise' as a tier name. |
| `enterprise.tabs.gemini` | Rozhranie API Gemini | **Gemini API** | Keep 'Gemini API' concise and as a technical term. |
| `enterprise.tabs.questFlow` | Priebeh úloh | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.common.recheck` | Skontroluj znova | **Skontrolovať znova** | Use infinitive 'Skontrolovať' for button labels. |
| `enterprise.gemini.aiStudioLink` | Štúdio umelej inteligencie | **AI Studio** | Preserve 'AI Studio' as a brand name. |
| `enterprise.gemini.validateLabel` | Skontroluj znova | **Skontrolovať znova** | Use infinitive 'Skontrolovať' for button labels. |
| `enterprise.gemini.telegram.leadStartCmd` | /začiatok | **/start** | Preserve '/start' as a command. |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ Bot @{{username}} uložený. Pozdrav doručený odberateľom {{sent}}. | **✓ Bot @{{username}} uložený. Pozdrav doručený {{sent}} odberateľom.** | Correct word order for number and noun. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Bot @{{username}} bol uložený. Každý, kto mu pošle SMS s textom /start, dostane upozornenia. | **✓ Bot @{{username}} bol uložený. Každý, kto mu napíše /start, dostane upozornenia.** | Simplify 'pošle SMS s textom' to 'napíše'. Preserve '/start'. |
| `enterprise.gemini.telegram.successTestMany` | ✓ Správa doručená príjemcom {{count}}. Skontrolujte si Telegram. | **✓ Správa doručená {{count}} príjemcom. Skontrolujte si Telegram.** | Correct word order for number and noun. |
| `enterprise.gemini.telegram.testingLabel` | Prilba… | **Odosielame…** | 'Prilba' means 'helmet'. 'Odosielame' means 'sending'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Rozviazať | **Odpojiť** | 'Rozviazať' means 'untie'. 'Odpojiť' means 'disconnect'. |
| `enterprise.prompt.subtitle` | Rýchlosť a vedomostná základňa pre prepis iba vo video miestnostiach | **Prompt a znalostná základňa iba pre prepis vo video miestnostiach** | 'Rýchlosť' means 'speed'. 'Prompt' should be preserved or translated as 'výzva'. |
| `enterprise.prompt.headerLeadBold2` | „Podľa vašej žiadosti“ | **„Podľa vášho promptu“** | 'Žiadosti' means 'request'. 'Prompt' should be preserved or translated as 'výzvy'. |
| `enterprise.prompt.contextHeading` | Kontext / podnet | **Kontext / prompt** | 'Podnet' means 'stimulus'. 'Prompt' should be preserved or translated as 'výzva'. |
| `enterprise.prompt.contextLeadBold` | „Podľa vašej žiadosti“ | **„Podľa vášho promptu“** | 'Žiadosti' means 'request'. 'Prompt' should be preserved or translated as 'výzvy'. |
| `enterprise.prompt.contextLeadPart2` | Znalostná základňa je tiež zmiešaná (nižšie). | **Znalostná báza sa tiež pridáva (nižšie).** | 'Zmiešaná' is a bit passive. 'Pridáva sa' is more active and natural. |
| `enterprise.prompt.kbCharsSuffix` | symboly | **znakov** | 'Symboly' is less precise than 'znakov' (characters). |
| `enterprise.prompt.successFileUploaded` | Súbor „{{filename}}“ ({{format}}) načítaný – uložené znaky {{kbLength}}. | **Súbor „{{filename}}“ ({{format}}) nahraný – uložených {{kbLength}} znakov.** | 'Načítaný' means 'loaded'. 'Nahraný' means 'uploaded'. Correct word order for number and noun. |
| `enterprise.prompt.presetsLeadPart1` | V chate Enterprise Room si môžete zvýrazniť ľubovoľnú správu a požiadať umelú inteligenciu, aby ju vysvetlila zvoleným tónom. Tlačidlo | **V chate Enterprise miestnosti si môžete zvýrazniť ľubovoľnú správu a požiadať umelú inteligenciu, aby ju vysvetlila zvoleným tónom. Tlačidlo** | Use 'miestnosti' for 'room' in Slovak. Preserve 'Enterprise'. |
| `enterprise.prompt.presetsLeadBold` | „Podľa vašej žiadosti“ | **„Podľa vášho promptu“** | 'Žiadosti' means 'request'. 'Prompt' should be preserved or translated as 'výzvy'. |
| `enterprise.questFlow.heading` | Priebeh úloh | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.apiKeyLabel` | Prichádzajúci kľúč API (nosič) | **Inbound API Key (Bearer)** | Preserve 'Inbound API Key (Bearer)' as technical terms. |
| `enterprise.questFlow.promptLabel` | Výzva systému Quest Flow | **Systémový prompt Quest Flow** | Preserve 'Quest Flow' as a brand name. Use 'prompt' or 'výzva'. |
| `enterprise.questFlow.kbLabel` | Databáza znalostí Quest Flow | **Znalostná báza Quest Flow** | Preserve 'Quest Flow' as a brand name. 'Znalostná báza' is more common than 'Databáza znalostí'. |
| `enterprise.questFlow.tagsLabel` | Potrebuje značky | **Značky potrieb** | 'Potrebuje značky' means 'needs tags'. 'Značky potrieb' means 'tags of needs'. |
| `enterprise.questFlow.headerLead` | Dialóg s každým klientom individuálne prostredníctvom telegramového bota pripojeného k Quest Flow. | **AI-dialóg s každým klientom individuálne prostredníctvom Telegram-bota, pripojeného v Quest Flow.** | Preserve 'Quest Flow' as a brand name. Add 'AI-' for clarity. |
| `enterprise.questFlow.keysHeading` | Kľúče API rozhrania Quest Flow | **API-kľúče Quest Flow** | Preserve 'Quest Flow' as a brand name. Simplify 'Kľúče API rozhrania' to 'API-kľúče'. |
| `enterprise.questFlow.keysLead` | Každý kľúč je tajný kód, ktorý vložíte do HTTP bloku Quest Flow v reťazci. VibeVox ho používa na identifikáciu vášho účtu. Môžete vytvoriť viacero kľúčov pre rôzne reťazce. | **Každý kľúč je tajný kód, ktorý vložíte do HTTP-bloku Quest Flow reťazca. VibeVox ho používa na identifikáciu vášho účtu. Môžete vytvoriť viacero kľúčov pre rôzne reťazce.** | Preserve 'Quest Flow' as a brand name. 'HTTP-bloku' is more precise. |
| `enterprise.questFlow.errDelete` | Delete error | **Chyba odstránenia** | Translate English string to Slovak. |
| `enterprise.questFlow.usedOn` | použité {{date}} | **použitý {{date}}** | Correct gender agreement for 'kľúč' (masculine). |
| `enterprise.questFlow.neverUsed` | nepoužíva sa | **nepoužitý** | Use adjective 'nepoužitý' (not used) instead of verb 'nepoužíva sa' (is not used). |
| `enterprise.questFlow.deleteTitle` | Delete | **Odstrániť** | Translate English string to Slovak. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Odstrániť kľúč?** | Translate English string to Slovak. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Kľúč bude natrvalo odstránený. Quest Flow prestane cez neho fungovať – bude potrebné vytvoriť nový kľúč a nahradiť ho v reťazci.** | Translate English string to Slovak. Preserve 'Quest Flow'. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Odstrániť** | Translate English string to Slovak. |
| `enterprise.questFlow.successPromptSaved` | Výzva k priebehu úlohy bola uložená. | **Prompt Quest Flow bol uložený.** | Preserve 'Quest Flow' as a brand name. Use 'Prompt' or 'Výzva'. |
| `enterprise.questFlow.kbHeading` | Znalostná základňa pre priebeh úloh | **Znalostná báza pre Quest Flow** | Preserve 'Quest Flow' as a brand name. 'Znalostná báza' is more common. |
| `enterprise.questFlow.kbLead2` | — umelá inteligencia nebude mať k dispozícii informácie o spoločnosti; bude reagovať iba na základe všeobecných vedomostí. Táto základňa | **— AI nebude mať k dispozícii informácie o spoločnosti; bude reagovať iba na základe všeobecných vedomostí. Táto báza** | Use 'AI' instead of 'umelá inteligencia' for brevity. 'Báza' is more common than 'základňa'. |
| `enterprise.questFlow.kbLeadBold2` | samostatný | **samostatná** | Correct gender agreement for 'báza' (feminine). |
| `enterprise.questFlow.kbLead3` | Z časti „Tipy“ – pre prepis videa. Limit: súbor 50 MB / 500 000 znakov v databáze. | **Od sekcie „Tipy“ – pre prepis videa. Limit: súbor 50 MB / 500 000 znakov v databáze.** | 'Od sekcie' is more direct than 'Z časti'. |
| `enterprise.questFlow.kbCharsSuffix` | symboly | **znakov** | 'Symboly' is less precise than 'znakov' (characters). |
| `enterprise.questFlow.successFileUploaded` | Súbor „{{filename}}“ bol načítaný ({{kbLength}} znaky). | **Súbor „{{filename}}“ bol nahraný ({{kbLength}} znakov).** | 'Načítaný' means 'loaded'. 'Nahraný' means 'uploaded'. Correct plural form for 'znakov'. |
| `enterprise.questFlow.tagsHeading` | Potrebuje značky | **Značky potrieb** | 'Potrebuje značky' means 'needs tags'. 'Značky potrieb' means 'tags of needs'. |
| `enterprise.questFlow.tagsLead` | Umelá inteligencia priradí tieto značky klientom, ak v konverzácii zistí zhodu. Značky sa zobrazia na karte izby klienta a prenesú sa do CRM (časť 4). | **AI priradí tieto značky klientom, ak v konverzácii zistí zhodu. Značky sa zobrazia na karte miestnosti klienta a prenesú sa do CRM (časť 4).** | Use 'AI' for brevity. Use 'miestnosti' for 'room'. |
| `enterprise.chatwoot.test` | Skontrolujte pripojenie | **Skontrolovať pripojenie** | Use infinitive 'Skontrolovať' for button labels. |
| `chat.openWithClient` | Otvorte chat s klientom | **Otvoriť chat s klientom** | Use infinitive 'Otvoriť' for button labels, not imperative. |
| `chat.backToRooms` | ← Späť na izby | **← Späť na miestnosti** | Use 'miestnosti' for general rooms, 'izby' is more for hotel rooms. |
| `chat.enterpriseOnlyHint` | Chatovacie miestnosti sú funkciou Enterprise. Zlepšite si svoj plán v sekcii „Cenník“. | **Chatovacie miestnosti sú funkciou Enterprise. Zmeňte si tarif v sekcii „Tarify“.** | Preserve 'Enterprise' as a tier name. 'Zmeňte si tarif' is more accurate than 'Zlepšite si svoj plán'. |
| `insights.recalc` | Prepočítanie | **Prepočítať** | 'Prepočítanie' is a noun. Use infinitive 'Prepočítať' for button labels. |
| `insights.summary` | Životopis | **Zhrnutie** | 'Životopis' means 'CV/resume'. 'Zhrnutie' means 'summary'. |
| `insights.sentiment` | Kľúč | **Tonalita** | 'Kľúč' means 'key'. 'Tonalita' means 'sentiment/tonality'. |
| `insights.leadScore` | Skóre náskoku | **Lead Score** | Preserve 'Lead Score' as a technical term. |
| `insights.analyzedReplies_one` | Analyzovaná replika {{count}} | **Analyzovaná {{count}} replika** | Correct word order for number and noun. |
| `insights.analyzedReplies_few` | Analyzovaných replik {{count}} | **Analyzované {{count}} repliky** | Correct word order and grammatical case for number and noun. |
| `insights.analyzedReplies_many` | Analyzovaných replik {{count}} | **Analyzovaných {{count}} replík** | Correct word order and grammatical case for number and noun. |
| `insights.analyzedReplies_other` | Analyzovaných replik {{count}} | **Analyzovaných {{count}} replík** | Correct word order and grammatical case for number and noun. |
| `insights.sentimentValues.positive` | Pozitívny | **Pozitívne** | Use neuter adjective 'Pozitívne' for general sentiment. |
| `insights.sentimentValues.neutral` | Neutrálny | **Neutrálne** | Use neuter adjective 'Neutrálne' for general sentiment. |
| `insights.leadValues.hot` | Horúce | **Horúci** | Correct gender agreement for 'lead' (masculine). |
| `insights.leadValues.warm` | Teplé | **Teplý** | Correct gender agreement for 'lead' (masculine). |
| `insights.leadValues.cold` | Chlad | **Studený** | 'Chlad' is a noun. Use adjective 'Studený' (cold). |
| `insights.thinking` | UI analyzuje dialógy... | **AI analyzuje dialóg...** | Correct 'UI' to 'AI'. Use singular 'dialóg'. |
| `lobby.nameLabel` | Ako sa voláš? | **Ako sa voláte?** | Use formal 'Vy' in UI context. |
| `lobby.audioConsent` | a tiež súhlas so spracovaním zvuku na preklad. | **a tiež súhlasíte so spracovaním zvuku na preklad.** | Add verb 'súhlasíte' (you agree) for grammatical correctness. |
| `lobby.nameError` | Zadajte svoje meno | **Prosím, zadajte svoje meno** | Add 'Prosím' for politeness. |
| `lobby.roomFullMsg` | Na stretnutí je už účastník. Kontaktujte organizátora stretnutia alebo požiadajte o nového účastníka. | **Na stretnutí je už účastník. Kontaktujte organizátora stretnutia alebo vytvorte novú miestnosť.** | 'Požiadajte o nového účastníka' is not the intended meaning. 'Vytvorte novú' (create a new one) is better. |
| `paywall.titleNoSub` | Ak chcete vytvoriť miestnosť, zaregistrujte sa, prosím, do programu | **Ak chcete vytvoriť miestnosť, aktivujte si tarif** | More concise and direct. 'Zaregistrujte sa do programu' is too long. |
| `paywall.titleLowBalance` | Na vašom zostatku nezostali žiadne minúty – zaregistrujte sa do programu alebo si kúpte viac | **Na vašom zostatku nezostali žiadne minúty – aktivujte si tarif alebo dokúpte** | More concise and direct. 'Zaregistrujte sa do programu' is too long. |
| `paywall.subtitle` | Vyberte si program alebo si kúpte viac minút – plaťte cez Stripe, okamžité vrátenie peňazí tu. | **Vyberte si program alebo si kúpte viac minút – plaťte cez Stripe, minúty sa pripíšu okamžite.** | 'Okamžité vrátenie peňazí tu' is awkward. 'Minúty sa pripíšu okamžite' is more accurate. |
| `paywall.popular` | Populárne | **Populárny** | Correct gender agreement for 'tarif/plán' (masculine). |
| `paywall.subscribe` | Dizajn | **Predplatiť** | 'Dizajn' means 'design'. 'Predplatiť' means 'subscribe'. |
| `paywall.featureMinutes` | {{count}} min. preklad | **{{count}} minút prekladu** | Use full word 'minút' for clarity. |
| `paywall.topupNoSubInfo` | ℹ Nemáte aktívne predplatné. K vášmu nákupu bude pridaná služba Plus za 19 €/mesiac – vo vašom programe je zahrnutých 60 minút, takže sa neúčtujú žiadne ďalšie poplatky. | **ℹ Nemáte aktívne predplatné. K vášmu nákupu bude pridaný tarif Plus za 19 €/mesiac – vo vašom tarife je zahrnutých 60 minút, takže sa neúčtujú žiadne ďalšie poplatky.** | Preserve 'Plus' as a tier name. Use 'tarif' instead of 'program'. |
| `paywall.topupPlusLine` | Plus tarifa (vrátane min. {{count}}) | **Tarif Plus (vrátane {{count}} minút)** | Preserve 'Plus' as a tier name. Use 'minút' for clarity. |
| `paywall.topupFreeLine` | ↳ {{count}} min zadarmo s tarifou | **↳ {{count}} minút zadarmo s tarifou** | Use full word 'minút' for clarity. |
| `paywall.topupAddon` | Dodatočný nákup {{count}} min × 0,17 € | **Dokúpte {{count}} minút × 0,17 €** | Use full word 'minút' for clarity. 'Dokúpte' is more direct. |
| `paywall.previewFailed` | Nedá sa vypočítať náklady | **Nepodarilo sa vypočítať náklady** | 'Nedá sa vypočítať' means 'cannot be calculated'. 'Nepodarilo sa' means 'failed to'. |
| `defaultRoom.namePattern` | Izba {{name}} · {{date}}, {{time}} | **Miestnosť {{name}} · {{date}}, {{time}}** | Use 'Miestnosť' for general rooms. |
| `postCallInsights.subtitle` | Podnik · prehľady po hovore | **Enterprise · prehľady po hovore** | Preserve 'Enterprise' as a tier name. |
| `postCallInsights.analyzing` | Poďme si analyzovať konverzáciu... | **Analyzujeme konverzáciu...** | 'Poďme si analyzovať' means 'Let's analyze'. 'Analyzujeme' means 'We are analyzing'. |
| `postCallInsights.metricLeadScore` | Skóre potenciálnych zákazníkov | **Lead Score** | Preserve 'Lead Score' as a technical term. |
| `postCallInsights.summary` | Životopis | **Zhrnutie** | 'Životopis' means 'CV/resume'. 'Zhrnutie' means 'summary'. |
| `postCallInsights.close` | Zatvoriť a vrátiť sa do izieb | **Zatvoriť a vrátiť sa do miestností** | Use 'miestností' for general rooms. |
| `settingsMore.logout` | Odhláste sa zo svojho účtu | **Odhlásiť sa z účtu** | Use infinitive 'Odhlásiť sa' for menu items. |
| `billingPage.balanceMinutes` | minúty | **minút** | Use genitive plural 'minút' when referring to a quantity of minutes. |
| `billingPage.tierLabel` | Sadzba | **Tarif** | 'Sadzba' means 'rate'. 'Tarif' is more appropriate for a subscription plan. |
| `billingPage.resume` | Životopis | **Obnoviť** | 'Životopis' means 'CV/resume'. 'Obnoviť' means 'resume/renew'. |
| `billingPage.promoHint` | Zľava sa uplatní automaticky pri registrácii do programu alebo pri zakúpení ďalších minút. | **Zľava sa uplatní automaticky pri aktivácii tarify alebo pri dokúpení minút.** | More concise and direct. 'Aktivácii tarify' is better. |
| `billingPage.stripeOpening` | Otvorenie platby... | **Otvárame platbu...** | 'Otvorenie' is a noun. 'Otvárame' is a verb (we are opening). |
| `billingPage.topupHelp` | Dodatočný posuvník nákupu. K dispozícii s aktívnym predplatným. | **Posuvník na dokúpenie minút. K dispozícii s aktívnym predplatným.** | More natural phrasing for 'top-up slider'. |
| `billingPage.topupCarried` | Odložené | **Prenesené** | 'Odložené' means 'postponed'. 'Prenesené' means 'transferred'. |
| `billingPage.minutesShort` | minúty | **minút** | Use genitive plural 'minút' when referring to a quantity of minutes. |
| `billingPage.tierPlusName` | Navyše | **Plus** | Preserve 'Plus' as a tier name. |
| `billingPage.tierEnterpriseName` | Podnik | **Enterprise** | Preserve 'Enterprise' as a tier name. |
| `billingPage.featureLiveSubs` | Titulky v reálnom čase | **Textové titulky v reálnom čase** | Add 'Textové' for precision, as per source. |
| `billingPage.featureLearnHub` | Centrum vzdelávania AI – jeho vlastné dialekty | **AI Learning Hub – vlastné dialekty** | Preserve 'AI Learning Hub' as a brand name. Simplify 'jeho vlastné' to 'vlastné'. |
| `billingPage.featureAllPlus` | Všetko z Plusu | **Všetko z Plus** | Preserve 'Plus' as a brand name, without inflection. |
| `billingPage.featureCalendar` | Kalendár Google – Termíny pre klientov | **Kalendár Google – Objednávanie klientov** | 'Termíny pre klientov' means 'appointments for clients'. 'Objednávanie klientov' means 'client booking'. |
| `billingPage.ctaSubscribePlus` | Získajte Plus | **Aktivovať Plus** | 'Získajte' means 'get'. 'Aktivovať' means 'activate'. Preserve 'Plus'. |
| `billingPage.ctaSubscribeStandard` | Objednať štandard | **Aktivovať Standard** | 'Objednať' means 'order'. 'Aktivovať' means 'activate'. Preserve 'Standard'. |
| `billingPage.whatsAppMessage` | Dobrý deň! Mám záujem o balík Enterprise VibeVox. | **Dobrý deň! Mám záujem o tarif Enterprise VibeVox.** | 'Balík' means 'package'. 'Tarif' is more appropriate for a subscription plan. Preserve 'Enterprise'. |
| `billingPage.languagesCount_one` | jazyk {{count}} | **{{count}} jazyk** | Correct word order for number and noun. |
| `billingPage.languagesCount_few` | jazyk {{count}} | **{{count}} jazyky** | Correct word order and plural form for 'few' languages. |
| `billingPage.languagesCount_many` | {{count}} jazyky | **{{count}} jazykov** | Correct plural form for 'many' languages. |
| `billingPage.languagesCount_other` | {{count}} jazyky | **{{count}} jazykov** | Correct plural form for 'other' languages. |
| `billingPage.renewsOn` | prípona {{date}} | **obnovenie {{date}}** | 'Prípona' means 'suffix'. 'Obnovenie' means 'renewal'. |
| `billingPage.searchResultsCount_one` | Nájdené: jazyk {{count}} | **Nájdený: {{count}} jazyk** | Correct word order and gender agreement for 'jazyk'. |
| `billingPage.searchResultsCount_many` | Nájdené: {{count}} jazyky | **Nájdených: {{count}} jazykov** | Correct grammatical case for 'many' languages. |
| `billingPage.searchResultsCount_other` | Nájdené: {{count}} jazyky | **Nájdených: {{count}} jazykov** | Correct grammatical case for 'other' languages. |
| `auth.login.submit` | Prihlásenie | **Prihlásiť sa** | 'Prihlásenie' is a noun. Use infinitive 'Prihlásiť sa' for button labels. |
| `auth.register.loginLink` | Prihlásenie | **Prihlásiť sa** | 'Prihlásenie' is a noun. Use infinitive 'Prihlásiť sa' for links. |
| `auth.register.namePlaceholder` | tvoje meno | **Vaše meno** | Use formal 'Vaše meno' in UI context. |
| `auth.register.agreementAnd` | A | ** a ** | Add spaces around 'a' for proper concatenation. |
| `auth.forgot.successTitle` | List bol odoslaný | **E-mail bol odoslaný** | 'List' means 'letter'. 'E-mail' is more appropriate. |
| `pwaInstall.buttonLabel` | Nainštalujte si aplikáciu | **Nainštalovať aplikáciu** | Use infinitive 'Nainštalovať' for button labels. |
| `pwaInstall.buttonSubtitle` | Prejdite na domovskú obrazovku – spustenie jedným klepnutím | **Na domovskú obrazovku – spustenie jedným klepnutím** | Simplify 'Prejdite na' to 'Na'. |
| `pwaInstall.buttonAria` | Nainštalujte si VibeVox ako aplikáciu | **Nainštalovať VibeVox ako aplikáciu** | Use infinitive 'Nainštalovať' for button labels. |

⚠ 9 fix(es) skipped (no-op, missing path, or would break placeholders).
