# LLM Review: Hungarian (hu)

**Model:** gemini-2.5-flash  
**Took:** 313.9s  
**Fixes proposed:** 131 (valid after placeholder-check: 131)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Vállalati beállítások | **Enterprise beállítások** | Enterprise is a brand/tier name, should be preserved. |
| `nav.billing` | Vámtarifák | **Tarifák** | Vámtarifák means customs tariffs; Tarifák is correct for pricing plans. |
| `nav.home` | Otthon | **Főoldal** | Otthon is a noun; Főoldal is more appropriate for 'Home' in navigation. |
| `rooms.create` | Teremt | **Létrehozás** | Teremt is not the natural word for 'create' on a button. Létrehozás is better. |
| `rooms.tabs.questFlow` | Küldetésfolyamat | **Quest Flow** | Quest Flow is a brand name, should not be translated. |
| `rooms.actions.open` | Bejelentkezés | **Belépés** | Bejelentkezés means 'Log in'; Belépés is more appropriate for 'Enter' a room. |
| `common.save` | Megtakarítás | **Mentés** | Megtakarítás means 'saving money'; Mentés is correct for 'save' data. |
| `common.close` | Közeli | **Bezárás** | Közeli is an adjective; Bezárás is correct for 'close' (button). |
| `common.loading` | Terhelés... | **Betöltés...** | Terhelés means 'burden'; Betöltés is correct for 'loading' data. |
| `common.open` | Nyitott | **Megnyitás** | Nyitott is an adjective; Megnyitás is correct for 'open' (button). |
| `common.edit` | Változás | **Szerkesztés** | Változás is a noun; Szerkesztés is correct for 'edit' (button). |
| `balance.openPlans` | Nyitott tarifák és egyensúly | **Tarifák és egyenleg megnyitása** | Nyitott is an adjective; Megnyitása is correct. Tarifák is better than vámtarifák. |
| `balance.tariffs` | Vámtarifák | **Tarifák** | Vámtarifák means customs tariffs; Tarifák is correct for pricing plans. |
| `tier.standardYearly` | Évi | **Yearly** | Yearly is a brand/tier name, should be preserved. |
| `tier.enterprise` | Vállalkozás | **Enterprise** | Enterprise is a brand/tier name, should be preserved. |
| `moreSheet.sip.sub` | Csomagtartók beállítása | **Fővonalak beállítása** | Csomagtartók is wrong word sense; Fővonalak is correct for SIP trunks. |
| `moreSheet.enterprise.label` | Vállalati beállítások | **Enterprise beállítások** | Enterprise is a brand/tier name, should be preserved. |
| `call.toPlayground` | 🎯 A hulladéklerakóba | **🎯 Az edzőtérre** | Hulladéklerakó is wrong word sense; edzőtér is correct for 'playground'. |
| `call.expandPeer` | Bővítse a beszélgetőpartnert | **Beszélgetőpartner kibontása** | Bővítse is imperative; Kibontása is better for 'expand' (noun form for button). |
| `call.more` | Továbbá | **Továbbiak** | Továbbá is an adverb; Továbbiak is correct for 'More' (options). |
| `call.validating` | VibeVox biztonságos kapcsolat tesztelése… | **VibeVox biztonságos kapcsolat ellenőrzése…** | Tesztelése means 'testing'; Ellenőrzése is more accurate for 'validation/checking'. |
| `coach.help` | Súgóválasz | **Segítség** | Súgóválasz is awkward; Segítség is a short, common button label for 'Help'. |
| `coach.thinking` | A mesterséges intelligencia úgy gondolja... | **A mesterséges intelligencia gondolkodik...** | Úgy gondolja is wrong word sense; gondolkodik is correct for 'thinking'. |
| `coach.copy` | Másolat | **Másolás** | Másolat is a noun; Másolás is correct for 'copy' (button). |
| `coach.pin` | Rögzítse | **Rögzítés** | Rögzítse is imperative; Rögzítés is correct for 'pin' (button). |
| `coach.close` | Közeli | **Bezárás** | Közeli is an adjective; Bezárás is correct for 'close' (button). |
| `roomActions.translation.disableSub` | A jegyzőkönyveket többé nem írják le | **A perceket többé nem írják le** | Jegyzőkönyv is wrong word sense; perc is correct for 'minutes' (time). |
| `settings.themeLightSub` | Felhősarki (fényes) | **Cloud Aurora (Világos)** | Cloud Aurora is a brand name, should be preserved. Fényes is also 'bright', világos is 'light'. |
| `partner.subtitle` | Share your link and earn | **Oszd meg a linkedet és keress pénzt** | English translation, should be Hungarian. |
| `partner.yourLink` | Your link | **A linked** | English translation, should be Hungarian. |
| `partner.copy` | Copy | **Másolás** | English translation, should be Hungarian. |
| `partner.copied` | ✓ Link copied | **✓ Link másolva** | English translation, should be Hungarian. |
| `partner.stats.clicks` | Clicks | **Kattintások** | English translation, should be Hungarian. |
| `partner.stats.registrations` | Sign-ups | **Regisztrációk** | English translation, should be Hungarian. |
| `partner.stats.paid` | Payments | **Fizetések** | English translation, should be Hungarian. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} felhasználó · {{minutes}} perc** | English translation, should be Hungarian. |
| `partner.terms` | Program terms | **Program feltételei** | English translation, should be Hungarian. |
| `partner.contact` | Contact us | **Kapcsolatfelvétel** | English translation, should be Hungarian. |
| `partner.termsModalTitle` | Partner program terms | **Partnerprogram feltételei** | English translation, should be Hungarian. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **A program feltételei még nincsenek beállítva. Kérjük, lépjen kapcsolatba a SuperAdminnal.** | English translation, should be Hungarian. |
| `partner.loadError` | Failed to load partner data | **Nem sikerült betölteni a partneradatokat** | English translation, should be Hungarian. |
| `sip.editTrunk` | Csomagtartó beállításainak módosítása | **Fővonal beállításainak módosítása** | Csomagtartó is wrong word sense; Fővonal is correct for SIP trunk. |
| `sip.trunkId` | Törzsazonosító | **Fővonal azonosító** | Törzsazonosító is literal; Fővonal azonosító is more appropriate for SIP trunk ID. |
| `sip.savingShort` | Megtakarítás… | **Mentés…** | Megtakarítás means 'saving money'; Mentés is correct for 'saving' data. |
| `sip.createTrunk` | Hozz létre egy törzset | **Fővonal létrehozása** | Törzset is literal; Fővonal létrehozása is better for 'create trunk' button. |
| `sip.incoming.creating` | Alkotjuk… | **Létrehozzuk…** | Alkotjuk is wrong word sense; Létrehozzuk is correct for 'creating'. |
| `sip.incoming.active` | Bejövő hívások érkeznek. | **Bejövő hívások fogadása aktív** | Érkeznek is not precise; fogadása aktív is better for 'reception is active'. |
| `sip.incoming.pausedHint` | Aktiválja a vételt, hogy a VibeVox átirányítsa a bejövő hívásokat. | **Aktiválja a vételt, hogy a VibeVox elkezdje fordítani a bejövő hívásokat.** | Átirányítsa is wrong word sense; elkezdje fordítani is correct for 'start translating'. |
| `sip.incoming.stop` | Stop | **Leállítás** | English translation, should be Hungarian. |
| `sip.incoming.show` | Megmutat | **Megjelenítés** | Megmutat is verb; Megjelenítés is correct for 'show' (button). |
| `sip.incoming.hide` | Elrejt | **Elrejtés** | Elrejt is verb; Elrejtés is correct for 'hide' (button). |
| `sip.incoming.copy` | Másolat | **Másolás** | Másolat is a noun; Másolás is correct for 'copy' (button). |
| `sip.incoming.toggleFailed` | Nem sikerült átváltani a vételre | **Nem sikerült a vétel kapcsolása** | Átváltani a vételre is awkward; a vétel kapcsolása is better for 'toggle reception'. |
| `sip.toasts.saveFailed` | Nem sikerült menteni a csomagtartót | **Nem sikerült menteni a fővonalat** | Csomagtartót is wrong word sense; fővonalat is correct for SIP trunk. |
| `sip.toasts.deleted` | A törzs törölve lett. | **A fővonal törölve lett.** | Törzs is literal; fővonal is better for SIP trunk. |
| `sip.toasts.deleteFailed` | Nem sikerült törölni a törzset | **Nem sikerült törölni a fővonalat** | Törzset is literal; fővonalat is correct for SIP trunk. |
| `sip.danger.deleteTrunk` | Törzs törlése | **Fővonal törlése** | Törzs is literal; fővonal is correct for SIP trunk. |
| `sip.danger.deleteInboundHint` | A LiveKit bejövő törzs- és irányítószabálya eltávolításra kerül. A bejövő hívásokat a továbbiakban nem fogadja a rendszer. | **A LiveKit bejövő fővonal- és irányítószabálya eltávolításra kerül. A bejövő hívásokat a továbbiakban nem fogadja a rendszer.** | Törzs is literal; fővonal is correct for SIP trunk. |
| `sip.confirm.deleteInboundBody` | Ez a művelet visszafordíthatatlan. A bejövő törzs- és diszpécserszabály törlődik a LiveKit Cloudban. | **Ez a művelet visszafordíthatatlan. A bejövő fővonal- és diszpécserszabály törlődik a LiveKit Cloudban.** | Törzs is literal; fővonal is correct for SIP trunk. |
| `enterprise.page.title` | Vállalati beállítások | **Enterprise beállítások** | Enterprise is a brand/tier name, should be preserved. |
| `enterprise.tabs.questFlow` | Küldetésfolyamat | **Quest Flow** | Quest Flow is a brand name, should not be translated. |
| `enterprise.common.save` | Megtakarítás | **Mentés** | Megtakarítás means 'saving money'; Mentés is correct for 'save' data. |
| `enterprise.common.saving` | Megtakarítás… | **Mentés…** | Megtakarítás means 'saving money'; Mentés is correct for 'saving' data. |
| `enterprise.common.copy` | Másolat | **Másolás** | Másolat is a noun; Másolás is correct for 'copy' (button). |
| `enterprise.common.show` | Megmutat | **Megjelenítés** | Megmutat is verb; Megjelenítés is correct for 'show' (button). |
| `enterprise.common.hide` | Elrejt | **Elrejtés** | Elrejt is verb; Elrejtés is correct for 'hide' (button). |
| `enterprise.apiKey.copy` | Másolat | **Másolás** | Másolat is a noun; Másolás is correct for 'copy' (button). |
| `enterprise.apiKey.show` | Megmutat | **Megjelenítés** | Megmutat is verb; Megjelenítés is correct for 'show' (button). |
| `enterprise.apiKey.hide` | Elrejt | **Elrejtés** | Elrejt is verb; Elrejtés is correct for 'hide' (button). |
| `enterprise.gemini.aiStudioLink` | AI Stúdió | **AI Studio** | AI Studio is a brand name, should not be translated. |
| `enterprise.gemini.savingLabel` | Megtakarítás… | **Mentés…** | Megtakarítás means 'saving money'; Mentés is correct for 'saving' data. |
| `enterprise.gemini.telegram.leadStartCmd` | /indul | **/start** | /start is a command, should be preserved. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ A @{{username}} bot mentésre került. Bárki, aki elküldi neki az /start szövegű üzenetet, értesítést fog kapni. | **✓ A @{{username}} bot mentésre került. Bárki, aki elküldi neki az /start üzenetet, értesítést fog kapni.** | /start is a command, should be preserved. |
| `enterprise.gemini.telegram.saveLabel` | Megtakarítás | **Mentés** | Megtakarítás means 'saving money'; Mentés is correct for 'save' data. |
| `enterprise.gemini.telegram.savingLabel` | Megtakarítás… | **Mentés…** | Megtakarítás means 'saving money'; Mentés is correct for 'saving' data. |
| `enterprise.gemini.telegram.testingLabel` | Sisak… | **Küldés…** | Sisak is wrong word sense; Küldés is correct for 'sending'. |
| `enterprise.prompt.savePrompt` | Promóció mentése | **Prompt mentése** | Promóció is wrong word sense; Prompt is a technical term, should be preserved. |
| `enterprise.prompt.hideDefault` | Elrejt | **Elrejtés** | Elrejt is verb; Elrejtés is correct for 'hide' (button). |
| `enterprise.prompt.headerLeadBold2` | "Kérésed szerint" | **«A promptod szerint»** | Kérésed szerint translates the meaning, but 'prompt' is a technical term and should be preserved. |
| `enterprise.prompt.contextHeading` | Kontextus / promot | **Kontextus / prompt** | Typo: 'promot' should be 'prompt'. |
| `enterprise.prompt.contextLeadBold` | "Kérésed szerint" | **«A promptod szerint»** | Kérésed szerint translates the meaning, but 'prompt' is a technical term and should be preserved. |
| `enterprise.prompt.promptPlaceholder` | A promóciód... | **A promptod...** | Promóciód is wrong word sense; promptod is correct for 'your prompt'. |
| `enterprise.prompt.savingPromptLabel` | Megtakarítás… | **Mentés…** | Megtakarítás means 'saving money'; Mentés is correct for 'saving' data. |
| `enterprise.prompt.savePromptLabel` | Promóció mentése | **Prompt mentése** | Promóció is wrong word sense; Prompt is a technical term, should be preserved. |
| `enterprise.prompt.kbUploading` | Terhelés… | **Betöltés…** | Terhelés means 'burden'; Betöltés is correct for 'loading' data. |
| `enterprise.prompt.presetsLeadBold` | "Kérésed szerint" | **«A promptod szerint»** | Kérésed szerint translates the meaning, but 'prompt' is a technical term and should be preserved. |
| `enterprise.questFlow.heading` | Küldetésfolyamat | **Quest Flow** | Quest Flow is a brand name, should not be translated. |
| `enterprise.questFlow.promptLabel` | Küldetésfolyamat-rendszer prompt | **Quest Flow rendszer prompt** | Quest Flow is a brand name, should be preserved. |
| `enterprise.questFlow.kbLabel` | Küldetésfolyamat Tudásbázis | **Quest Flow Tudásbázis** | Quest Flow is a brand name, should be preserved. |
| `enterprise.questFlow.savePrompt` | Promóció mentése | **Prompt mentése** | Promóció is wrong word sense; Prompt is a technical term, should be preserved. |
| `enterprise.questFlow.creatingKey` | Alkotjuk… | **Létrehozzuk…** | Alkotjuk is wrong word sense; Létrehozzuk is correct for 'creating'. |
| `enterprise.questFlow.errDelete` | Delete error | **Törlési hiba** | English translation, should be Hungarian. |
| `enterprise.questFlow.copyKey` | Másolat | **Másolás** | Másolat is a noun; Másolás is correct for 'copy' (button). |
| `enterprise.questFlow.deleteTitle` | Delete | **Törlés** | English translation, should be Hungarian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Kulcs törlése?** | English translation, should be Hungarian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **A kulcs véglegesen törlődik. A Quest Flow nem fog működni rajta keresztül – új kulcsot kell létrehozni és lecserélni a folyamatban.** | English translation, should be Hungarian. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Törlés** | English translation, should be Hungarian. |
| `enterprise.questFlow.promptHeading` | Rákérdezés a Telegram-beszélgetésekre | **Prompt Telegram-beszélgetésekhez** | Rákérdezés is wrong word sense; Prompt is a technical term, should be preserved. |
| `enterprise.questFlow.promptLeadBold2` | Ha kitöltöd az | **Ha kitöltöd a sajátodat** | Incomplete sentence, 'a sajátodat' is more natural. |
| `enterprise.questFlow.promptPlaceholder` | A promóciód... | **A promptod...** | Promóciód is wrong word sense; promptod is correct for 'your prompt'. |
| `enterprise.questFlow.savingPromptLabel` | Megtakarítás… | **Mentés…** | Megtakarítás means 'saving money'; Mentés is correct for 'saving' data. |
| `enterprise.questFlow.savePromptLabel` | Megtakarítás | **Mentés** | Megtakarítás means 'saving money'; Mentés is correct for 'save' data. |
| `enterprise.questFlow.successPromptSaved` | Küldetésfolyamat prompt mentve. | **Quest Flow prompt mentve.** | Quest Flow is a brand name, should be preserved. |
| `enterprise.questFlow.kbUploading` | Terhelés… | **Betöltés…** | Terhelés means 'burden'; Betöltés is correct for 'loading' data. |
| `enterprise.chatwoot.save` | Megtakarítás | **Mentés** | Megtakarítás means 'saving money'; Mentés is correct for 'save' data. |
| `enterprise.chatwoot.savingLabel` | Megtakarítás… | **Mentés…** | Megtakarítás means 'saving money'; Mentés is correct for 'saving' data. |
| `enterprise.chatwoot.saveLabel` | Megtakarítás | **Mentés** | Megtakarítás means 'saving money'; Mentés is correct for 'save' data. |
| `chat.telegramBadge` | Távirat | **Telegram** | Telegram is a brand name, should be preserved. |
| `insights.summary` | Önéletrajz | **Összefoglaló** | Önéletrajz is wrong word sense; Összefoglaló is correct for 'summary'. |
| `insights.sentiment` | Kulcsfontosságú | **Hangnem** | Kulcsfontosságú is wrong word sense; Hangnem is correct for 'sentiment/tonality'. |
| `insights.engagement` | Eljegyzés | **Bevonódás** | Eljegyzés is wrong word sense; Bevonódás is correct for 'engagement' (involvement). |
| `postCallInsights.subtitle` | Vállalat · hívás utáni elemzések | **Enterprise · hívás utáni elemzések** | Enterprise is a brand/tier name, should be preserved. |
| `postCallInsights.metricEngagement` | Eljegyzés | **Bevonódás** | Eljegyzés is wrong word sense; Bevonódás is correct for 'engagement' (involvement). |
| `postCallInsights.summary` | Önéletrajz | **Összefoglaló** | Önéletrajz is wrong word sense; Összefoglaló is correct for 'summary'. |
| `billingPage.title` | Vámtarifák és fizetés | **Tarifák és fizetés** | Vámtarifák means customs tariffs; Tarifák is correct for pricing plans. |
| `billingPage.balanceMinutes` | jegyzőkönyv | **perc** | Jegyzőkönyv is wrong word sense; perc is correct for 'minutes' (time). |
| `billingPage.tierLabel` | Arány | **Tarifa** | Arány is wrong word sense; Tarifa is correct for 'pricing plan'. |
| `billingPage.resume` | Önéletrajz | **Folytatás** | Önéletrajz is wrong word sense; Folytatás is correct for 'resume' (action). |
| `paywall.subscribe` | Tervezés | **Előfizetés** | Tervezés is wrong word sense; Előfizetés is correct for 'subscribe/sign up'. |
| `paywall.topupPlusLine` | Plusz tarifa ({{count}} minimum benne van) | **Plusz tarifa ({{count}} perc benne van)** | Minimum is wrong word sense; perc is correct for 'minutes'. |
| `paywall.topupAddon` | További vásárlás {{count}} min × 0,17 € | **További vásárlás {{count}} perc × 0,17 €** | min should be translated to perc. |
| `paywall.close` | Közeli | **Bezárás** | Közeli is an adjective; Bezárás is correct for 'close' (button). |
| `billingPage.topupCarried` | Elhalasztva | **Áthozva** | Elhalasztva is wrong word sense; Áthozva is correct for 'carried over'. |
| `billingPage.minutesShort` | jegyzőkönyv | **perc** | Jegyzőkönyv is wrong word sense; perc is correct for 'minutes' (time). |
| `billingPage.tierEnterpriseName` | Vállalkozás | **Enterprise** | Enterprise is a brand/tier name, should be preserved. |
| `billingPage.ctaSubscribePlus` | Plusz beszerzése | **Előfizetés Pluszra** | Beszerzése is wrong word sense; Előfizetés Pluszra is correct for 'subscribe to Plus'. |
| `billingPage.ctaSubscribeStandard` | Rendelési szabvány | **Előfizetés Standardra** | Rendelési szabvány is wrong word sense; Előfizetés Standardra is correct for 'subscribe to Standard'. |
| `billingPage.ctaContact` | Érintkezés | **Kapcsolatfelvétel** | Érintkezés is wrong word sense; Kapcsolatfelvétel is correct for 'contact' (button). |
| `billingPage.renewsOn` | {{date}} kiterjesztés | **{{date}} megújítás** | Kiterjesztés is wrong word sense; megújítás is correct for 'renewal'. |
| `auth.login.registerLink` | Nyilvántartás | **Regisztráció** | Nyilvántartás is wrong word sense; Regisztráció is correct for 'register' (button). |
| `auth.register.submit` | Nyilvántartás | **Regisztráció** | Nyilvántartás is wrong word sense; Regisztráció is correct for 'register' (button). |
