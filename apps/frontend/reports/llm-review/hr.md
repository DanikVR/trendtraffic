# LLM Review: Croatian (hr)

**Model:** gemini-2.5-flash  
**Took:** 177.4s  
**Fixes proposed:** 145 (valid after placeholder-check: 141)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.home` | Dom | **Početna** | 'Dom' is noun 'home', 'Početna' is 'Home page' (UI label). |
| `rooms.title` | sobe za prevođenje | **Sobe za prevođenje** | Capitalization: 'Sobe' should be capitalized. |
| `rooms.tabs.questFlow` | Tijek zadatka | **Quest Flow** | BRAND NAME: 'Quest Flow' should be preserved. |
| `rooms.live` | Živjeti | **Uživo** | 'Živjeti' is verb 'to live'. 'Uživo' means 'Live' (active/ongoing). |
| `rooms.actions.open` | Prijava | **Uđi** | 'Prijava' means 'Login'. 'Uđi' means 'Enter' or 'Join'. |
| `common.cancel` | Otkazati | **Otkaži** | 'Otkazati' is a verb. 'Otkaži' is imperative for button label. |
| `common.save` | Uštedjeti | **Spremi** | 'Uštedjeti' means 'to save money/time'. 'Spremi' means 'to save data'. |
| `common.success` | Spreman | **Gotovo** | 'Spreman' is masculine 'ready'. 'Gotovo' (neuter) means 'Done'. |
| `balance.openPlans` | Otvorene tarife i stanje | **Otvori tarife i stanje** | 'Otvorene' is adjective. 'Otvori' is imperative. |
| `tier.standardYearly` | Godišnje | **Yearly** | BRAND NAME: 'Yearly' should be preserved. |
| `moreSheet.sip.sub` | Postavljanje prtljažnika | **Postavljanje SIP trunkova** | 'Prtljažnika' means 'car trunk'. 'SIP trunkova' is correct technical term. |
| `call.you` | Vas | **Vi** | 'Vas' is accusative. 'Vi' is nominative for 'You'. |
| `call.geminiLive` | Blizanci uživo | **Gemini Live** | BRAND NAME: 'Gemini' should be preserved. |
| `call.toPlayground` | 🎯 Na odlagalište otpada | **🎯 Na poligon** | 'Odlagalište otpada' is 'landfill'. 'Poligon' means 'training ground'. |
| `coach.tones.short` | Kratak | **Kratko** | Adjective gender: 'Kratak' is masculine, should be neuter 'Kratko'. |
| `coach.tones.empathic` | Empatičan | **Empatično** | Adjective gender: 'Empatičan' is masculine, should be neuter 'Empatično'. |
| `roomActions.translation.disableSub` | Zapisnici se više neće otpisivati | **Minute se više neće otpisivati** | 'Zapisnici' means 'records'. 'Minute' (time unit) is correct. |
| `settings.themeDarkSub` | Bezdan Aurora (tamno) | **Abyss Aurora (Dark)** | BRAND NAME: 'Abyss Aurora' should be preserved. |
| `settings.themeLightSub` | Aurora u oblaku (svjetlost) | **Cloud Aurora (Light)** | BRAND NAME: 'Cloud Aurora' should be preserved. |
| `partner.subtitle` | Share your link and earn | **Podijelite svoju poveznicu i zaradite** | NOT TRANSLATED: English string found. |
| `partner.yourLink` | Your link | **Vaša poveznica** | NOT TRANSLATED: English string found. |
| `partner.copy` | Copy | **Kopiraj** | NOT TRANSLATED: English string found. |
| `partner.copied` | ✓ Link copied | **✓ Poveznica kopirana** | NOT TRANSLATED: English string found. |
| `partner.stats.clicks` | Clicks | **Klikovi** | NOT TRANSLATED: English string found. |
| `partner.stats.registrations` | Sign-ups | **Registracije** | NOT TRANSLATED: English string found. |
| `partner.stats.paid` | Payments | **Uplate** | NOT TRANSLATED: English string found. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} korisnika · {{minutes}} min** | NOT TRANSLATED: 'users' should be localized. |
| `partner.terms` | Program terms | **Uvjeti programa** | NOT TRANSLATED: English string found. |
| `partner.contact` | Contact us | **Kontaktirajte nas** | NOT TRANSLATED: English string found. |
| `partner.termsModalTitle` | Partner program terms | **Uvjeti partnerskog programa** | NOT TRANSLATED: English string found. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Uvjeti programa još nisu postavljeni. Molimo kontaktirajte SuperAdmina.** | NOT TRANSLATED: English string found. |
| `partner.loadError` | Failed to load partner data | **Nije uspjelo učitavanje partnerskih podataka** | NOT TRANSLATED: English string found. |
| `sip.editTrunk` | Promjena postavki prtljažnika | **Promjena postavki SIP trunka** | 'Prtljažnika' means 'car trunk'. 'SIP trunka' is correct technical term. |
| `sip.trunkId` | ID prtljažnika | **ID trunka** | 'Prtljažnika' means 'car trunk'. 'Trunka' is correct technical term. |
| `sip.savingShort` | Spremanje… | **Spremam…** | 'Spremanje' is a noun. 'Spremam' is verb 'I am saving'. |
| `sip.createTrunk` | Izradi prtljažnik | **Izradi trunk** | 'Prtljažnik' means 'car trunk'. 'Trunk' is correct technical term. |
| `sip.deletingShort` | Brisanje… | **Brišem…** | 'Brisanje' is a noun. 'Brišem' is verb 'I am deleting'. |
| `sip.incoming.creating` | Mi stvaramo… | **Stvaram…** | 'Mi stvaramo' means 'We are creating'. 'Stvaram' is 'I am creating'. |
| `sip.incoming.activeHint` | Prevoditelj Bridgea sluša situaciju u sobi. Svaki poziv se prevodi u stvarnom vremenu. | **Bridge prevoditelj sluša sobu. Svaki poziv se prevodi u stvarnom vremenu.** | BRAND NAME: 'Bridge' should be preserved, not inflected. |
| `sip.incoming.pausedHint` | Aktivirajte prijem kako bi VibeVox počeo preusmjeravati dolazne pozive. | **Aktivirajte prijem kako bi VibeVox počeo prevoditi dolazne pozive.** | 'Preusmjeravati' means 'redirect'. 'Prevoditi' means 'translate'. |
| `sip.incoming.translationRoom` | Soba za prevoditelje | **Soba za prevođenje** | 'Soba za prevoditelje' means 'room for translators'. 'Soba za prevođenje' means 'translation room'. |
| `sip.incoming.reissue` | Ponovno izdanje | **Ponovno izdaj** | 'Ponovno izdanje' is a noun. 'Ponovno izdaj' is imperative. |
| `sip.toasts.saveFailed` | Spremanje prtljažnika nije uspjelo | **Spremanje trunka nije uspjelo** | 'Prtljažnika' means 'car trunk'. 'Trunka' is correct technical term. |
| `sip.toasts.deleted` | Prtljažnik je izbrisan. | **Trunk je izbrisan.** | 'Prtljažnik' means 'car trunk'. 'Trunk' is correct technical term. |
| `sip.toasts.deleteFailed` | Brisanje prtljažnika nije uspjelo | **Brisanje trunka nije uspjelo** | 'Prtljažnika' means 'car trunk'. 'Trunka' is correct technical term. |
| `sip.connected` | SIP trunk se sprema i sinkronizira s LiveKitom | **SIP trunk je spremljen i sinkroniziran s LiveKitom** | Grammar: 'se sprema' is present tense. 'je spremljen' is past participle. |
| `sip.danger.deleteTrunk` | Izbriši prtljažnik | **Izbriši trunk** | 'Prtljažnik' means 'car trunk'. 'Trunk' is correct technical term. |
| `sip.outbound2.callButton` | Poziv | **Nazovi** | 'Poziv' is a noun. 'Nazovi' is imperative for 'Call'. |
| `sip.confirm.deleteTrunkBody` | Ova radnja je nepovratna. Nakon brisanja, odlazni pozivi će se zaustaviti dok se ne stvori novi operater. | **Ova radnja je nepovratna. Nakon brisanja, odlazni pozivi će se zaustaviti dok se ne stvori novi trunk.** | 'Operater' means 'operator'. 'Trunk' is correct technical term. |
| `enterprise.tabs.questFlow` | Tijek zadatka | **Quest Flow** | BRAND NAME: 'Quest Flow' should be preserved. |
| `enterprise.common.inactive` | Nije aktivno | **Nije aktivan** | Adjective gender: 'Nije aktivno' is neuter, 'aktivan' is masculine (for 'status'). |
| `enterprise.common.save` | Uštedjeti | **Spremi** | 'Uštedjeti' means 'to save money/time'. 'Spremi' means 'to save data'. |
| `enterprise.common.savedPlaceholder` | Spremljeno (unesite novo za zamjenu) | **Spremljen (unesite novo za zamjenu)** | Adjective gender: 'Spremljeno' is neuter, 'Spremljen' is masculine (for 'ključ'). |
| `enterprise.common.saving` | Spremanje… | **Spremam…** | 'Spremanje' is a noun. 'Spremam' is verb 'I am saving'. |
| `enterprise.common.saved` | Spremljeno | **Spremljen** | Adjective gender: 'Spremljeno' is neuter, 'Spremljen' is masculine (for 'ključ'). |
| `enterprise.common.savedPrefix` | Spremljeno: {{prefix}} | **Spremljen: {{prefix}}** | Adjective gender: 'Spremljeno' is neuter, 'Spremljen' is masculine (for 'ključ'). |
| `enterprise.apiKey.savedPrefix` | Spremljeno: {{prefix}} | **Spremljen: {{prefix}}** | Adjective gender: 'Spremljeno' is neuter, 'Spremljen' is masculine (for 'ključ'). |
| `enterprise.apiKey.savedPlaceholder` | Spremljeno (unesite novo za zamjenu) | **Spremljen (unesite novo za zamjenu)** | Adjective gender: 'Spremljeno' is neuter, 'Spremljen' is masculine (for 'ključ'). |
| `enterprise.gemini.statusNotSet` | Nije postavljeno | **Nije postavljen** | Adjective gender: 'Nije postavljeno' is neuter, 'Nije postavljen' is masculine (for 'ključ'). |
| `enterprise.gemini.statusInvalid` | Nevažeće | **Nevažeći** | Adjective gender: 'Nevažeće' is neuter, 'Nevažeći' is masculine (for 'ključ'). |
| `enterprise.gemini.statusNotChecked` | Nije potvrđeno | **Nije provjeren** | Adjective gender: 'Nije potvrđeno' is neuter, 'Nije provjeren' is masculine (for 'ključ'). |
| `enterprise.gemini.savingLabel` | Spremanje… | **Spremam…** | 'Spremanje' is a noun. 'Spremam' is verb 'I am saving'. |
| `enterprise.gemini.successSavedWithIssue` | Spremljeno, ali validacija: {{error}} | **Spremljen, ali validacija: {{error}}** | Adjective gender: 'Spremljeno' is neuter, 'Spremljen' is masculine (for 'ključ'). |
| `enterprise.gemini.confirmDeleteTitle` | Izbrisati Gemini ključ po korisniku? | **Izbrisati Gemini ključ po stanaru?** | 'Korisniku' means 'user'. 'Stanaru' means 'tenant'. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Bot @{{username}} je spremljen. Svatko tko mu pošalje SMS poruku /start primit će obavijesti. | **✓ Bot @{{username}} je spremljen. Svatko tko mu napiše /start primit će obavijesti.** | Unnecessary addition of 'SMS poruku'. |
| `enterprise.gemini.telegram.saveLabel` | Uštedjeti | **Spremi** | 'Uštedjeti' means 'to save money/time'. 'Spremi' means 'to save data'. |
| `enterprise.gemini.telegram.savingLabel` | Spremanje… | **Spremam…** | 'Spremanje' is a noun. 'Spremam' is verb 'I am saving'. |
| `enterprise.gemini.telegram.testingLabel` | Kaciga… | **Šaljem…** | WRONG WORD SENSE: 'Kaciga' means 'helmet'. 'Šaljem' means 'Sending...'. |
| `enterprise.gemini.telegram.lastBroadcast` | Najnovija pošta: dostavljeno {{sent}} od {{total}} | **Zadnja objava: dostavljeno {{sent}} od {{total}}** | 'Pošta' means 'mail'. 'Objava' means 'broadcast/post'. |
| `enterprise.prompt.subtitle` | Brzina i baza znanja za transkripciju samo u video sobama | **Prompt i baza znanja za transkripciju samo u video sobama** | 'Brzina' means 'speed'. 'Prompt' is correct technical term. |
| `enterprise.prompt.promptLabel` | Sistemski uput (ton, stil, vokabular) | **Sistemski prompt (ton, stil, vokabular)** | 'Uput' is not 'prompt'. 'Prompt' is correct technical term. |
| `enterprise.prompt.saved` | Spremljeno ✓ | **Spremljen ✓** | Adjective gender: 'Spremljeno' is neuter, 'Spremljen' is masculine (for 'prompt'). |
| `enterprise.prompt.defaultLabel` | VibeVox zadani upit | **VibeVox zadani prompt** | 'Upit' means 'query'. 'Prompt' is correct technical term. |
| `enterprise.prompt.headerLeadBold2` | "Prema vašem zahtjevu" | **"Prema vašem promptu"** | 'Zahtjevu' means 'request'. 'Promptu' is correct technical term. |
| `enterprise.prompt.contextHeading` | Kontekst / uputa | **Kontekst / prompt** | 'Uputa' means 'instruction'. 'Prompt' is correct technical term. |
| `enterprise.prompt.contextLeadBold` | "Prema vašem zahtjevu" | **"Prema vašem promptu"** | 'Zahtjevu' means 'request'. 'Promptu' is correct technical term. |
| `enterprise.prompt.extendNoteText` | s vlastitim pravilima/stilom/terminologijom - bit će kombinirani s gornjim zadanim upitom i bazom znanja. | **s vlastitim pravilima/stilom/terminologijom - bit će kombinirani s gornjim zadanim promptom i bazom znanja.** | 'Upitom' means 'query'. 'Promptom' is correct technical term. |
| `enterprise.prompt.promptPlaceholder` | Vaš upit... | **Vaš prompt...** | 'Upit' means 'query'. 'Prompt' is correct technical term. |
| `enterprise.prompt.savingPromptLabel` | Spremanje… | **Spremam…** | 'Spremanje' is a noun. 'Spremam' is verb 'I am saving'. |
| `enterprise.prompt.savePromptLabel` | Spremi upit | **Spremi prompt** | 'Upit' means 'query'. 'Prompt' is correct technical term. |
| `enterprise.prompt.successPromptSaved` | Upit spremljen. | **Prompt spremljen.** | 'Upit' means 'query'. 'Prompt' is correct technical term. |
| `enterprise.prompt.kbCharsSuffix` | simboli | **znakova** | 'Simboli' is nominative plural. 'Znakova' is genitive plural for 'characters'. |
| `enterprise.prompt.kbUploading` | Učitavanje… | **Učitavam…** | 'Učitavanje' is a noun. 'Učitavam' is verb 'I am uploading'. |
| `enterprise.prompt.errLoadFile` | Prijenos datoteke nije uspio | **Nije uspjelo učitavanje datoteke** | 'Prijenos datoteke' means 'file transfer'. 'Učitavanje datoteke' means 'file upload'. |
| `enterprise.prompt.presetsLeadBold` | "Prema vašem zahtjevu" | **"Prema vašem promptu"** | 'Zahtjevu' means 'request'. 'Promptu' is correct technical term. |
| `enterprise.prompt.presetsLeadPart2` | koristi vašu poruku iz gornjeg polja. | **koristi vaš prompt iz gornjeg polja.** | 'Poruku' means 'message'. 'Prompt' is correct technical term. |
| `enterprise.questFlow.heading` | Tijek zadatka | **Quest Flow** | BRAND NAME: 'Quest Flow' should be preserved. |
| `enterprise.questFlow.promptLabel` | Upit sustava tijeka zadatka | **Sistemski prompt Quest Flow** | 'Upit' and 'tijeka zadatka' are incorrect. 'Prompt Quest Flow' is correct. |
| `enterprise.questFlow.saved` | Spremljeno ✓ | **Spremljen ✓** | Adjective gender: 'Spremljeno' is neuter, 'Spremljen' is masculine (for 'prompt'). |
| `enterprise.questFlow.keyLabelPlaceholder` | Oznaka (nije obavezno), na primjer: "Klinika za proizvode bota" | **Oznaka (neobavezno), na primjer: "Bot za kliniku"** | Clunky translation, simplified example. |
| `enterprise.questFlow.creatingKey` | Mi stvaramo… | **Stvaram…** | 'Mi stvaramo' means 'We are creating'. 'Stvaram' is 'I am creating'. |
| `enterprise.questFlow.errDelete` | Delete error | **Pogreška brisanja** | NOT TRANSLATED: English string found. |
| `enterprise.questFlow.usedOn` | korišteno {{date}} | **korišten {{date}}** | Adjective gender: 'Korišteno' is neuter, 'korišten' is masculine (for 'ključ'). |
| `enterprise.questFlow.neverUsed` | nije korišteno | **nije korišten** | Adjective gender: 'Nije korišteno' is neuter, 'nije korišten' is masculine (for 'ključ'). |
| `enterprise.questFlow.deleteTitle` | Delete | **Izbriši** | NOT TRANSLATED: English string found. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Izbrisati ključ?** | NOT TRANSLATED: English string found. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Ključ će biti trajno izbrisan. Quest Flow više neće raditi preko njega — morat ćete stvoriti novi ključ i zamijeniti ga u tijeku.** | NOT TRANSLATED: English string found. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Izbriši** | NOT TRANSLATED: English string found. |
| `enterprise.questFlow.promptHeading` | Upit za Telegram razgovore | **Prompt za Telegram razgovore** | 'Upit' means 'query'. 'Prompt' is correct technical term. |
| `enterprise.questFlow.promptLead3` | - bit će kombinirano s osnovnim upitom i bazom znanja. | **- bit će kombinirano s osnovnim promptom i bazom znanja.** | 'Upitom' means 'query'. 'Promptom' is correct technical term. |
| `enterprise.questFlow.promptPlaceholder` | Vaš upit... | **Vaš prompt...** | 'Upit' means 'query'. 'Prompt' is correct technical term. |
| `enterprise.questFlow.savingPromptLabel` | Spremanje… | **Spremam…** | 'Spremanje' is a noun. 'Spremam' is verb 'I am saving'. |
| `enterprise.questFlow.savePromptLabel` | Uštedjeti | **Spremi** | 'Uštedjeti' means 'to save money/time'. 'Spremi' means 'to save data'. |
| `enterprise.questFlow.successPromptSaved` | Spremljen je upit Tijek zadatka. | **Prompt Quest Flow je spremljen.** | 'Upit' and 'Tijek zadatka' are incorrect. 'Prompt Quest Flow' is correct. |
| `enterprise.questFlow.kbHeading` | Baza znanja za tijek zadataka | **Baza znanja za Quest Flow** | BRAND NAME: 'Quest Flow' should be preserved. |
| `enterprise.questFlow.kbLeadBold2` | odvojen | **odvojena** | Adjective gender: 'Odvojen' is masculine, 'odvojena' is feminine (for 'baza'). |
| `enterprise.questFlow.kbCharsSuffix` | simboli | **znakova** | 'Simboli' is nominative plural. 'Znakova' is genitive plural for 'characters'. |
| `enterprise.questFlow.kbUploading` | Učitavanje… | **Učitavam…** | 'Učitavanje' is a noun. 'Učitavam' is verb 'I am uploading'. |
| `chat.deletingShort` | Brisanje… | **Brišem…** | 'Brisanje' is a noun. 'Brišem' is verb 'I am deleting'. |
| `insights.recalc` | Ponovno prebrojavanje | **Ponovno izračunaj** | 'Prebrojavanje' means 'counting'. 'Izračunaj' means 'calculate'. |
| `insights.summary` | Životopis | **Sažetak** | 'Životopis' means 'CV'. 'Sažetak' means 'summary'. |
| `insights.sentiment` | Ključ | **Tonalitet** | 'Ključ' means 'key'. 'Tonalitet' means 'tonality/sentiment'. |
| `insights.leadScore` | Rezultat vodećih | **Lead Score** | BRAND NAME/TECHNICAL TERM: 'Lead Score' should be preserved. |
| `insights.sentimentValues.positive` | Pozitivan | **Pozitivno** | Adjective gender: 'Pozitivan' is masculine, 'Pozitivno' is neuter (for 'raspoloženje'). |
| `insights.sentimentValues.negative` | Negativan | **Negativno** | Adjective gender: 'Negativan' is masculine, 'Negativno' is neuter (for 'raspoloženje'). |
| `insights.leadValues.hot` | Vruće | **Vruć** | Adjective gender: 'Vruće' is neuter, 'Vruć' is masculine (for 'lead'). |
| `insights.leadValues.warm` | Toplo | **Topao** | Adjective gender: 'Toplo' is neuter, 'Topao' is masculine (for 'lead'). |
| `insights.leadValues.cold` | Hladno | **Hladan** | Adjective gender: 'Hladno' is neuter, 'Hladan' is masculine (for 'lead'). |
| `lobby.andWord` | I | ** i ** | Capitalization: 'I' should be lowercase in this context. |
| `lobby.privacy` | Pravila o privatnosti | **Politikom privatnosti** | 'Pravila' is plural. 'Politikom' (singular) is correct for 'policy'. |
| `paywall.subtitle` | Odaberite plan ili kupite više minuta – platite putem Stripea, odmah izvršite povrat novca ovdje. | **Odaberite plan ili kupite više minuta – platite putem Stripea, odmah ćete biti preusmjereni ovdje.** | 'Povrat novca' means 'refund'. 'Preusmjereni' means 'redirected'. |
| `paywall.subscribe` | Dizajn | **Pretplati se** | 'Dizajn' means 'design'. 'Pretplati se' means 'subscribe'. |
| `confirmModal.cancel` | Otkazati | **Otkaži** | 'Otkazati' is a verb. 'Otkaži' is imperative for button label. |
| `postCallInsights.subtitle` | Uvidi nakon poziva u poduzeće | **Enterprise uvidi nakon poziva** | Grammar/Meaning: 'u poduzeće' means 'into the enterprise'. 'Enterprise uvidi' is better. |
| `postCallInsights.metricLeadScore` | Rezultat potencijalnog klijenta | **Lead Score** | BRAND NAME/TECHNICAL TERM: 'Lead Score' should be preserved. |
| `postCallInsights.summary` | Životopis | **Sažetak** | 'Životopis' means 'CV'. 'Sažetak' means 'summary'. |
| `billingPage.tierLabel` | Stopa | **Tarifa** | 'Stopa' means 'rate'. 'Tarifa' means 'plan/tariff'. |
| `billingPage.cancel` | Otkazati | **Otkaži** | 'Otkazati' is a verb. 'Otkaži' is imperative for button label. |
| `billingPage.resume` | Životopis | **Nastavi** | 'Životopis' means 'CV'. 'Nastavi' means 'Resume'. |
| `billingPage.languagesCount_few` | {{count}} jezik | **{{count}} jezika** | Grammar: 'jezik' is singular. 'jezika' is genitive plural. |
| `billingPage.featurePersonalPrompts` | Osobne AI upute | **Osobni AI promptovi** | 'Upute' means 'instructions'. 'Promptovi' is correct technical term. |
| `billingPage.ctaSubscribePlus` | Uzmi Plus | **Pretplati se na Plus** | 'Uzmi' means 'take'. 'Pretplati se na' means 'subscribe to'. |
| `billingPage.ctaSubscribeStandard` | Standardna narudžba | **Pretplati se na Standard** | 'Narudžba' means 'order'. 'Pretplati se na' means 'subscribe to'. |
| `billingPage.ctaContact` | Kontakt | **Kontaktiraj nas** | 'Kontakt' is a noun. 'Kontaktiraj nas' is imperative for 'Contact us'. |
| `billingPage.faqA3` | Potpuni AI paket: kartice kupaca s automatskim prepoznavanjem, autorizacija putem Telegrama, personalizirane upute, Google kalendar, pametno označavanje potreba, izvoz u CRM, integracija s questflow.pro i zasebna administratorska kartica. | **Potpuni AI paket: kartice kupaca s automatskim prepoznavanjem, autorizacija putem Telegrama, personalizirani promptovi, Google kalendar, pametno označavanje potreba, izvoz u CRM, integracija s questflow.pro i zasebna administratorska kartica.** | 'Upute' means 'instructions'. 'Promptovi' is correct technical term. |
| `billingPage.topupDescription` | 0,17 € po minuti. Od 60 minuta do 10 sati. Kredit odmah nakon uplate. | **0,17 € po minuti. Od 60 minuta do 10 sati. Dodaju se odmah nakon uplate.** | 'Kredit' means 'credit/loan'. 'Dodaju se' means 'are added'. |
| `billingPage.renewsOn` | ekstenzija {{date}} | **obnova {{date}}** | 'Ekstenzija' means 'extension'. 'Obnova' means 'renewal'. |
| `auth.login.registerLink` | Registar | **Registriraj se** | 'Registar' is a noun. 'Registriraj se' is imperative. |
| `auth.register.submit` | Registar | **Registriraj se** | 'Registar' is a noun. 'Registriraj se' is imperative. |
| `auth.register.agreementAnd` | I | ** i ** | Capitalization: 'I' should be lowercase in this context. |
| `auth.register.agreementPrivacy` | Pravila o privatnosti | **Politikom privatnosti** | 'Pravila' is plural. 'Politikom' (singular) is correct for 'policy'. |

⚠ 4 fix(es) skipped (no-op, missing path, or would break placeholders).
