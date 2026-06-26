# LLM Review: Bosnian (bs)

**Model:** gemini-2.5-flash  
**Took:** 166.9s  
**Fixes proposed:** 40 (valid after placeholder-check: 40)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `partner.subtitle` | Share your link and earn | **Podijelite svoj link i zaradite** | Literal English translation, should be localized. |
| `partner.yourLink` | Your link | **Vaš link** | Literal English translation, should be localized. |
| `partner.copy` | Copy | **Kopiraj** | Literal English translation, should be localized. |
| `partner.copied` | ✓ Link copied | **✓ Link kopiran** | Literal English translation, should be localized. |
| `partner.stats.clicks` | Clicks | **Klikovi** | Literal English translation, should be localized. |
| `partner.stats.registrations` | Sign-ups | **Registracije** | Literal English translation, should be localized. |
| `partner.stats.paid` | Payments | **Uplate** | Literal English translation, should be localized. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} korisnika · {{minutes}} min** | Literal English translation, should be localized. Preserved 'min'. |
| `partner.terms` | Program terms | **Uslovi programa** | Literal English translation, should be localized. |
| `partner.contact` | Contact us | **Kontaktirajte nas** | Literal English translation, should be localized. |
| `partner.termsModalTitle` | Partner program terms | **Uslovi partnerskog programa** | Literal English translation, should be localized. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Uslovi programa još nisu postavljeni. Molimo kontaktirajte SuperAdmina.** | Literal English translation, should be localized. |
| `partner.loadError` | Failed to load partner data | **Nije uspjelo učitavanje partnerskih podataka** | Literal English translation, should be localized. |
| `toneMenu.generating` | VI generiše objašnjenje… | **AI generiše objašnjenje…** | AI should be preserved, not translated to VI. |
| `sip.subtitle` | Podešavanje linija za dolazne i odlazne pozive | **Podešavanje trunkova za dolazne i odlazne pozive** | Use 'trunkova' for consistency with 'SIP trunk'. |
| `sip.transport` | Prijevoz | **Transport** | Use 'Transport' as a technical term in IT/telecom context. |
| `sip.incoming.activeHint` | Prevodilac Bridge sluša situaciju u prostoriji. Svaki poziv se prevodi u realnom vremenu. | **Prevodilac Bridge sluša sobu. Svaki poziv se prevodi u realnom vremenu.** | More direct translation for 'слушает комнату'. |
| `sip.danger.deleteTrunkHint` | Konfiguracija će biti izbrisana. Odlazni pozivi će se zaustaviti dok ponovo ne kreirate liniju. | **Konfiguracija će biti izbrisana. Odlazni pozivi će se zaustaviti dok ponovo ne kreirate trunk.** | Use 'trunk' for consistency. |
| `enterprise.prompt.promptLabel` | Sistemski uput (ton, stil, vokabular) | **Sistemski prompt (ton, stil, vokabular)** | Use 'prompt' as a technical term. |
| `enterprise.prompt.defaultLabel` | VibeVox zadani upit | **VibeVox zadani prompt** | Use 'prompt' as a technical term. |
| `enterprise.prompt.extendNoteText` | sa svojim vlastitim pravilima/stilom/terminologijom - bit će kombinirani sa zadanim upitom iznad i bazom znanja. | **sa svojim vlastitim pravilima/stilom/terminologijom - bit će kombinirani sa zadanim promptom iznad i bazom znanja.** | Use 'promptom' for consistency. |
| `enterprise.prompt.successPromptSaved` | Upit je sačuvan. | **Prompt je sačuvan.** | Use 'Prompt' for consistency. |
| `enterprise.prompt.presetsLeadPart2` | koristi vaš upit iz gornjeg polja. | **koristi vaš prompt iz gornjeg polja.** | Use 'prompt' for consistency. |
| `enterprise.questFlow.keyLabelPlaceholder` | Oznaka (neobavezno), na primjer: "Klinika za proizvode bota" | **Oznaka (neobavezno), na primjer: "Bot za kliniku"** | More natural translation for 'Прод бот клиники'. |
| `enterprise.questFlow.errDelete` | Delete error | **Greška pri brisanju** | Literal English translation, should be localized. |
| `enterprise.questFlow.deleteTitle` | Delete | **Izbriši** | Literal English translation, should be localized. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Izbrisati ključ?** | Literal English translation, should be localized. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Ključ će biti trajno izbrisan. Quest Flow će prestati raditi preko njega — morat ćete kreirati novi ključ i zamijeniti ga u lancu.** | Literal English translation, should be localized. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Izbriši** | Literal English translation, should be localized. |
| `enterprise.questFlow.promptHeading` | Upit za Telegram razgovore | **Prompt za Telegram razgovore** | Use 'Prompt' for consistency. |
| `enterprise.questFlow.promptLead3` | - bit će kombinirano s osnovnim uputama i bazom znanja. | **- bit će kombinirano s osnovnim promptom i bazom znanja.** | Use 'promptom' for consistency. |
| `enterprise.questFlow.kbLeadBold2` | odvojeno | **odvojena** | Grammar: Adjective 'odvojena' should agree with feminine noun 'baza'. |
| `enterprise.chatwoot.whatSentItem2` | Conversation s privatnom bilješkom = potpuna historija dijaloga | **Razgovor s privatnom bilješkom = potpuna historija dijaloga** | Translate 'Conversation' to Bosnian. |
| `insights.recalc` | Ponovno brojanje | **Ponovo izračunaj** | More accurate translation for 'recalculate'. |
| `paywall.subscribe` | Dizajn | **Pretplati se** | Wrong word sense. 'Dizajn' means design, not subscribe/sign up. |
| `billingPage.featurePersonalPrompts` | Lične AI upute | **Lični AI promptovi** | Use 'promptovi' for consistency. |
| `billingPage.ctaSubscribePlus` | Nabavi Plus | **Pretplati se na Plus** | More appropriate translation for 'subscribe'. |
| `billingPage.ctaSubscribeStandard` | Nabavi Standard | **Pretplati se na Standard** | More appropriate translation for 'subscribe'. |
| `billingPage.faqA3` | Potpuni AI paket: kartice kupaca s automatskim prepoznavanjem, autorizacija putem Telegrama, personalizirani upiti, Google kalendar, pametno označavanje potreba, izvoz iz CRM-a, integracija s questflow.pro i zasebna administratorska kartica. | **Potpuni AI paket: kartice kupaca s automatskim prepoznavanjem, autorizacija putem Telegrama, personalizirani promptovi, Google kalendar, pametno označavanje potreba, izvoz u CRM, integracija s questflow.pro i zasebna administratorska kartica.** | Use 'promptovi' for consistency. Also, 'izvoz iz CRM-a' should be 'izvoz u CRM'. |
| `billingPage.topupDescription` | 0,17 € po minuti. Od 60 minuta do 10 sati. Kredit odmah nakon uplate. | **0,17 € po minuti. Od 60 minuta do 10 sati. Dodaju se odmah nakon uplate.** | More natural phrasing for 'credited immediately after payment'. |
