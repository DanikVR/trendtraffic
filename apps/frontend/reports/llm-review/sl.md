# LLM Review: Slovenian (sl)

**Model:** gemini-2.5-flash  
**Took:** 203.4s  
**Fixes proposed:** 123 (valid after placeholder-check: 110)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | Potek naloge | **Quest Flow** | Brand/product name 'Quest Flow' must be preserved. |
| `rooms.actions.open` | Prijava | **Vstopi** | Wrong word sense: 'Prijava' means 'Login', but context implies 'Enter'. |
| `common.open` | Odprto | **Odpri** | Grammar: 'Odprto' is an adjective, should be imperative verb 'Odpri'. |
| `common.edit` | Sprememba | **Uredi** | Grammar: 'Sprememba' is a noun, should be imperative verb 'Uredi'. |
| `common.success` | Pripravljen | **Uspešno** | Wrong word sense/gender: 'Pripravljen' (ready, masc.) is not suitable for general success. |
| `balance.label` | Ravnovesje | **Stanje** | Wrong word sense: 'Ravnovesje' is for equilibrium, 'Stanje' for financial balance. |
| `balance.minutes_few` | {{count}} minut | **{{count}} minute** | Grammar: For 2-4 items, 'minute' (plural) is correct, not 'minut' (genitive plural). |
| `balance.openPlans` | Odprte tarife in stanje | **Odpri tarife in stanje** | Grammar: 'Odprte' is an adjective, should be imperative verb 'Odpri'. |
| `tier.trial` | Sojenje | **Preizkusno** | Wrong word sense: 'Sojenje' means 'court trial', should be 'Preizkusno' (trial period). |
| `tier.standard` | Standardno | **Standard** | Grammar: 'Standardno' is an adjective, tier name should be 'Standard'. |
| `tier.standardYearly` | Letno | **Yearly** | Brand/product name 'Yearly' must be preserved. |
| `moreSheet.sip.sub` | Postavitev debla | **Nastavitev linij** | Wrong word sense: 'debla' (tree trunk) is incorrect for SIP trunks. |
| `call.geminiLive` | Dvojčki v živo | **Gemini Live** | Brand/product name 'Gemini' must be preserved. |
| `call.toPlayground` | 🎯 Na odlagališče odpadkov | **🎯 Na vadbišče** | Wrong word sense: 'odlagališče odpadkov' (landfill) is incorrect for 'playground' (training ground). |
| `call.playgroundTip` | Pošljite frazo na vadbeni poligon za umetno inteligenco | **Pošljite frazo na vadbišče za umetno inteligenco** | Shorter and more direct translation for 'training ground'. |
| `call.screenshareOff` | Ustavitev deljenja zaslona | **Ustavi deljenje zaslona** | Grammar: 'Ustavitev' is a noun, should be imperative verb 'Ustavi'. |
| `call.more` | Poleg tega | **Več** | Wrong word sense: 'Poleg tega' (in addition) is incorrect for 'More' (additional options). |
| `call.validating` | Testiranje varne povezave VibeVox ... | **Preverjanje varne povezave VibeVox ...** | Wrong word sense: 'Testiranje' (testing) is less accurate than 'Preverjanje' (verification). |
| `sip.incoming.paused` | SIP naslov ustvarjen, sprejem prekinjen | **SIP naslov ustvarjen, sprejem začasno ustavljen** | Wrong word sense: 'prekinjen' (interrupted) is less accurate than 'začasno ustavljen' (paused). |
| `sip.incoming.pausedHint` | Aktivirajte sprejem, da VibeVox začne preusmerjati dohodne klice. | **Aktivirajte sprejem, da VibeVox začne prevajati dohodne klice.** | Wrong word sense: 'preusmerjati' (redirecting) is incorrect, should be 'prevajati' (translate). |
| `sip.incoming.stop` | Ustavi se | **Ustavi** | Grammar: 'Ustavi se' is reflexive, should be imperative 'Ustavi'. |
| `sip.incoming.reissue` | Ponovna izdaja | **Ponovno izda** | Grammar: 'Ponovna izdaja' is a noun, should be imperative verb 'Ponovno izda'. |
| `sip.incoming.toggleFailed` | Sprejem ni bil preklopljen | **Ni uspelo preklopiti sprejema** | Grammar: Better phrasing for 'Failed to toggle reception'. |
| `sip.outbound.lead` | Pokličite telefonsko številko iz spletnega vmesnika in VibeVox bo samodejno prenesel vaš pogovor v realnem času. | **Pokličite telefonsko številko iz spletnega vmesnika in VibeVox bo samodejno prevedel vaš pogovor v realnem času.** | Wrong word sense: 'prenesel' (transferred) is incorrect, should be 'prevedel' (translated). |
| `sip.outbound.noTrunkTitle` | Najprej nastavite odhodni SIP trunk | **Najprej nastavite odhodno SIP linijo** | Wrong word sense: 'trunk' is English, 'linijo' (line) is appropriate for SIP. |
| `sip.outbound.noTrunkHint` | Izpolnite obrazec »Nov SIP kanal« na vrhu strani – VibeVox bo za odhodne klice uporabil vašega ponudnika SIP (Zadarma, OnlinePBX itd.). | **Izpolnite obrazec »Nova SIP linija« na vrhu strani – VibeVox bo za odhodne klice uporabil vašega ponudnika SIP (Zadarma, OnlinePBX itd.).** | Wrong word sense: 'kanal' (channel) is incorrect for SIP trunk, 'linija' is better. |
| `sip.outbound.configureFirst` | Najprej nastavite odhodni SIP trunk (zgornji obrazec) | **Najprej nastavite odhodno SIP linijo (zgornji obrazec)** | Wrong word sense: 'trunk' is English, 'linijo' (line) is appropriate for SIP. |
| `sip.howTo.step1` | Pridobite poverilnice za SIP trunk od svojega ponudnika (Zadarma, OnlinePBX, Asterisk). | **Pridobite poverilnice za SIP linijo od svojega ponudnika (Zadarma, OnlinePBX, Asterisk).** | Wrong word sense: 'trunk' is English, 'linijo' (line) is appropriate for SIP. |
| `sip.howTo.step3` | VibeVox bo v LiveKit Cloudu samodejno ustvaril odhodni SIP trunk. | **VibeVox bo v LiveKit Cloudu samodejno ustvaril odhodno SIP linijo.** | Wrong word sense: 'trunk' is English, 'linijo' (line) is appropriate for SIP. |
| `sip.toasts.saveFailed` | Shranjevanje prtljažnika ni uspelo | **Shranjevanje linije ni uspelo** | Wrong word sense: 'prtljažnika' (car trunk) is incorrect for SIP trunk. |
| `sip.toasts.deleted` | Prtljažnik je bil izbrisan. | **Linija je bila izbrisana.** | Wrong word sense: 'Prtljažnik' (car trunk) is incorrect for SIP trunk. |
| `sip.toasts.deleteFailed` | Brisanje prtljažnika ni uspelo | **Brisanje linije ni uspelo** | Wrong word sense: 'prtljažnika' (car trunk) is incorrect for SIP trunk. |
| `sip.tenantOnly.title` | SIP-trunki so konfigurirani na ravni najemnika | **SIP linije so konfigurirane na ravni najemnika** | Wrong word sense: 'trunki' is English, 'linije' (lines) is appropriate for SIP. |
| `sip.tenantOnly.hint2` | Prijavite se kot navaden uporabnik, ki ima svoj tenantId, da ustvarite prtljažnik. | **Prijavite se kot navaden uporabnik, ki ima svoj tenantId, da ustvarite linijo.** | Wrong word sense: 'prtljažnik' (car trunk) is incorrect for SIP trunk. |
| `sip.connected` | SIP-trunk je shranjen in sinhroniziran z LiveKitom | **SIP linija je shranjena in sinhronizirana z LiveKitom** | Wrong word sense: 'trunk' is English, 'linija' (line) is appropriate for SIP. |
| `sip.sections.providerData` | Podrobnosti o vašem ponudniku SIP | **Podatki za vašega ponudnika SIP** | More literal translation: 'Podatki' (data) instead of 'Podrobnosti' (details). |
| `sip.danger.deleteTrunk` | Izbriši prtljažnik | **Izbriši linijo** | Wrong word sense: 'prtljažnik' (car trunk) is incorrect for SIP trunk. |
| `sip.danger.deleteTrunkHint` | Konfiguracija bo izbrisana. Odhodni klici se bodo ustavili, dokler ne boste ponovno ustvarili zunanjega omrežja. | **Konfiguracija bo izbrisana. Odhodni klici se bodo ustavili, dokler ne boste ponovno ustvarili linije.** | Wrong word sense: 'zunanjega omrežja' (external network) is incorrect for SIP trunk. |
| `sip.danger.deleteInboundHint` | Pravilo dohodnega operaterja in odpreme LiveKit bo odstranjeno. Dohodni klici ne bodo več sprejeti. | **Pravilo dohodne linije in odpreme LiveKit bo odstranjeno. Dohodni klici ne bodo več sprejeti.** | Wrong word sense: 'operaterja' (operator) is incorrect for 'inbound trunk'. |
| `sip.danger.reissueHint` | Ponovno izdajte prijavo in geslo za SIP naslov. Stari podatki ne bodo več delovali. | **Ponovno bo izdal prijavo in geslo za SIP naslov. Stari podatki ne bodo več delovali.** | Grammar: 'Ponovno izdajte' is imperative, should be future tense 'Ponovno bo izdal'. |
| `sip.confirm.deleteTrunkTitle` | Želite izbrisati SIP trunk? | **Želite izbrisati SIP linijo?** | Wrong word sense: 'trunk' is English, 'linijo' (line) is appropriate for SIP. |
| `sip.confirm.deleteTrunkBody` | To dejanje je nepreklicno. Ko je izbrisan, se bodo odhodni klici ustavili, dokler ne bo ustvarjen nov operater. | **To dejanje je nepreklicno. Ko je izbrisan, se bodo odhodni klici ustavili, dokler ne bo ustvarjena nova linija.** | Wrong word sense: 'operater' (operator) is incorrect for SIP trunk. |
| `sip.confirm.deleteInboundBody` | To dejanje je nepreklicno. Pravilo za dohodni trunk in odpremo v storitvi LiveKit Cloud bo izbrisano. | **To dejanje je nepreklicno. Pravilo za dohodno linijo in odpremo v storitvi LiveKit Cloud bo izbrisano.** | Wrong word sense: 'trunk' is English, 'linijo' (line) is appropriate for SIP. |
| `enterprise.tabs.prompts` | Nasveti | **Pozivi** | Wrong word sense: 'Nasveti' (tips) is incorrect for AI 'Prompts'. |
| `enterprise.tabs.questFlow` | Potek naloge | **Quest Flow** | Brand/product name 'Quest Flow' must be preserved. |
| `enterprise.common.saving` | Shranjevanje … | **Shranjujem…** | Grammar: 'Shranjevanje' is a noun, should be verb 'Shranjujem...' (I am saving). |
| `enterprise.gemini.lead` | Osebni ključ iz AI Studia. Ta nadomešča globalni ključ za vse klice Gemini v vašem računu. | **Osebni ključ iz AI Studio. Ta nadomešča globalni ključ za vse klice Gemini v vašem računu.** | Brand/product name 'AI Studio' must be preserved. |
| `enterprise.gemini.aiStudioLink` | Studio za umetno inteligenco | **AI Studio** | Brand/product name 'AI Studio' must be preserved. |
| `enterprise.gemini.successSavedWithIssue` | Shranjeno, vendar potrditev: {{error}} | **Shranjeno, vendar validacija: {{error}}** | Wrong word sense: 'potrditev' (confirmation) is less accurate than 'validacija' (validation). |
| `enterprise.gemini.telegram.leadStartCmd` | /začetek | **/start** | Command '/start' must be preserved. |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ Bot @{{username}} shranjen. Pozdrav dostavljen naročnikom {{sent}}. | **✓ Bot @{{username}} shranjen. Pozdrav dostavljen podpisnikom {{sent}}.** | More specific word: 'podpisnikom' (subscribers) instead of 'naročnikom' (subscribers/customers). |
| `enterprise.gemini.telegram.savingLabel` | Shranjevanje … | **Shranjujem…** | Grammar: 'Shranjevanje' is a noun, should be verb 'Shranjujem...' (I am saving). |
| `enterprise.gemini.telegram.testingLabel` | Čelada… | **Pošiljamo…** | Wrong word sense: 'Čelada' (helmet) is incorrect, should be 'Pošiljamo...' (sending). |
| `enterprise.gemini.telegram.lastBroadcast` | Zadnja pošta: dostavljeno {{sent}} iz {{total}} | **Zadnje obvestilo: dostavljeno {{sent}} iz {{total}}** | Wrong word sense: 'pošta' (mail) is incorrect, should be 'obvestilo' (notification/broadcast). |
| `enterprise.prompt.heading` | Nasveti | **Pozivi** | Wrong word sense: 'Nasveti' (tips) is incorrect for AI 'Prompts'. |
| `enterprise.prompt.subtitle` | Hitrost in baza znanja za prepisovanje samo v video sobah | **Poziv in baza znanja za prepisovanje samo v video sobah** | Wrong word sense: 'Hitrost' (speed) is incorrect, should be 'Poziv' (prompt). |
| `enterprise.prompt.headerLeadBold2` | "Glede na vašo zahtevo" | **"Glede na vaš poziv"** | Wrong word sense: 'zahtevo' (request) is incorrect, should be 'poziv' (prompt). |
| `enterprise.prompt.contextHeading` | Kontekst / spodbuda | **Kontekst / poziv** | Wrong word sense: 'spodbuda' (incentive) is incorrect, should be 'poziv' (prompt). |
| `enterprise.prompt.contextLeadBold` | "Glede na vašo zahtevo" | **"Glede na vaš poziv"** | Wrong word sense: 'zahtevo' (request) is incorrect, should be 'poziv' (prompt). |
| `enterprise.prompt.promptPlaceholder` | Vaše obvestilo ... | **Vaš poziv ...** | Wrong word sense: 'obvestilo' (notification) is incorrect, should be 'poziv' (prompt). |
| `enterprise.prompt.savingPromptLabel` | Shranjevanje … | **Shranjujem…** | Grammar: 'Shranjevanje' is a noun, should be verb 'Shranjujem...' (I am saving). |
| `enterprise.prompt.kbCharsSuffix` | simboli | **simbolov** | Grammar: 'simboli' (nominative plural) is incorrect, should be 'simbolov' (genitive plural). |
| `enterprise.prompt.kbUploading` | Nalaganje … | **Nalagam…** | Grammar: 'Nalaganje' is a noun, should be verb 'Nalagam...' (I am uploading). |
| `enterprise.prompt.presetsLeadBold` | "Glede na vašo zahtevo" | **"Glede na vaš poziv"** | Wrong word sense: 'zahtevo' (request) is incorrect, should be 'poziv' (prompt). |
| `enterprise.questFlow.heading` | Potek naloge | **Quest Flow** | Brand/product name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.apiKeyLabel` | Vhodni ključ API-ja (nosilec) | **Inbound API Key (Bearer)** | Technical term 'Bearer' must be preserved. |
| `enterprise.questFlow.errDelete` | Delete error | **Napaka pri brisanju** | English text, should be translated to Slovenian. |
| `enterprise.questFlow.usedOn` | uporabljeno {{date}} | **uporabljen {{date}}** | Grammar: 'uporabljeno' (neuter) is incorrect, should be 'uporabljen' (masculine) for 'ključ' (key). |
| `enterprise.questFlow.neverUsed` | ni uporabljeno | **ni bil uporabljen** | Grammar: 'ni uporabljeno' (neuter) is incorrect, should be 'ni bil uporabljen' (masculine) for 'ključ' (key). |
| `enterprise.questFlow.deleteTitle` | Delete | **Izbriši** | English text, should be translated to Slovenian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Izbrisati ključ?** | English text, should be translated to Slovenian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Ključ bo trajno izbrisan. Quest Flow ne bo več deloval prek njega – morali boste ustvariti nov ključ in ga zamenjati v verigi.** | English text, should be translated to Slovenian. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Izbriši** | English text, should be translated to Slovenian. |
| `enterprise.questFlow.promptPlaceholder` | Vaše obvestilo ... | **Vaš poziv ...** | Wrong word sense: 'obvestilo' (notification) is incorrect, should be 'poziv' (prompt). |
| `enterprise.questFlow.savingPromptLabel` | Shranjevanje … | **Shranjujem…** | Grammar: 'Shranjevanje' is a noun, should be verb 'Shranjujem...' (I am saving). |
| `enterprise.questFlow.successPromptSaved` | Poziv poteka naloge shranjen. | **Poziv Quest Flow shranjen.** | Brand/product name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.kbLead2` | — umetna inteligenca ne bo imela podatkov o podjetju; odzvala se bo le na podlagi splošnega znanja. Ta osnova | **— umetna inteligenca ne bo imela podatkov o podjetju; odzvala se bo le na podlagi splošnega znanja. Ta baza** | More common word: 'baza' (loanword for database) is more common than 'osnova' (basis/foundation). |
| `enterprise.questFlow.kbLeadBold2` | ločeno | **ločena** | Grammar: 'ločeno' (neuter) is incorrect, should be 'ločena' (feminine) for 'baza' (base). |
| `enterprise.questFlow.kbLead3` | Iz razdelka »Namigi« – za prepis videa. Omejitev: datoteka 50 MB / 500.000 znakov v zbirki podatkov. | **Iz razdelka »Pozivi« – za prepis videa. Omejitev: datoteka 50 MB / 500.000 znakov v zbirki podatkov.** | Wrong word sense: 'Namigi' (tips) is incorrect for AI 'Prompts'. |
| `enterprise.questFlow.kbCharsSuffix` | simboli | **simbolov** | Grammar: 'simboli' (nominative plural) is incorrect, should be 'simbolov' (genitive plural). |
| `enterprise.questFlow.kbUploading` | Nalaganje … | **Nalagam…** | Grammar: 'Nalaganje' is a noun, should be verb 'Nalagam...' (I am uploading). |
| `enterprise.chatwoot.statusActive` | Aktivno | **Aktivna** | Grammar: 'Aktivno' (neuter) is incorrect, should be 'Aktivna' (feminine) for 'integracija' (integration). |
| `enterprise.chatwoot.statusDisabled` | Izklopljeno | **Izklopljena** | Grammar: 'Izklopljeno' (neuter) is incorrect, should be 'Izklopljena' (feminine) for 'integracija' (integration). |
| `enterprise.chatwoot.savingLabel` | Shranjevanje … | **Shranjujem…** | Grammar: 'Shranjevanje' is a noun, should be verb 'Shranjujem...' (I am saving). |
| `chat.deletingShort` | Brisanje … | **Brišem…** | Grammar: 'Brisanje' is a noun, should be verb 'Brišem...' (I am deleting). |
| `insights.recalc` | Ponovno štetje | **Ponovno izračunaj** | Wrong word sense: 'Ponovno štetje' (recount) is incorrect, should be 'Ponovno izračunaj' (recalculate). |
| `insights.summary` | Življenjepis | **Povzetek** | Wrong word sense: 'Življenjepis' (CV/resume) is incorrect, should be 'Povzetek' (summary). |
| `insights.sentiment` | Ključ | **Razpoloženje** | Wrong word sense: 'Ključ' (key) is incorrect, should be 'Razpoloženje' (sentiment/mood). |
| `insights.engagement` | Zaroka | **Vključenost** | Wrong word sense: 'Zaroka' (marriage engagement) is incorrect, should be 'Vključenost' (involvement/engagement). |
| `insights.analyzedReplies_few` | Analiziranih {{count}} replik | **Analizirane so bile {{count}} replike** | Grammar: For 2-4 items, 'replike' (plural) is correct, not 'replik' (genitive plural). |
| `insights.leadValues.hot` | Vroče | **Vroč** | Grammar: 'Vroče' (neuter) is incorrect, should be 'Vroč' (masculine) for 'lead'. |
| `insights.leadValues.warm` | Toplo | **Topel** | Grammar: 'Toplo' (neuter) is incorrect, should be 'Topel' (masculine) for 'lead'. |
| `insights.leadValues.cold` | Hladno | **Hladen** | Grammar: 'Hladno' (neuter) is incorrect, should be 'Hladen' (masculine) for 'lead'. |
| `lobby.andWord` | In | ** in ** | Formatting: ' in ' with spaces for better readability in a sentence. |
| `paywall.buyStandard` | Standardno – 29 €/mesec (120 min) | **Standard – 29 €/mesec (120 min)** | Grammar: 'Standardno' is an adjective, tier name should be 'Standard'. |
| `paywall.subscribe` | Oblikovanje | **Naroči se** | Wrong word sense: 'Oblikovanje' (design) is incorrect, should be 'Naroči se' (subscribe). |
| `paywall.featureMinutes` | {{count}} min prevod | **{{count}} min prevajanja** | Grammar: 'prevod' (translation, singular) is incorrect, should be 'prevajanja' (of translation, genitive). |
| `billingPage.tierLabel` | Stopnja | **Tarifa** | Wrong word sense: 'Stopnja' (level/degree) is incorrect for pricing 'Tarifa' (plan). |
| `billingPage.resumeAutoRenewQuestion` | Naj nadaljujem samodejno podaljševanje naročnine? | **Želite nadaljevati samodejno podaljševanje naročnine?** | Grammar: 'Naj nadaljujem' (Should I continue?) is less appropriate than 'Želite nadaljevati' (Do you want to continue?). |
| `billingPage.resume` | Življenjepis | **Nadaljuj** | Wrong word sense: 'Življenjepis' (CV/resume) is incorrect, should be 'Nadaljuj' (resume/continue). |
| `billingPage.featureLearnHub` | Središče za učenje umetne inteligence – lastna narečja | **AI Learning Hub – lastna narečja** | Brand/product name 'AI Learning Hub' must be preserved. |
| `billingPage.ctaSubscribeStandard` | Standard naročila | **Naroči Standard** | Grammar: 'Standard naročila' (Standard of order) is incorrect, should be 'Naroči Standard' (Order Standard). |
| `billingPage.languagesCount_few` | {{count}} jezik | **{{count}} jezika** | Grammar: For 2 items, 'jezika' (dual) is correct, not 'jezik' (singular). |
| `billingPage.languagesCount_many` | {{count}} jeziki | **{{count}} jezikov** | Grammar: For 5+ items, 'jezikov' (genitive plural) is correct, not 'jeziki' (nominative plural). |
| `billingPage.languagesCount_other` | {{count}} jeziki | **{{count}} jezikov** | Grammar: For 5+ items, 'jezikov' (genitive plural) is correct, not 'jeziki' (nominative plural). |
| `billingPage.searchResultsCount_few` | Najdeno: {{count}} jezikov | **Najdeni so {{count}} jeziki** | Grammar: For 2-4 items, 'jeziki' (plural) is correct, not 'jezikov' (genitive plural). |
| `billingPage.searchResultsCount_many` | Najdeno: {{count}} jezikov | **Najdenih: {{count}} jezikov** | Grammar: 'Najdeno' (neuter) is incorrect, should be 'Najdenih' (genitive plural) for 'jezikov'. |
| `billingPage.searchResultsCount_other` | Najdeno: {{count}} jezikov | **Najdenih: {{count}} jezikov** | Grammar: 'Najdeno' (neuter) is incorrect, should be 'Najdenih' (genitive plural) for 'jezikov'. |
| `billingPage.renewsOn` | razširitev {{date}} | **podaljšanje {{date}}** | Wrong word sense: 'razširitev' (expansion) is incorrect, should be 'podaljšanje' (renewal). |
| `auth.register.agreementAnd` | In | ** in ** | Formatting: ' in ' with spaces for better readability in a sentence. |

⚠ 13 fix(es) skipped (no-op, missing path, or would break placeholders).
