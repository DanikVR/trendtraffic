# LLM Review: Dutch (nl)

**Model:** gemini-2.5-flash  
**Took:** 135.9s  
**Fixes proposed:** 50 (valid after placeholder-check: 50)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Bedrijfsinstellingen | **Enterprise-instellingen** | Brand/tier name 'Enterprise' should be preserved. |
| `rooms.actions.copyLink` | Kopieer link | **Link kopiëren** | More natural and concise phrasing for a button label. |
| `tier.trial` | Proef | **Proefperiode** | 'Proef' is ambiguous; 'Proefperiode' is clearer for subscription context. |
| `tier.enterprise` | Onderneming | **Enterprise** | Brand/tier name 'Enterprise' should be preserved. |
| `moreSheet.enterprise.label` | Bedrijfsinstellingen | **Enterprise-instellingen** | Brand/tier name 'Enterprise' should be preserved. |
| `settings.themeLightSub` | Wolken Aurora (Licht) | **Cloud Aurora (Licht)** | Brand name 'Cloud Aurora' should be preserved. |
| `partner.title` | Partner program | **Partnerprogramma** | English phrase, should be translated to Dutch. |
| `partner.subtitle` | Share your link and earn | **Deel uw link en verdien** | English phrase, should be translated to Dutch. |
| `partner.yourLink` | Your link | **Uw link** | English phrase, should be translated to Dutch. |
| `partner.copy` | Copy | **Kopiëren** | English phrase, should be translated to Dutch. |
| `partner.copied` | ✓ Link copied | **✓ Link gekopieerd** | English phrase, should be translated to Dutch. |
| `partner.stats.clicks` | Clicks | **Kliks** | English phrase, should be translated to Dutch. |
| `partner.stats.registrations` | Sign-ups | **Registraties** | English phrase, should be translated to Dutch. |
| `partner.stats.paid` | Payments | **Betalingen** | English phrase, should be translated to Dutch. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} gebruikers · {{minutes}} min** | English phrase, should be translated to Dutch. |
| `partner.terms` | Program terms | **Programmavoorwaarden** | English phrase, should be translated to Dutch. |
| `partner.contact` | Contact us | **Contact opnemen** | English phrase, should be translated to Dutch. |
| `partner.termsModalTitle` | Partner program terms | **Voorwaarden partnerprogramma** | English phrase, should be translated to Dutch. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Programmavoorwaarden zijn nog niet ingesteld. Neem contact op met de SuperAdmin.** | English phrase, should be translated to Dutch. |
| `partner.loadError` | Failed to load partner data | **Partnergegevens laden mislukt** | English phrase, should be translated to Dutch. |
| `call.expandPeer` | Vergroot gesprekspartner | **Gesprekspartner uitvouwen** | Grammatically incorrect; 'Vergroot' is a verb. 'Uitvouwen' is more common for UI. |
| `roomActions.copyLink` | Kopieer de link naar de kamer | **Link naar kamer kopiëren** | More natural and concise phrasing for a button label. |
| `roomActions.delete` | Verwijder kamer | **Kamer verwijderen** | More natural phrasing. |
| `sip.connected` | De SIP-trunk wordt opgeslagen en gesynchroniseerd met LiveKit. | **De SIP-trunk is opgeslagen en gesynchroniseerd met LiveKit.** | Grammatical tense error. 'Wordt opgeslagen' implies ongoing action, 'is opgeslagen' implies completed action. |
| `sip.danger.deleteTrunk` | Verwijder trunk | **Trunk verwijderen** | More natural phrasing. |
| `sip.danger.deleteInbound` | Verwijder het SIP-adres voor inkomende oproepen. | **SIP-adres voor inkomende oproepen verwijderen** | More natural phrasing. |
| `enterprise.page.title` | Bedrijfsinstellingen | **Enterprise-instellingen** | Brand/tier name 'Enterprise' should be preserved. |
| `enterprise.gemini.telegram.tokenLabel` | Telegram bot token | **Telegram bot-token** | Compound noun in Dutch requires a hyphen. |
| `enterprise.gemini.telegram.errEnterToken` | Plak het bottoken | **Plak het bot-token** | Compound noun in Dutch requires a hyphen. |
| `enterprise.prompt.savePrompt` | Bewaar prompt | **Prompt opslaan** | More natural phrasing. |
| `enterprise.prompt.savePromptLabel` | Opslaan prompt | **Prompt opslaan** | More natural phrasing. |
| `enterprise.prompt.kbReplaceFile` | Vervang bestand | **Bestand vervangen** | More natural phrasing. |
| `enterprise.prompt.successFileUploaded` | Bestand "{{filename}}" ({{format}}) geladen - {{kbLength}} tekens opgeslagen. | **Bestand "{{filename}}" ({{format}}) geüpload - {{kbLength}} tekens opgeslagen.** | 'Geüpload' is more precise for file uploads than 'geladen'. |
| `enterprise.questFlow.savePrompt` | Bewaar prompt | **Prompt opslaan** | More natural phrasing. |
| `enterprise.questFlow.keyLabelPlaceholder` | Label (optioneel), bijvoorbeeld: "Prod bot clinic" | **Label (optioneel), bijvoorbeeld: "Prod bot kliniek"** | Example text should be translated to Dutch. |
| `enterprise.questFlow.errDelete` | Delete error | **Verwijderfout** | English phrase, should be translated to Dutch. |
| `enterprise.questFlow.deleteTitle` | Delete | **Verwijderen** | English phrase, should be translated to Dutch. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Sleutel verwijderen?** | English phrase, should be translated to Dutch. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **De sleutel wordt permanent verwijderd. Quest Flow zal er niet meer mee werken — u moet een nieuwe sleutel aanmaken en deze in de workflow vervangen.** | English phrase, should be translated to Dutch. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Verwijderen** | English phrase, should be translated to Dutch. |
| `enterprise.questFlow.kbLead3` | Uit de sectie "Prompts"—voor videotranscriptie. Limiet: 50 MB bestand / 500.000 tekens in de database. | **Apart van de sectie "Prompts" (die voor videotranscriptie is). Limiet: 50 MB bestand / 500.000 tekens in de database.** | Awkward phrasing, 'apart van' is more natural. |
| `enterprise.questFlow.kbReplaceFile` | Vervang bestand | **Bestand vervangen** | More natural phrasing. |
| `enterprise.questFlow.successFileUploaded` | Bestand "{{filename}}" geladen ({{kbLength}} tekens). | **Bestand "{{filename}}" geüpload ({{kbLength}} tekens).** | 'Geüpload' is more precise for file uploads than 'geladen'. |
| `enterprise.chatwoot.tokenLabel` | Agent API-token | **Agent-API-token** | Compound noun in Dutch requires a hyphen. |
| `enterprise.chatwoot.tokenPlaceholder` | Agent-toegangstoken | **Agenttoegangstoken** | Compound noun in Dutch should be written as one word. |
| `postCallInsights.subtitle` | Zakelijk · inzichten na het gesprek | **Enterprise · inzichten na het gesprek** | Brand/tier name 'Enterprise' should be preserved. |
| `billingPage.tierEnterpriseName` | Onderneming | **Enterprise** | Brand/tier name 'Enterprise' should be preserved. |
| `billingPage.featureLearnHub` | AI Learning Hub — zijn eigen dialecten | **AI Learning Hub — eigen dialecten** | 'Zijn' is unnecessary and implies possession by the Hub, not user-defined dialects. |
| `lobby.copyLink` | Kopieer link | **Link kopiëren** | More natural and concise phrasing for a button label. |
| `billingPage.languagesCount_few` | {{count}} taal | **{{count}} talen** | Incorrect pluralization for 'few' (2, 3, 4) in Dutch. |
