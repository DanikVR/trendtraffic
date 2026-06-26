# LLM Review: Afrikaans (af)

**Model:** gemini-2.5-flash  
**Took:** 158.7s  
**Fixes proposed:** 83 (valid after placeholder-check: 82)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Ondernemingsinstellings | **Enterprise-instellings** | Preserve 'Enterprise' as a brand/tier name. |
| `rooms.subtitle` | Jou aktiewe gelyktydige tolksessies | **Jou aktiewe gelyktydige vertaalsessies** | 'tolksessies' refers to human interpreters, 'vertaalsessies' for translation. |
| `rooms.tabs.questFlow` | Soektogvloei | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `rooms.actions.open` | Aanmeld | **Gaan in** | 'Aanmeld' means 'Log in'; 'Gaan in' means 'Enter' (a room). |
| `common.edit` | Verandering | **Verander** | 'Verandering' is a noun (change); 'Verander' is the verb (to change). |
| `tier.trial` | Verhoor | **Proef** | 'Verhoor' means 'court trial'; 'Proef' means 'trial period' in this context. |
| `tier.enterprise` | Onderneming | **Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `moreSheet.sip.sub` | Opstel van koffers | **Opstel van trunks** | 'koffers' means 'suitcases'; 'trunks' is the correct technical term. |
| `moreSheet.enterprise.label` | Ondernemingsinstellings | **Enterprise-instellings** | Preserve 'Enterprise' as a brand/tier name. |
| `moreSheet.enterprise.sub` | Tweeling-sleutel, Quest Flow, etikette, CRM | **Gemini-sleutel, Quest Flow, etikette, CRM** | Preserve 'Gemini' and 'Quest Flow' as brand names. |
| `call.geminiLive` | Tweeling Regstreeks | **Gemini Live** | Preserve 'Gemini' as a brand name. |
| `call.toPlayground` | 🎯 Na die stortingsterrein | **🎯 Na die oefenveld** | 'stortingsterrein' means 'dumping ground'; 'oefenveld' means 'training ground'. |
| `call.more` | Daarbenewens | **Meer** | 'Daarbenewens' means 'In addition'; 'Meer' means 'More' (options). |
| `call.validating` | Toets VibeVox se veilige verbinding… | **Kontroleer VibeVox se veilige verbinding…** | 'Toets' means 'Test'; 'Kontroleer' means 'Checking' or 'Validating'. |
| `coach.help` | Hulp antwoord | **Help om te antwoord** | Improved grammar and phrasing. |
| `coach.pin` | Speld dit vas | **Speld vas** | Shorten for button label length. |
| `roomActions.translation.disableSub` | Notules sal nie meer afgeskryf word nie | **Minute sal nie meer afgeskryf word nie** | 'Notules' means 'meeting minutes'; 'Minute' refers to time units. |
| `settings.themeDarkSub` | Afgrond Aurora (Donker) | **Abyss Aurora (Donker)** | Preserve 'Abyss Aurora' as a brand name. |
| `settings.themeLightSub` | Wolk Aurora (Lig) | **Cloud Aurora (Lig)** | Preserve 'Cloud Aurora' as a brand name. |
| `partner.subtitle` | Share your link and earn | **Deel jou skakel en verdien** | Translate English marketing copy. |
| `partner.yourLink` | Your link | **Jou skakel** | Translate English UI text. |
| `partner.copy` | Copy | **Kopieer** | Translate English UI text. |
| `partner.copied` | ✓ Link copied | **✓ Skakel gekopieer** | Translate English UI text. |
| `partner.stats.clicks` | Clicks | **Klikke** | Translate English UI text. |
| `partner.stats.registrations` | Sign-ups | **Registrasies** | Translate English UI text. |
| `partner.stats.paid` | Payments | **Betalings** | Translate English UI text. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} gebruikers · {{minutes}} min** | Translate English UI text. |
| `partner.terms` | Program terms | **Programvoorwaardes** | Translate English UI text. |
| `partner.contact` | Contact us | **Kontak ons** | Translate English UI text. |
| `partner.termsModalTitle` | Partner program terms | **Programvoorwaardes vir vennote** | Translate English UI text. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Programvoorwaardes is nog nie gestel nie. Kontak asseblief SuperAdmin.** | Translate English UI text. |
| `partner.loadError` | Failed to load partner data | **Kon nie vennootdata laai nie** | Translate English UI text. |
| `sip.subtitle` | Stel trunks op vir inkomende en uitgaande oproepe | **Stel SIP-trunks op vir inkomende en uitgaande oproepe** | Add 'SIP' for clarity and preserve 'trunks' as a technical term. |
| `sip.editTrunk` | Verander bagasiekasinstellings | **Verander trunk-instellings** | 'bagasiekas' means 'luggage compartment'; 'trunk' is the correct technical term. |
| `sip.createTrunk` | Skep 'n kofferbak | **Skep 'n trunk** | 'kofferbak' means 'car boot'; 'trunk' is the correct technical term. |
| `sip.incoming.pausedHint` | Aktiveer ontvangs om VibeVox inkomende oproepe te begin aanstuur. | **Aktiveer ontvangs om VibeVox inkomende oproepe te begin vertaal.** | 'aanstuur' means 'forward'; 'vertaal' means 'translate'. |
| `sip.toasts.saveFailed` | Kon nie die kofferbak stoor nie | **Kon nie die trunk stoor nie** | 'kofferbak' means 'car boot'; 'trunk' is the correct technical term. |
| `sip.toasts.deleted` | Die kofferbak is uitgevee. | **Die trunk is uitgevee.** | 'kofferbak' means 'car boot'; 'trunk' is the correct technical term. |
| `sip.toasts.deleteFailed` | Kon nie stam verwyder nie | **Kon nie trunk verwyder nie** | 'stam' means 'stem' or 'tribe'; 'trunk' is the correct technical term. |
| `sip.danger.deleteTrunk` | Vee stam uit | **Vee trunk uit** | 'stam' means 'stem' or 'tribe'; 'trunk' is the correct technical term. |
| `enterprise.page.title` | Ondernemingsinstellings | **Enterprise-instellings** | Preserve 'Enterprise' as a brand/tier name. |
| `enterprise.page.upsellTitle` | Hierdie afdeling is beskikbaar op die Enterprise-plan. | **Hierdie afdeling is beskikbaar op die Enterprise-plan** | Minor grammatical adjustment, 'die' is redundant here. |
| `enterprise.common.pasteApiKey` | Voer die API-sleutel in | **Plak die API-sleutel** | 'Voer in' means 'Enter'; 'Plak' means 'Paste'. |
| `enterprise.apiKey.pastePlaceholder` | Voer die API-sleutel in | **Plak die API-sleutel** | 'Voer in' means 'Enter'; 'Plak' means 'Paste'. |
| `enterprise.gemini.aiStudioLink` | KI-ateljee | **AI Studio** | Preserve 'AI Studio' as a brand name. |
| `enterprise.gemini.telegram.leadStartCmd` | /begin | **/start** | Preserve Telegram command exactly as '/start'. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Bot @{{username}} is gestoor. Enigiemand wat dit /start SMS, sal kennisgewings ontvang. | **✓ Bot @{{username}} is gestoor. Enigiemand wat dit /start stuur, sal kennisgewings ontvang.** | Preserve Telegram command exactly as '/start' and improve phrasing. |
| `enterprise.gemini.telegram.errEnterToken` | Voeg die bot-token in | **Plak die bot-token** | 'Voeg in' means 'Insert/Enter'; 'Plak' means 'Paste'. |
| `enterprise.gemini.telegram.testingLabel` | Helm… | **Stuur tans…** | 'Helm' means 'Helmet'; 'Stuur tans' means 'Sending...' |
| `enterprise.prompt.headerLeadBold2` | "Volgens u versoek" | **"Volgens jou prompt"** | 'versoek' means 'request'; 'prompt' is the correct term here. |
| `enterprise.prompt.contextLeadBold` | "Volgens u versoek" | **"Volgens jou prompt"** | 'versoek' means 'request'; 'prompt' is the correct term here. |
| `enterprise.prompt.successPromptSaved` | Aanwysing gestoor. | **Prompt gestoor.** | 'Aanwysing' means 'instruction'; 'Prompt' is the correct term here. |
| `enterprise.prompt.presetsLeadPart1` | In die Enterprise Room-klets kan jy enige boodskap uitlig en die KI vra om dit in die gekose toon te verduidelik. Knoppie | **In die Enterprise-kamerklets kan jy enige boodskap uitlig en die KI vra om dit in die gekose toon te verduidelik. Knoppie** | Preserve 'Enterprise' as a brand/tier name and improve compound noun. |
| `enterprise.prompt.presetsLeadBold` | "Volgens u versoek" | **"Volgens jou prompt"** | 'versoek' means 'request'; 'prompt' is the correct term here. |
| `enterprise.prompt.presetsLeadPart2` | gebruik jou aanwysing uit die veld hierbo. | **gebruik jou prompt uit die veld hierbo.** | 'aanwysing' means 'instruction'; 'prompt' is the correct term here. |
| `enterprise.questFlow.heading` | Soektogvloei | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.errDelete` | Delete error | **Vee fout uit** | Translate English UI text. |
| `enterprise.questFlow.deleteTitle` | Delete | **Vee uit** | Translate English UI text. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Vee sleutel uit?** | Translate English UI text. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Die sleutel sal permanent uitgevee word. Quest Flow sal nie meer daardeur werk nie — jy sal 'n nuwe sleutel moet skep en dit in die vloei vervang.** | Translate English UI text. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Vee uit** | Translate English UI text. |
| `enterprise.questFlow.promptHeading` | Vra vir Telegram-gesprekke | **Prompt vir Telegram-gesprekke** | 'Vra' means 'Ask'; 'Prompt' is the correct term here. |
| `enterprise.questFlow.promptLead3` | - dit sal gekombineer word met die basiese aanwysings en kennisbasis. | **- dit sal gekombineer word met die basiese prompt en kennisbasis.** | 'aanwysings' means 'instructions'; 'prompt' is the correct term here. |
| `enterprise.questFlow.successPromptSaved` | Soektogvloei-aanwysing gestoor. | **Quest Flow prompt gestoor.** | Preserve 'Quest Flow' as a brand name and use 'prompt'. |
| `chat.enterpriseOnlyHint` | Kletskamers is 'n Enterprise-funksie. Gradeer jou plan op in die "Pryse"-afdeling. | **Kletskamers is 'n Enterprise-funksie. Gradeer jou plan op in die "Tariewe"-afdeling.** | Use 'Tariewe' for consistency with other billing/plan sections. |
| `insights.summary` | CV | **Opsomming** | 'CV' means 'resume' (for a job); 'Opsomming' means 'Summary'. |
| `insights.sentiment` | Sleutel | **Tonaliteit** | 'Sleutel' means 'Key'; 'Tonaliteit' means 'Tonality' or 'Sentiment'. |
| `insights.leadScore` | Leidtelling | **Lead Score** | Preserve 'Lead Score' as a sales funnel term. |
| `postCallInsights.subtitle` | Onderneming · insigte na oproep | **Enterprise · insigte na oproep** | Preserve 'Enterprise' as a brand/tier name. |
| `postCallInsights.analyzing` | Kom ons analiseer die gesprek... | **Analiseer gesprek…** | 'Kom ons analiseer' means 'Let's analyze'; 'Analiseer' is 'Analyzing'. |
| `postCallInsights.metricLeadScore` | Leidtelling | **Lead Score** | Preserve 'Lead Score' as a sales funnel term. |
| `postCallInsights.summary` | CV | **Opsomming** | 'CV' means 'resume' (for a job); 'Opsomming' means 'Summary'. |
| `billingPage.tierLabel` | Koers | **Plan** | 'Koers' means 'Rate'; 'Plan' is more appropriate for a subscription tier. |
| `paywall.subscribe` | Ontwerp | **Teken in** | 'Ontwerp' means 'Design'; 'Teken in' means 'Subscribe'. |
| `billingPage.resume` | CV | **Hervat** | 'CV' means 'resume' (for a job); 'Hervat' means 'Resume' (continue). |
| `billingPage.tierEnterpriseName` | Onderneming | **Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `billingPage.featurePersonalPrompts` | Persoonlike KI-aanwysings | **Persoonlike KI-prompts** | 'aanwysings' means 'instructions'; 'prompts' is the correct term here. |
| `billingPage.ctaSubscribePlus` | Kry Plus | **Teken in op Plus** | 'Kry' means 'Get'; 'Teken in op' means 'Subscribe to'. |
| `billingPage.ctaSubscribeStandard` | Bestel Standaard | **Teken in op Standard** | 'Bestel' means 'Order'; 'Teken in op' means 'Subscribe to'. |
| `billingPage.faqA3` | gepersonaliseerde aanwysings | **gepersonaliseerde prompts** | 'aanwysings' means 'instructions'; 'prompts' is the correct term here. |
| `billingPage.renewsOn` | uitbreiding {{date}} | **hernuwing {{date}}** | 'uitbreiding' means 'extension'; 'hernuwing' means 'renewal'. |
| `billingPage.languagesNoResults` | Die taal is nie in die lys van ondersteunde taal gevind nie. | **Die taal is nie in die lys van ondersteunde tale gevind nie.** | Grammar: 'tale' (plural) is correct for 'supported languages'. |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
