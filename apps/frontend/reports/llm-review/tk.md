# LLM Review: Turkmen (tk)

**Model:** gemini-2.5-flash  
**Took:** 154.6s  
**Fixes proposed:** 45 (valid after placeholder-check: 45)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `balance.openPlans` | Tarifleri we balasy aç | **Tarifleri we balansy aç** | Incorrect accusative case for 'balans' (balance). |
| `partner.title` | Partner program | **Hyzmatdaşlyk maksatnamasy** | Translated brand name 'Partner program' to English instead of Turkmen. |
| `partner.subtitle` | Share your link and earn | **Baglanyşygyňyzy paýlaşyň we gazanyň** | Translated marketing copy to English instead of Turkmen. |
| `partner.yourLink` | Your link | **Siziň baglanyşygyňyz** | Translated UI label to English instead of Turkmen. |
| `partner.copy` | Copy | **Göçürmek** | Translated UI label to English instead of Turkmen. |
| `partner.copied` | ✓ Link copied | **✓ Baglanyşyk göçürildi** | Translated UI label to English instead of Turkmen. |
| `partner.stats.clicks` | Clicks | **Basmalar** | Translated UI label to English instead of Turkmen. |
| `partner.stats.registrations` | Sign-ups | **Hasaba alyşlar** | Translated UI label to English instead of Turkmen. |
| `partner.stats.paid` | Payments | **Tölegler** | Translated UI label to English instead of Turkmen. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} adam · {{minutes}} min** | Translated UI label to English instead of Turkmen. |
| `partner.terms` | Program terms | **Maksatnamanyň şertleri** | Translated UI label to English instead of Turkmen. |
| `partner.contact` | Contact us | **Biz bilen habarlaşyň** | Translated UI label to English instead of Turkmen. |
| `partner.termsModalTitle` | Partner program terms | **Hyzmatdaşlyk maksatnamasynyň şertleri** | Translated UI label to English instead of Turkmen. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Maksatnamanyň şertleri heniz kesgitlenmedi. SuperAdmin bilen habarlaşyň.** | Translated UI message to English instead of Turkmen. |
| `partner.loadError` | Failed to load partner data | **Hyzmatdaşlyk maglumatlaryny ýüklemek başartmady** | Translated UI message to English instead of Turkmen. |
| `enterprise.common.pasteApiKey` | API açaryny giriziň | **API açaryny ýelmeşdiriň** | Incorrect word sense: 'giriziň' (enter) instead of 'ýelmeşdiriň' (paste). |
| `enterprise.apiKey.pastePlaceholder` | API açaryny giriziň | **API açaryny ýelmeşdiriň** | Incorrect word sense: 'giriziň' (enter) instead of 'ýelmeşdiriň' (paste). |
| `enterprise.gemini.leadPrefix` | Şahsy açar | **AI Studio-dan şahsy açar** | Missing 'from AI Studio' part of the sentence. |
| `enterprise.gemini.leadSuffix` | Hasabyňyzdaky ähli Gemini jaňlary üçin global jaňlaryň ýerine ulanylýar. | **Hasabyňyzdaky ähli Gemini jaňlary üçin global açaryň ýerine ulanylýar.** | Incorrect word: 'jaňlaryň' (calls) instead of 'açaryň' (key). |
| `enterprise.gemini.telegram.lead` | @BotFather bilen bot dörediň we onuň belgisini goýuň. Bu bota /start bilen habar iberen islendik adam bildirişleri alar: täze müşderiler, tegler, integrasiýa ýalňyşlyklary. Birnäçe işgäri ýazyp ýa-da boty topara ýa-da kanala goşup bilersiňiz — bildirişler hemmelere awtomatiki usulda iberiler. | **@BotFather bilen bot dörediň we onuň tokenini ýelmeşdiriň. Bu bota /start bilen habar iberen islendik adam bildirişleri alar: täze müşderiler, tegler, integrasiýa ýalňyşlyklary. Birnäçe işgäri ýazyp ýa-da boty topara ýa-da kanala goşup bilersiňiz — bildirişler hemmelere awtomatiki usulda iberiler.** | Incorrect word sense: 'belgisini goýuň' (put its mark) instead of 'tokenini ýelmeşdiriň' (paste its token). |
| `enterprise.gemini.telegram.leadCreatePart1` | Bot dörediň | **@BotFather-da bot dörediň** | Missing 'at @BotFather' part of the sentence. |
| `enterprise.gemini.telegram.leadCreatePart2` | we onuň nyşanyny ýelmeşdiriň. | **we onuň tokenini ýelmeşdiriň.** | Incorrect word: 'nyşanyny' (mark/sign) instead of 'tokenini' (token). |
| `enterprise.gemini.telegram.errEnterToken` | Bot tokenini goýuň | **Bot tokenini ýelmeşdiriň** | Incorrect word sense: 'goýuň' (put) instead of 'ýelmeşdiriň' (paste). |
| `enterprise.gemini.telegram.lastBroadcast` | Soňky poçta: {{total}}-den {{sent}} gezek iberildi | **Soňky poçta: {{total}}-den {{sent}} iberildi** | Redundant word 'gezek' (times). |
| `enterprise.prompt.headerLeadPart2` | - çatda habaryň üstüne basyp, ses saýlanyňyzda | **- çatda habaryň üstüne basyp, äheň saýlanyňyzda** | Incorrect word: 'ses' (sound/voice) instead of 'äheň' (tone). |
| `enterprise.prompt.contextLeadPart1` | Wideo otag söhbetdeşliginde habaryň üstüne basyp, ses saýlanyňyzda ulanylýar | **Wideo otag söhbetdeşliginde habaryň üstüne basyp, äheň saýlanyňyzda ulanylýar** | Incorrect word: 'ses' (sound/voice) instead of 'äheň' (tone). |
| `enterprise.prompt.presetsLeadPart1` | "Korporativ otag" söhbetdeşliginde islendik habary belläp, emeli intellektden ony saýlanan ton bilen düşündirmegini sorap bilersiňiz. Düwme. | **"Korporatiw otag" söhbetdeşliginde islendik habary belläp, emeli intellektden ony saýlanan äheň bilen düşündirmegini sorap bilersiňiz. Düwme.** | Incorrect word: 'ton' (loanword) instead of 'äheň' (tone). |
| `enterprise.questFlow.keysLead` | Her açar zynjyryň Quest Flow HTTP blokyna goşýan syryňyzdyr. VibeVox ony hasabyňyzy kesgitlemek üçin ulanýar. Dürli zynjyrlar üçin birnäçe açar döredip bilersiňiz. | **Her açar zynjyryň Quest Flow HTTP blokyna ýelmeşdirýän syryňyzdyr. VibeVox ony hasabyňyzy kesgitlemek üçin ulanýar. Dürli zynjyrlar üçin birnäçe açar döredip bilersiňiz.** | Incorrect word sense: 'goşýan' (adding) instead of 'ýelmeşdirýän' (pasting). |
| `enterprise.questFlow.errDelete` | Delete error | **Pozmakda ýalňyşlyk** | Translated UI message to English instead of Turkmen. |
| `enterprise.questFlow.deleteTitle` | Delete | **Poz** | Translated UI label to English instead of Turkmen. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Açary pozmalymy?** | Translated UI label to English instead of Turkmen. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Açar hemişelik pozular. Quest Flow onuň arkaly işlemegini bes eder — täze açar döretmeli we ony zynjyrda çalyşmaly bolarsyňyz.** | Translated UI message to English instead of Turkmen. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Poz** | Translated UI label to English instead of Turkmen. |
| `enterprise.questFlow.successFileUploaded` | "{{filename}}" faýly ýüklendi ({{kbLength}} simwollar). | **"{{filename}}" faýly ýüklendi ({{kbLength}} simwol).** | Incorrect plural form for 'simwol' (character) in abbreviation. |
| `enterprise.chatwoot.tokenLabel` | Agent API nyşany | **Agent API tokeni** | Incorrect word: 'nyşany' (mark/sign) instead of 'tokeni' (token). |
| `enterprise.chatwoot.tokenPlaceholder` | Agent giriş nyşany | **Agent giriş tokeni** | Incorrect word: 'nyşany' (mark/sign) instead of 'tokeni' (token). |
| `insights.sentiment` | Duýgy | **Äheň** | Incorrect word: 'Duýgy' (feeling/emotion) instead of 'Äheň' (tone/sentiment). |
| `insights.analyzedReplies_one` | {{count}} nusga seljerildi | **{{count}} jogap seljerildi** | Incorrect word: 'nusga' (copy/sample) instead of 'jogap' (reply). |
| `insights.analyzedReplies_few` | {{count}} nusgalary seljerildi | **{{count}} jogap seljerildi** | Incorrect word: 'nusgalary' (copies/samples) instead of 'jogap' (reply). |
| `insights.analyzedReplies_many` | {{count}} nusgalary seljerildi | **{{count}} jogap seljerildi** | Incorrect word: 'nusgalary' (copies/samples) instead of 'jogap' (reply). |
| `insights.analyzedReplies_other` | {{count}} nusgalary seljerildi | **{{count}} jogap seljerildi** | Incorrect word: 'nusgalary' (copies/samples) instead of 'jogap' (reply). |
| `postCallInsights.analyzing` | Geliň, söhbetdeşligi seljereliň... | **Söhbetdeşlik seljerilýär...** | Informal phrasing 'Geliň' (Let's) and active voice. Changed to more neutral passive. |
| `postCallInsights.metricSentiment` | Duýgy | **Äheň** | Incorrect word: 'Duýgy' (feeling/emotion) instead of 'Äheň' (tone/sentiment). |
| `billingPage.topupCarried` | Yza süýşürildi | **Geçirildi** | Incorrect word sense: 'Yza süýşürildi' (shifted back) instead of 'Geçirildi' (carried over). |
| `auth.common.googleSignIn` | Google bilen hasaba giriň | **Google bilen giriň** | Incorrect word sense: 'hasaba giriň' (sign up/register) instead of 'giriň' (log in). |
