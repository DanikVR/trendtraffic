# LLM Review: Lithuanian (lt)

**Model:** gemini-2.5-flash  
**Took:** 136.2s  
**Fixes proposed:** 33 (valid after placeholder-check: 32)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Įmonės nustatymai | **Enterprise nustatymai** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `tier.trial` | Trial | **Bandomasis** | 'Trial' in subscription context should be translated to local equivalent. |
| `coach.tones.joke` | Šmaikščiai | **Linksmai** | Source 'Шутка' (noun) translated as an adverb 'wittily'. 'Linksmai' is better for tone. |
| `moreSheet.enterprise.label` | Įmonės nustatymai | **Enterprise nustatymai** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `partner.title` | Partner program | **Partnerystės programa** | English phrase, should be translated to Lithuanian. |
| `partner.subtitle` | Share your link and earn | **Dalinkitės nuoroda ir uždirbkite** | English phrase, should be translated to Lithuanian. |
| `partner.yourLink` | Your link | **Jūsų nuoroda** | English phrase, should be translated to Lithuanian. |
| `partner.copy` | Copy | **Kopijuoti** | English phrase, should be translated to Lithuanian. |
| `partner.copied` | ✓ Link copied | **✓ Nuoroda nukopijuota** | English phrase, should be translated to Lithuanian. |
| `partner.stats.clicks` | Clicks | **Paspaudimai** | English phrase, should be translated to Lithuanian. |
| `partner.stats.registrations` | Sign-ups | **Registracijos** | English phrase, should be translated to Lithuanian. |
| `partner.stats.paid` | Payments | **Mokėjimai** | English phrase, should be translated to Lithuanian. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} vartotojų · {{minutes}} min** | English phrase, should be translated to Lithuanian. Placeholders preserved. |
| `partner.terms` | Program terms | **Programos sąlygos** | English phrase, should be translated to Lithuanian. |
| `partner.contact` | Contact us | **Susisiekite su mumis** | English phrase, should be translated to Lithuanian. |
| `partner.termsModalTitle` | Partner program terms | **Partnerystės programos sąlygos** | English phrase, should be translated to Lithuanian. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Programos sąlygos dar nenustatytos. Susisiekite su SuperAdmin.** | English phrase, should be translated to Lithuanian. |
| `partner.loadError` | Failed to load partner data | **Nepavyko įkelti partnerystės duomenų** | English phrase, should be translated to Lithuanian. |
| `enterprise.page.title` | Įmonės nustatymai | **Enterprise nustatymai** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `enterprise.page.upsellTitle` | Šis skyrius pasiekiamas įmonės plane. | **Šis skyrius pasiekiamas Enterprise plane.** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `enterprise.prompt.presetsLeadPart1` | „Enterprise Room“ pokalbyje galite paryškinti bet kurį pranešimą ir paprašyti dirbtinio intelekto jį paaiškinti pasirinktu tonu. Mygtukas | **Enterprise kambario pokalbyje galite paryškinti bet kurį pranešimą ir paprašyti AI paaiškinti jį pasirinktu tonu. Mygtukas** | Brand/tier name 'Enterprise' and 'AI' should be preserved. |
| `enterprise.questFlow.savePrompt` | Išsaugoti reklamą | **Išsaugoti raginimą** | 'Промпт' (prompt) translated incorrectly as 'advertisement'. |
| `enterprise.questFlow.errDelete` | Delete error | **Ištrynimo klaida** | English phrase, should be translated to Lithuanian. |
| `enterprise.questFlow.deleteTitle` | Delete | **Ištrinti** | English phrase, should be translated to Lithuanian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Ištrinti raktą?** | English phrase, should be translated to Lithuanian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Raktas bus ištrintas negrįžtamai. Quest Flow per jį nebeveiks – reikės sukurti naują raktą ir pakeisti jį grandinėje.** | English phrase, should be translated to Lithuanian. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Ištrinti** | English phrase, should be translated to Lithuanian. |
| `chat.enterpriseOnlyHint` | Pokalbių kambariai yra Enterprise funkcija. Atnaujinkite savo planą skiltyje „Kainodara“. | **Pokalbių kambariai – Enterprise funkcija. Atnaujinkite savo planą skiltyje „Tarifai“.** | Brand/tier name 'Enterprise' should be preserved. 'Kainodara' should be 'Tarifai' for consistency. |
| `lobby.andWord` | Ir | ** ir ** | Conjunction 'and' should be lowercase and have spaces around it. |
| `postCallInsights.subtitle` | Įmonės įžvalgos po skambučio | **Enterprise · įžvalgos po skambučio** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `postCallInsights.summary` | Gyvenimo aprašymas | **Santrauka** | 'Резюме' (summary) translated as 'CV/resume'. Should be 'Santrauka'. |
| `auth.register.agreementAnd` | Ir | ** ir ** | Conjunction 'and' should be lowercase and have spaces around it. |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
