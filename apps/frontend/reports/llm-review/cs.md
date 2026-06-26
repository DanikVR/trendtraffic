# LLM Review: Czech (cs)

**Model:** gemini-2.5-flash  
**Took:** 230.6s  
**Fixes proposed:** 202 (valid after placeholder-check: 202)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | Pokoje | **Místnosti** | More natural for virtual rooms/meetings. |
| `nav.createRoom` | Vytvořte místnost | **Vytvořit místnost** | Infinitive form is more common for menu items/buttons. |
| `nav.home` | Domov | **Domů** | More natural for 'To home' in navigation context. |
| `rooms.title` | Překladatelské místnosti | **Místnosti pro překlad** | More natural phrasing for 'translation rooms'. |
| `rooms.subtitle` | Vaše aktivní lekce simultánního tlumočení | **Vaše aktivní schůzky simultánního překladu** | 'Lekce' (lessons) is incorrect; 'schůzky' (meetings/sessions) is better. |
| `rooms.tabs.questFlow` | Průběh úkolu | **Quest Flow** | Brand name 'Quest Flow' must be preserved, not translated. |
| `rooms.noRoomsInCategory` | V této kategorii zatím nejsou žádné pokoje. | **V této kategorii zatím nejsou žádné místnosti.** | Consistent use of 'místnosti' for virtual rooms. |
| `rooms.live` | Žít | **Živě** | 'Žít' is a verb; 'Živě' (live/in real-time) is appropriate for status. |
| `rooms.actions.open` | Přihlášení | **Vstoupit** | 'Přihlášení' means login; 'Vstoupit' (to enter) is better for joining a room. |
| `rooms.actions.chat` | Povídání | **Chat** | 'Chat' is commonly used and shorter for a UI label. |
| `rooms.actions.delete` | Vymazat | **Smazat** | 'Vymazat' means erase; 'Smazat' is better for deleting an item. |
| `rooms.confirmDelete.confirm` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `common.delete` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `common.close` | Blízko | **Zavřít** | 'Blízko' means near; 'Zavřít' is the correct verb for 'close'. |
| `common.back` | Zadní | **Zpět** | 'Zadní' is an adjective; 'Zpět' is the correct adverb for 'back' in navigation. |
| `common.open` | OTEVŘENO | **Otevřít** | Infinitive form is more common for buttons. |
| `common.edit` | Přeměna | **Upravit** | 'Přeměna' means transformation; 'Upravit' is correct for 'edit'. |
| `common.success` | Připraveno | **Hotovo** | 'Připraveno' means ready; 'Hotovo' is better for 'done/success'. |
| `common.no` | Žádný | **Ne** | 'Žádný' means none; 'Ne' is the simple 'no' answer. |
| `balance.label` | Váhy | **Zůstatek** | 'Váhy' means scales; 'Zůstatek' is correct for account balance. |
| `balance.openPlans` | Otevřené tarify a zůstatek | **Otevřít tarify a zůstatek** | Use infinitive 'Otevřít' for action; 'zůstatek' for balance. |
| `tier.standard` | Norma | **Standard** | Preserve 'Standard' as a tier name. |
| `moreSheet.createRoomAria` | Vytvořte si překladatelskou místnost | **Vytvořit překladatelskou místnost** | Infinitive form is more common for menu items/buttons. |
| `call.muted` | Žádný zvuk | **Ztlumeno** | 'Žádný zvuk' means no sound; 'Ztlumeno' is correct for muted. |
| `call.geminiLive` | Blíženci živě | **Gemini Live** | Brand name 'Gemini' must be preserved, not translated. |
| `call.toPlayground` | 🎯 Na skládku | **🎯 Na cvičiště** | 'Skládka' means dump; 'cvičiště' is better for 'playground/training ground'. |
| `call.expandPeer` | Rozbalte partnera | **Rozbalit partnera** | Infinitive form is more common for buttons/actions. |
| `call.micOn` | Vypněte mikrofon | **Vypnout mikrofon** | Infinitive form is more common for buttons/actions. |
| `call.micOff` | Zapněte mikrofon | **Zapnout mikrofon** | Infinitive form is more common for buttons/actions. |
| `call.camOn` | Vypněte fotoaparát | **Vypnout kameru** | Infinitive form for action; 'kamera' is more common for video calls. |
| `call.camOff` | Zapněte fotoaparát | **Zapnout kameru** | Infinitive form for action; 'kamera' is more common for video calls. |
| `call.more` | Navíc | **Více** | 'Navíc' means moreover; 'Více' is better for 'more' in a menu. |
| `call.validating` | Testování zabezpečeného připojení VibeVox… | **Ověřování zabezpečeného připojení VibeVox…** | 'Testování' means testing; 'Ověřování' is more precise for validating. |
| `coach.help` | Pomozte s odpovědí | **Pomoci odpovědět** | Infinitive form is more common for buttons/actions. |
| `coach.ask` | Zeptejte se umělé inteligence | **Zeptat se AI** | Infinitive form is more common for buttons/actions; 'AI' is preserved. |
| `coach.copy` | Kopie | **Kopírovat** | 'Kopie' is a noun; 'Kopírovat' is the correct verb for 'copy'. |
| `coach.close` | Blízko | **Zavřít** | Consistent use of 'Zavřít' for 'close'. |
| `coach.tonePrompts.joke` | Odpovězte lehkým, vhodným vtipem. | **Odpovědět lehkým, vhodným vtipem.** | Infinitive form is more suitable for a prompt description. |
| `coach.tonePrompts.formal` | Odpovězte důrazně formálním a zdvořilým způsobem. | **Odpovědět důrazně formálním a zdvořilým způsobem.** | Infinitive form is more suitable for a prompt description. |
| `coach.tonePrompts.short` | Odpovězte jednou krátkou větou | **Odpovědět jednou krátkou větou** | Infinitive form is more suitable for a prompt description. |
| `coach.tonePrompts.deep` | Uveďte hloubkovou analytickou odpověď s odůvodněním. | **Uvést hloubkovou analytickou odpověď s odůvodněním.** | Infinitive form is more suitable for a prompt description. |
| `coach.tonePrompts.scientific` | Odpovídejte jako vědec s odkazy na výzkum nebo data. | **Odpovědět jako vědec s odkazy na výzkum nebo data.** | Infinitive form is more suitable for a prompt description. |
| `coach.tonePrompts.empathic` | Reagujte empaticky a berte v potaz pocity druhého člověka. | **Reagovat empaticky a brát v potaz pocity druhého člověka.** | Infinitive form is more suitable for a prompt description. |
| `roomActions.translation.disableSub` | Zápisy se již nebudou odepisovat | **Minuty se již nebudou odepisovat** | 'Zápisy' means meeting minutes; 'Minuty' is correct for time units. |
| `roomActions.copyLink` | Zkopírujte odkaz do místnosti | **Zkopírovat odkaz do místnosti** | Infinitive form is more common for buttons/actions. |
| `billing.lowBalanceSub` | Kupte si další minuty, abyste mohli pokračovat v konverzaci. | **Dokupte minuty, aby se konverzace nepřerušila.** | 'Dokupte' is more precise for 'buy more/top up'. |
| `billing.paywallNoSub` | Chcete-li si vytvořit pokoj, zaregistrujte se k odběru plánu. | **Chcete-li vytvořit místnost, pořiďte si tarif.** | Consistent 'místnost'; shorter and more direct phrasing for 'get a plan'. |
| `billing.paywallLowBalance` | Na vašem zůstatku nejsou žádné minuty – zaregistrujte se k tarifu nebo si kupte další | **Na vašem zůstatku nejsou žádné minuty – pořiďte si tarif nebo dokupte.** | Consistent 'zůstatek'; shorter and more direct phrasing for 'get a plan' and 'top up'. |
| `settings.themeDarkSub` | Abyss Aurora (temná) | **Abyss Aurora (Dark)** | Preserve 'Dark' as it's part of the theme name. |
| `settings.themeLightSub` | Polární záře v oblaku (světlo) | **Cloud Aurora (Light)** | Preserve brand name 'Cloud Aurora' and 'Light' as part of theme name. |
| `partner.title` | Partner program | **Partnerský program** | Translate 'Partner program' to Czech 'Partnerský program'. |
| `partner.subtitle` | Share your link and earn | **Sdílejte svůj odkaz a vydělávejte** | Translate to Czech. |
| `partner.yourLink` | Your link | **Váš odkaz** | Translate to Czech. |
| `partner.copy` | Copy | **Kopírovat** | Translate to Czech. |
| `partner.copied` | ✓ Link copied | **✓ Odkaz zkopírován** | Translate to Czech. |
| `partner.stats.clicks` | Clicks | **Kliknutí** | Translate to Czech. |
| `partner.stats.registrations` | Sign-ups | **Registrace** | Translate to Czech. |
| `partner.stats.paid` | Payments | **Platby** | Translate to Czech. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} uživatelů · {{minutes}} min** | Translate to Czech. |
| `partner.terms` | Program terms | **Podmínky programu** | Translate to Czech. |
| `partner.contact` | Contact us | **Kontaktujte nás** | Translate to Czech. |
| `partner.termsModalTitle` | Partner program terms | **Podmínky partnerského programu** | Translate to Czech. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Podmínky programu zatím nejsou nastaveny. Kontaktujte prosím SuperAdmina.** | Translate to Czech. |
| `partner.loadError` | Failed to load partner data | **Nepodařilo se načíst partnerská data** | Translate to Czech. |
| `toneMenu.explainIn` | Vysvětlete tónem | **Vysvětlit tónem** | Infinitive form is more common for menu items. |
| `sip.editTrunk` | Změnit nastavení kufru | **Změnit nastavení SIP trunku** | 'Kufr' is ambiguous; 'SIP trunku' is more precise for SIP telephony. |
| `sip.loginLabel` | Uživatelské jméno (SIP přihlášení) | **Uživatelské jméno (SIP login)** | Preserve 'SIP login' as it's a technical term. |
| `sip.loginShort` | Přihlášení | **Login** | 'Login' is commonly used for username in technical contexts. |
| `sip.transport` | Doprava | **Transport** | 'Transport' is more common in technical contexts like SIP. |
| `sip.trunkId` | ID kufru | **ID SIP trunku** | Consistent use of 'SIP trunku'. |
| `sip.createTrunk` | Vytvořte kmen | **Vytvořit SIP trunk** | Infinitive form for action; 'SIP trunk' is more precise. |
| `sip.incoming.emptyHint` | Vytvořte si unikátní SIP URI + přihlašovací jméno/heslo, aby vám klienti mohli volat z jakéhokoli telefonu, a VibeVox bude váš hlas automaticky překládat v reálném čase. | **Vytvořit si unikátní SIP URI + přihlašovací jméno/heslo, aby vám klienti mohli volat z jakéhokoli telefonu, a VibeVox bude váš hlas automaticky překládat v reálném čase.** | Infinitive form is more suitable for a hint/suggestion. |
| `sip.incoming.create` | Vytvořte SIP adresu pro příchozí hovory | **Vytvořit SIP adresu pro příchozí hovory** | Infinitive form is more common for buttons/actions. |
| `sip.incoming.creating` | Tvoříme… | **Vytváříme…** | 'Tvoříme' is general; 'Vytváříme' is more common for 'creating' something new. |
| `sip.incoming.activeHint` | Překladač Bridge poslouchá situaci v místnosti. Každý hovor je překládán v reálném čase. | **Překladač Bridge poslouchá místnost. Každý hovor je překládán v reálném čase.** | More concise phrasing for 'listens to the room'. |
| `sip.incoming.pausedHint` | Aktivujte příjem, aby VibeVox začal přesměrovávat příchozí hovory. | **Aktivujte příjem, aby VibeVox začal překládat příchozí hovory.** | 'Přesměrovávat' means redirect; 'překládat' is correct for translate. |
| `sip.incoming.translationRoom` | Překladatelská místnost | **Místnost pro překlad** | Consistent phrasing for 'translation room'. |
| `sip.incoming.stop` | Zastávka | **Zastavit** | 'Zastávka' is a noun; 'Zastavit' is the correct verb for 'stop'. |
| `sip.incoming.show` | Show | **Zobrazit** | Translate to Czech. |
| `sip.incoming.copy` | Kopie | **Kopírovat** | Consistent use of 'Kopírovat' for 'copy'. |
| `sip.incoming.reissue` | Znovuvydání | **Znovu vydat** | 'Znovuvydání' is a noun; 'Znovu vydat' is the correct verb for 'reissue'. |
| `sip.toasts.saveFailed` | Uložení kufru se nezdařilo | **Uložení SIP trunku se nezdařilo** | Consistent use of 'SIP trunku'. |
| `sip.toasts.deleted` | Kmen byl smazán. | **SIP trunk byl smazán.** | Consistent use of 'SIP trunk'. |
| `sip.toasts.deleteFailed` | Nepodařilo se smazat kmen | **Nepodařilo se smazat SIP trunk** | Consistent use of 'SIP trunk'. |
| `sip.tenantOnly.hint2` | Přihlaste se jako běžný uživatel s vlastním tenantId a vytvořte trunk. | **Přihlaste se jako běžný uživatel s vlastním tenantId a vytvořte SIP trunk.** | Infinitive form for action; consistent use of 'SIP trunk'. |
| `sip.danger.deleteTrunk` | Smazat kmen | **Smazat SIP trunk** | Consistent use of 'SIP trunk'. |
| `sip.danger.deleteTrunkHint` | Konfigurace bude smazána. Odchozí hovory se zastaví, dokud znovu nevytvoříte linku. | **Konfigurace bude smazána. Odchozí hovory se zastaví, dokud znovu nevytvoříte SIP trunk.** | Consistent use of 'SIP trunk'. |
| `sip.danger.reissueHint` | Znovu zadejte přihlašovací jméno a heslo pro SIP adresu. Staré informace již nebudou fungovat. | **Znovu vydá přihlašovací jméno a heslo pro SIP adresu. Stará data již nebudou fungovat.** | 'Znovu zadejte' means re-enter; 'Znovu vydá' is correct for reissue. 'Data' is more precise. |
| `sip.outbound2.callButton` | Volání | **Volat** | 'Volání' is a noun; 'Volat' is the correct verb for 'call'. |
| `sip.confirm.deleteTrunkBody` | Tato akce je nevratná. Po smazání se odchozí hovory zastaví, dokud nebude vytvořena nová linka. | **Tato akce je nevratná. Po smazání se odchozí hovory zastaví, dokud nebude vytvořen nový SIP trunk.** | Consistent use of 'SIP trunk'. |
| `enterprise.tabs.prompts` | Tipy | **Výzvy** | 'Tipy' means tips; 'Výzvy' is more accurate for AI prompts. |
| `enterprise.tabs.questFlow` | Průběh úkolu | **Quest Flow** | Brand name 'Quest Flow' must be preserved, not translated. |
| `enterprise.common.recheck` | Zkontrolujte znovu | **Zkontrolovat znovu** | Infinitive form is more common for buttons/actions. |
| `enterprise.common.delete` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `enterprise.common.copy` | Kopie | **Kopírovat** | Consistent use of 'Kopírovat' for 'copy'. |
| `enterprise.common.show` | Show | **Zobrazit** | Translate to Czech. |
| `enterprise.apiKey.copy` | Kopie | **Kopírovat** | Consistent use of 'Kopírovat' for 'copy'. |
| `enterprise.apiKey.show` | Show | **Zobrazit** | Translate to Czech. |
| `enterprise.gemini.lead` | Osobní klíč z AI Studia. Nahrazuje globální klíč pro všechny hovory Gemini na vašem účtu. | **Osobní klíč z AI Studio. Nahrazuje globální klíč pro všechny hovory Gemini na vašem účtu.** | Preserve brand name 'AI Studio'. |
| `enterprise.gemini.aiStudioLink` | Studio umělé inteligence | **AI Studio** | Brand name 'AI Studio' must be preserved, not translated. |
| `enterprise.gemini.validateLabel` | Zkontrolujte znovu | **Zkontrolovat znovu** | Infinitive form is more common for buttons/actions. |
| `enterprise.gemini.deleteLabel` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `enterprise.gemini.confirmDeleteCta` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `enterprise.gemini.telegram.lead` | Vytvořte bota s @BotFather a vložte jeho token. Každý, kdo tomuto botovi napíše zprávu s /start, bude dostávat oznámení: noví klienti, tagy, chyby integrace. Můžete přihlásit k odběru více zaměstnanců nebo bota přidat do skupiny či kanálu – oznámení budou automaticky zasílána všem. | **Vytvořit bota s @BotFather a vložit jeho token. Každý, kdo tomuto botovi napíše zprávu s /start, bude dostávat oznámení: noví klienti, tagy, chyby integrace. Můžete přihlásit k odběru více zaměstnanců nebo bota přidat do skupiny či kanálu – oznámení budou automaticky zasílána všem.** | Infinitive form is more suitable for general instructions. |
| `enterprise.gemini.telegram.leadCreatePart1` | Vytvořte bota na adrese | **Vytvořit bota na adrese** | Infinitive form is more suitable for general instructions. |
| `enterprise.gemini.telegram.leadCreatePart2` | a vložte jeho token. | **a vložit jeho token.** | Infinitive form is more suitable for general instructions. |
| `enterprise.gemini.telegram.testingLabel` | Helma… | **Posíláme…** | 'Helma' means helmet; 'Posíláme' is correct for 'sending'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Rozvázat | **Odpojit** | 'Rozvázat' means untie; 'Odpojit' is better for unlink/disconnect. |
| `enterprise.prompt.heading` | Tipy | **Výzvy** | Consistent use of 'Výzvy' for AI prompts. |
| `enterprise.prompt.subtitle` | Rychlost a znalostní báze pro přepis pouze ve video místnostech | **Výzva a znalostní báze pouze pro přepis ve video místnostech** | 'Rychlost' means speed; 'Výzva' is correct for prompt. |
| `enterprise.prompt.warning` | Nesmí být zaměňována s Quest Flow | **Nesmí být zaměňováno s Quest Flow** | Grammar: 'zaměňováno' (neuter) to agree with 'to' (it). Preserve 'Quest Flow'. |
| `enterprise.prompt.promptLabel` | Systémové pokyny (tón, styl, slovní zásoba) | **Systémová výzva (tón, styl, slovní zásoba)** | 'Pokyny' means instructions; 'Výzva' is better for prompt. |
| `enterprise.prompt.showDefault` | Co umělá inteligence používá standardně? | **Co umělá inteligence používá ve výchozím nastavení?** | 'Standardně' means standardly; 've výchozím nastavení' is better for 'by default'. |
| `enterprise.prompt.appendNote` | Můžete si přidat vlastní pravidla – budou zkombinována s výchozími. | **Lze doplnit vlastními pravidly – budou zkombinována s výchozí výzvou.** | More natural phrasing for a general note; specify 'výzvou'. |
| `enterprise.prompt.headerLeadBold2` | „Dle vaší žádosti“ | **„Dle vaší výzvy“** | 'Žádosti' means request; 'výzvy' is more accurate for prompt. |
| `enterprise.prompt.contextHeading` | Kontext / podnět | **Kontext / výzva** | 'Podnět' means stimulus; 'výzva' is better for prompt. |
| `enterprise.prompt.contextLeadBold` | „Dle vaší žádosti“ | **„Dle vaší výzvy“** | Consistent use of 'výzvy' for prompt. |
| `enterprise.prompt.defaultSummary` | Co umělá inteligence používá ve výchozím nastavení (pokud je vaše pole prázdné) - kliknutím zobrazíte | **Co umělá inteligence používá ve výchozím nastavení (pokud je vaše pole prázdné) – kliknutím zobrazíte** | Consistent use of 've výchozím nastavení'; minor punctuation. |
| `enterprise.prompt.extendNoteText` | s vlastními pravidly/styl/terminologií - budou kombinovány s výše uvedeným výchozím výzvou a znalostní bází. | **s vlastními pravidly/stylem/terminologií – budou zkombinovány s výše uvedenou výchozí výzvou a znalostní bází.** | Grammar: correct case for 'stylem', gender agreement for 'výchozí výzvou'. |
| `enterprise.prompt.kbLead` | Nahrajte dokument – katalog, FAQ, ceník, předpisy nebo informační materiály. Obsah je analyzován na serveru (Word/Excel/CSV → text) a integrován umělou inteligencí při přepisu zpráv ve video místnostech. Limit: 50 MB soubor / 500 000 znaků v databázi. | **Nahrajte dokument – katalog, FAQ, ceník, předpisy nebo materiály pro výzvy. Obsah je analyzován na serveru (Word/Excel/CSV → text) a integrován umělou inteligencí při přepisu zpráv ve video místnostech. Limit: 50 MB soubor / 500 000 znaků v databázi.** | 'Materiály pro výzvy' is more precise for 'materials for prompts'. |
| `enterprise.prompt.kbCharsSuffix` | symboly | **znaků** | 'Symboly' is less common for text length; 'znaků' is better for characters. |
| `enterprise.prompt.kbUploading` | Načítání… | **Nahráváme…** | 'Načítání' means loading; 'Nahráváme' is correct for uploading. |
| `enterprise.prompt.successFileUploaded` | Soubor „{{filename}}“ ({{format}}) načten – uloženo {{kbLength}} znaků. | **Soubor „{{filename}}“ ({{format}}) nahrán – uloženo {{kbLength}} znaků.** | 'Načten' means loaded; 'nahrán' is correct for uploaded. Consistent 'znaků'. |
| `enterprise.prompt.confirmKbDeleteCta` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `enterprise.prompt.presetsLeadBold` | „Dle vaší žádosti“ | **„Dle vaší výzvy“** | Consistent use of 'výzvy' for prompt. |
| `enterprise.questFlow.heading` | Průběh úkolu | **Quest Flow** | Brand name 'Quest Flow' must be preserved, not translated. |
| `enterprise.questFlow.warning` | Pokud je pole prázdné, použije se obecný výzva VibeVox. | **Pokud je pole prázdné, použije se obecná výzva VibeVox.** | Grammar: gender agreement for 'obecná výzva'. |
| `enterprise.questFlow.promptLabel` | Systémový výzva k postupu úkolu | **Systémová výzva Quest Flow** | Grammar: gender agreement for 'Systémová výzva'. Preserve 'Quest Flow'. |
| `enterprise.questFlow.tagsLabel` | Potřebuje štítky | **Tagy potřeb** | 'Potřebuje štítky' means needs labels; 'Tagy potřeb' is more accurate. |
| `enterprise.questFlow.keysLead` | Každý klíč je tajný kód, který vložíte do HTTP bloku Quest Flow v řetězci. VibeVox ho používá k identifikaci vašeho účtu. Pro různé řetězce můžete vytvořit více klíčů. | **Každý klíč je tajný kód, který vložíte do HTTP bloku Quest Flow řetězce. VibeVox ho používá k identifikaci vašeho účtu. Pro různé řetězce lze vytvořit více klíčů.** | More natural phrasing for 'in the chain' and 'can be created'. |
| `enterprise.questFlow.creatingKey` | Tvoříme… | **Vytváříme…** | 'Tvoříme' is general; 'Vytváříme' is more common for 'creating' something new. |
| `enterprise.questFlow.errDelete` | Delete error | **Chyba smazání** | Translate to Czech. |
| `enterprise.questFlow.createdWarning` | ⚠ Uložte si klíč – zobrazí se pouze jednou | **⚠ Uložit si klíč – zobrazí se pouze jednou** | Infinitive form is more suitable for a warning/instruction. |
| `enterprise.questFlow.copyKey` | Kopie | **Kopírovat** | Consistent use of 'Kopírovat' for 'copy'. |
| `enterprise.questFlow.noKeysHint` | Zatím nejsou žádné klíče. Vytvořte první. | **Zatím nejsou žádné klíče. Vytvořit první.** | Infinitive form is more suitable for a suggestion. |
| `enterprise.questFlow.noLabel` | žádný štítek | **bez štítku** | 'Bez štítku' is more direct for 'without label'. |
| `enterprise.questFlow.usedOn` | použitý {{date}} | **použito {{date}}** | Grammar: 'použito' (neuter) for 'used'. |
| `enterprise.questFlow.neverUsed` | nepoužívá se | **nepoužito** | 'Nepoužívá se' is present tense; 'nepoužito' is better for 'never used'. |
| `enterprise.questFlow.deleteTitle` | Delete | **Smazat** | Translate to Czech. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Smazat klíč?** | Translate to Czech. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Klíč bude trvale smazán. Quest Flow přes něj přestane fungovat – bude nutné vytvořit nový klíč a nahradit ho v řetězci.** | Translate to Czech. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Smazat** | Translate to Czech. |
| `enterprise.questFlow.promptLead2` | — používá se obecná promptní funkce VibeVox (níže). | **— používá se obecná výzva VibeVox (níže).** | 'Promptní funkce' is clunky; 'obecná výzva' is better for general prompt. |
| `enterprise.questFlow.promptLeadBold2` | Pokud vyplníte svůj | **Pokud vyplníte svou** | Grammar: 'svou' (feminine) to agree with 'výzvu'. |
| `enterprise.questFlow.defaultSummary` | Co umělá inteligence používá ve výchozím nastavení (pokud je vaše pole prázdné) - kliknutím zobrazíte | **Co umělá inteligence používá ve výchozím nastavení (pokud je vaše pole prázdné) – kliknutím zobrazíte** | Consistent use of 've výchozím nastavení'; minor punctuation. |
| `enterprise.questFlow.successPromptSaved` | Výzva k průběhu úkolu uložena. | **Výzva Quest Flow uložena.** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.kbLead2` | — umělá inteligence nebude mít k dispozici fakta o společnosti; bude reagovat pouze na základě obecných znalostí. Tato základna | **— umělá inteligence nebude mít k dispozici fakta o společnosti; bude reagovat pouze na základě obecných znalostí. Tato báze** | 'Základna' means military base; 'báze' is correct for knowledge base. |
| `enterprise.questFlow.kbLeadBold2` | samostatný | **samostatná** | Grammar: 'samostatná' (feminine) to agree with 'báze'. |
| `enterprise.questFlow.kbLead3` | Z sekce „Tipy“ – pro přepis videa. Limit: soubor 50 MB / 500 000 znaků v databázi. | **Ze sekce „Výzvy“ – tam pro přepis videa. Limit: soubor 50 MB / 500 000 znaků v databázi.** | Consistent use of 'Výzvy' for prompts; consistent 'znaků'. |
| `enterprise.questFlow.kbCharsSuffix` | symboly | **znaků** | Consistent use of 'znaků' for characters. |
| `enterprise.questFlow.kbDeleteTitle` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `enterprise.questFlow.kbUploading` | Načítání… | **Nahráváme…** | Consistent use of 'Nahráváme' for uploading. |
| `enterprise.questFlow.successFileUploaded` | Soubor „{{filename}}“ načten ({{kbLength}} znaky). | **Soubor „{{filename}}“ nahrán ({{kbLength}} znaků).** | 'Načten' means loaded; 'nahrán' is correct for uploaded. 'Znaky' should be 'znaků' (genitive plural). |
| `enterprise.questFlow.confirmKbDeleteCta` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `enterprise.questFlow.tagsHeading` | Potřebuje štítky | **Tagy potřeb** | Consistent use of 'Tagy potřeb'. |
| `enterprise.questFlow.tagsLead` | Umělá inteligence přiřadí tyto tagy klientům, pokud v konverzaci zjistí shodu. Tagy se zobrazí na kartě pokoje klienta a přenesou se do CRM (kapitola 4). | **Umělá inteligence přiřadí tyto tagy klientům, pokud v konverzaci zjistí shodu. Tagy se zobrazí na kartě místnosti klienta a přenesou se do CRM (kapitola 4).** | Consistent use of 'místnosti'. |
| `enterprise.chatwoot.test` | Zkontrolujte připojení | **Zkontrolovat připojení** | Infinitive form is more common for buttons/actions. |
| `chat.openWithClient` | Otevřete chat s klientem | **Otevřít chat s klientem** | Infinitive form is more common for buttons/actions. |
| `chat.backToRooms` | ← Zpět na pokoje | **← Zpět na místnosti** | Consistent use of 'místnosti' for virtual rooms. |
| `chat.analyzeTooltip` | Spusťte analýzu dialogu | **Spustit analýzu dialogu** | Infinitive form is more suitable for a tooltip. |
| `insights.recalc` | Přepočítání | **Přepočítat** | 'Přepočítání' is a noun; 'Přepočítat' is the correct verb for 'recalculate'. |
| `insights.sentiment` | Klíč | **Tón** | 'Klíč' means key; 'Tón' is correct for sentiment/tonality. |
| `insights.leadScore` | Skóre náskoku | **Lead Score** | Preserve 'Lead Score' as a sales funnel term. |
| `lobby.tosAgree` | Registrací souhlasíte s | **Připojením souhlasíte s** | 'Registrací' means by registering; 'Připojením' is better for 'by joining'. |
| `lobby.roomFullMsg` | Schůzky se již účastní. Kontaktujte tvůrce schůzky nebo požádejte o nového účastníka. | **Schůzky se již účastní. Kontaktujte tvůrce schůzky nebo vytvořte novou.** | 'Požádejte o nového účastníka' is incorrect; 'vytvořte novou' is better. |
| `paywall.titleNoSub` | Chcete-li si vytvořit pokoj, zaregistrujte se k odběru plánu. | **Chcete-li vytvořit místnost, pořiďte si tarif.** | Consistent 'místnost'; shorter and more direct phrasing for 'get a plan'. |
| `paywall.titleLowBalance` | Na vašem zůstatku nezbývají žádné minuty – zaregistrujte se k tarifu nebo si kupte další. | **Na vašem zůstatku nezbývají žádné minuty – pořiďte si tarif nebo dokupte.** | Consistent 'zůstatek'; shorter and more direct phrasing for 'get a plan' and 'top up'. |
| `paywall.subtitle` | Vyberte si tarif nebo si kupte více minut – plaťte přes Stripe, okamžité vrácení peněz zde. | **Vyberte si tarif nebo si kupte více minut – plaťte přes Stripe, minuty se připíší okamžitě.** | More accurate phrasing for 'minutes are credited immediately'. |
| `paywall.buyStandard` | Standardní – 29 €/měsíc (120 min.) | **Standard – 29 €/měsíc (120 min.)** | Preserve 'Standard' as a tier name. |
| `paywall.subscribe` | Design | **Objednat** | 'Design' is incorrect; 'Objednat' is correct for subscribe/order. |
| `paywall.featureMinutes` | {{count}} min překlad | **{{count}} min překladu** | Grammar: genitive case for 'překladu'. |
| `paywall.topupTitle` | Kupte si další minuty | **Dokoupit minuty** | Infinitive form is more suitable for a title; 'dokoupit' is precise. |
| `paywall.topupCalcLoading` | Vypočítáme náklady… | **Vypočítáváme náklady…** | 'Vypočítáme' is future tense; 'Vypočítáváme' is present continuous. |
| `paywall.topupPlusLine` | Plus tarif (včetně min. {{count}}) | **Tarif Plus (včetně {{count}} minut)** | Grammar: 'minut' (genitive plural) is better than 'min.'. |
| `paywall.topupAddon` | Dodatečný nákup {{count}} min × 0,17 € | **Dokup {{count}} min × 0,17 €** | 'Dokup' is shorter and more direct for 'top-up'. |
| `paywall.total` | Celkový | **Celkem** | 'Celkový' is an adjective; 'Celkem' is correct for 'total'. |
| `paywall.close` | Blízko | **Zavřít** | Consistent use of 'Zavřít' for 'close'. |
| `confirmModal.delete` | Vymazat | **Smazat** | Consistent use of 'Smazat' for deleting. |
| `postCallInsights.analyzing` | Pojďme si analyzovat konverzaci... | **Analyzujeme konverzaci…** | More direct phrasing for 'analyzing conversation'. |
| `postCallInsights.close` | Zavřít a vrátit se do pokojů | **Zavřít a vrátit se do místností** | Consistent use of 'místností' for virtual rooms. |
| `billingPage.balanceMinutes` | zápis | **minut** | 'Zápis' means record; 'minut' is correct for time units. |
| `billingPage.tierLabel` | Hodnotit | **Tarif** | 'Hodnotit' is a verb; 'Tarif' is correct for a plan/tier. |
| `billingPage.resume` | Resumé | **Obnovit** | 'Resumé' means summary; 'Obnovit' is correct for resume/renew. |
| `billingPage.topupHelp` | Další posuvník pro nákup. K dispozici s aktivním předplatným. | **Posuvník pro dokup. K dispozici s aktivním předplatným.** | 'Posuvník pro dokup' is more precise for 'top-up slider'. |
| `billingPage.topupCarried` | Odloženo | **Převedeno** | 'Odloženo' means postponed; 'Převedeno' is correct for transferred. |
| `billingPage.minutesShort` | zápis | **minut** | Consistent use of 'minut' for time units. |
| `billingPage.tierStandardName` | Norma | **Standard** | Preserve 'Standard' as a tier name. |
| `billingPage.featureLearnHub` | Centrum pro výuku umělé inteligence – jeho vlastní dialekty | **AI Learning Hub – vlastní dialekty** | Preserve 'AI Learning Hub'; more concise for 'own dialects'. |
| `billingPage.featureAllStandard` | Vše od Standardu | **Vše ze Standardu** | Consistent use of 'Standard' as a tier name. |
| `billingPage.ctaSubscribePlus` | Získejte Plus | **Objednat Plus** | Infinitive form is more common for buttons; 'Objednat' is better for subscribe. |
| `billingPage.ctaSubscribeStandard` | Standardní objednávka | **Objednat Standard** | Preserve 'Standard' as tier name; 'Objednat' for subscribe. |
| `billingPage.ctaContact` | Kontakt | **Kontaktovat** | 'Kontakt' is a noun; 'Kontaktovat' is the correct verb for 'contact'. |
| `billingPage.languagesCount_few` | Jazyk {{count}} | **{{count}} jazyky** | Grammar: 'jazyky' (plural) for counts > 1. |
| `billingPage.languagesCount_many` | {{count}} jazyky | **{{count}} jazyků** | Grammar: 'jazyků' (genitive plural) for counts > 4. |
| `billingPage.languagesCount_other` | {{count}} jazyky | **{{count}} jazyků** | Grammar: 'jazyků' (genitive plural) for counts > 4. |
| `billingPage.renewsOn` | přípona {{date}} | **prodloužení {{date}}** | 'Přípona' means suffix; 'prodloužení' is correct for renewal. |
| `auth.login.registerLink` | Rejstřík | **Registrovat se** | 'Rejstřík' is a noun; 'Registrovat se' is the correct verb for 'register'. |
| `auth.register.submit` | Rejstřík | **Registrovat se** | Consistent use of 'Registrovat se' for 'register'. |
| `auth.register.namePlaceholder` | tvé jméno | **Vaše jméno** | Use formal 'Vaše jméno' for a placeholder. |
| `pwaInstall.buttonLabel` | Nainstalujte si aplikaci | **Nainstalovat aplikaci** | Infinitive form is more common for buttons. |
| `pwaInstall.buttonSubtitle` | Přejděte na domovskou obrazovku – spuštění jedním klepnutím | **Na domovskou obrazovku – spuštění jedním klepnutím** | More concise phrasing for a subtitle. |
| `pwaInstall.buttonAria` | Nainstalujte si VibeVox jako aplikaci | **Nainstalovat VibeVox jako aplikaci** | Infinitive form is more common for actions. |
