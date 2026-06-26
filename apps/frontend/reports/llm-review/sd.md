# LLM Review: Sindhi (sd)

**Model:** gemini-2.5-flash  
**Took:** 179.2s  
**Fixes proposed:** 55 (valid after placeholder-check: 55)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.billing` | محصول | **ٽيرف** | Wrong word sense: 'محصول' means product, should be 'ٽيرف' for plans. |
| `rooms.subtitle` | توهان جا فعال هڪ ئي وقت ۾ تشريح جا سيشن | **توهان جا فعال هڪ ئي وقت ۾ ترجمي جا سيشن** | Wrong word sense: 'تشريح' means interpretation, should be 'ترجمي' for translation. |
| `rooms.live` | جيو | **Live** | Brand name 'Live' should be preserved, not translated. |
| `rooms.actions.open` | لاگ ان | **داخل ٿيو** | Wrong word sense: 'لاگ ان' means log in, should be 'داخل ٿيو' for enter. |
| `balance.openPlans` | کليل ٽيرف ۽ بيلنس | **کليل پلان ۽ بيلنس** | Wrong word sense: 'محصول' means product, should be 'پلان' for plans. |
| `balance.tariffs` | محصول | **ٽيرف** | Wrong word sense: 'محصول' means product, should be 'ٽيرف' for plans. |
| `tier.trial` | آزمائش | **مفت آزمائش** | Wrong word sense: 'آزمائش' is general trial, should be 'مفت آزمائش' for free trial. |
| `call.toPlayground` | 🎯 لينڊ فل ڏانهن | **🎯 تربيتي ميدان ڏانهن** | Wrong word sense: 'لينڊ فل' means landfill, should be 'تربيتي ميدان' for playground. |
| `coach.help` | مدد جو جواب | **جواب ڏيڻ ۾ مدد ڪريو** | Grammar: 'مدد جو جواب' is 'help of answer', should be 'جواب ڏيڻ ۾ مدد ڪريو'. |
| `sip.incoming.pausedHint` | VibeVox ايندڙ ڪالن کي فارورڊ ڪرڻ لاءِ رسيپشن کي چالو ڪريو. | **VibeVox ايندڙ ڪالن کي ترجمو ڪرڻ لاءِ رسيپشن کي چالو ڪريو.** | Wrong word sense: 'فارورڊ ڪرڻ' means forward, should be 'ترجمو ڪرڻ' for translate. |
| `sip.outbound.lead` | ويب انٽرفيس مان هڪ فون نمبر تي ڪال ڪريو ۽ VibeVox خودڪار طريقي سان توهان جي گفتگو کي حقيقي وقت ۾ منتقل ڪندو. | **ويب انٽرفيس مان هڪ فون نمبر تي ڪال ڪريو ۽ VibeVox خودڪار طريقي سان توهان جي گفتگو کي حقيقي وقت ۾ ترجمو ڪندو.** | Wrong word sense: 'منتقل ڪندو' means transfer, should be 'ترجمو ڪندو' for translate. |
| `sip.toasts.deleted` | ٿڙ کي ختم ڪيو ويو آهي. | **ٽرنڪ کي ختم ڪيو ويو آهي.** | Wrong word sense: 'ٿڙ' means tree trunk, should be 'ٽرنڪ' for SIP trunk. |
| `enterprise.page.upsellCta` | محصولن ڏانهن وڃو | **ٽيرفن ڏانهن وڃو** | Wrong word sense: 'محصولن' means products, should be 'ٽيرفن' for tariffs. |
| `partner.title` | Partner program | **پارٽنر پروگرام** | English string should be translated or transliterated. |
| `partner.subtitle` | Share your link and earn | **پنهنجي لنڪ شيئر ڪريو ۽ ڪمايو** | English string should be translated. |
| `partner.yourLink` | Your link | **توهان جي لنڪ** | English string should be translated. |
| `partner.copy` | Copy | **ڪاپي ڪريو** | English string should be translated. |
| `partner.copied` | ✓ Link copied | **✓ لنڪ ڪاپي ڪئي وئي** | English string should be translated. |
| `partner.stats.clicks` | Clicks | **ڪلڪون** | English string should be translated. |
| `partner.stats.registrations` | Sign-ups | **رجسٽريشن** | English string should be translated. |
| `partner.stats.paid` | Payments | **ادائيگيون** | English string should be translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} استعمال ڪندڙ · {{minutes}} منٽ** | English words 'users' and 'min' should be translated. |
| `partner.terms` | Program terms | **پروگرام جا شرط** | English string should be translated. |
| `partner.contact` | Contact us | **اسان سان رابطو ڪريو** | English string should be translated. |
| `partner.termsModalTitle` | Partner program terms | **پارٽنر پروگرام جا شرط** | English string should be translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **پروگرام جا شرط اڃا مقرر نه ڪيا ويا آهن. مهرباني ڪري SuperAdmin سان رابطو ڪريو.** | English string should be translated. |
| `partner.loadError` | Failed to load partner data | **پارٽنر ڊيٽا لوڊ ڪرڻ ۾ ناڪام ٿيو** | English string should be translated. |
| `enterprise.gemini.telegram.successUnlinked` | بوٽ کليل آهي. | **بوٽ ڳنڍيل ناهي.** | Wrong word sense: 'کليل' means open, should be 'ڳنڍيل ناهي' for unlinked. |
| `enterprise.gemini.telegram.testingLabel` | هيلمٽ… | **موڪلي رهيا آهيون…** | Wrong word sense: 'هيلمٽ' means helmet, should be 'موڪلي رهيا آهيون' for sending. |
| `enterprise.prompt.headerLeadBold2` | "توهان جي درخواست مطابق" | **"توهان جي پرامپٽ مطابق"** | Literal translation of 'request', should be 'پرامپٽ' for 'prompt'. |
| `enterprise.prompt.contextLeadBold` | "توهان جي درخواست مطابق" | **"توهان جي پرامپٽ مطابق"** | Literal translation of 'request', should be 'پرامپٽ' for 'prompt'. |
| `enterprise.prompt.promptPlaceholder` | توهان جو پروموشن... | **توهان جو پرامپٽ...** | Wrong word sense: 'پروموشن' means promotion, should be 'پرامپٽ' for prompt. |
| `enterprise.prompt.presetsLeadBold` | "توهان جي درخواست مطابق" | **"توهان جي پرامپٽ مطابق"** | Literal translation of 'request', should be 'پرامپٽ' for 'prompt'. |
| `enterprise.questFlow.errDelete` | Delete error | **ختم ڪرڻ ۾ غلطي** | English string should be translated. |
| `enterprise.questFlow.deleteTitle` | Delete | **ختم ڪريو** | English string should be translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **چاٻي ختم ڪريو؟** | English string should be translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **چاٻي مستقل طور تي ختم ڪئي ويندي. ڪوسٽ فلو ان ذريعي ڪم ڪرڻ بند ڪري ڇڏيندو — توهان کي هڪ نئين چاٻي ٺاهڻ ۽ ان کي فلو ۾ تبديل ڪرڻ جي ضرورت پوندي.** | English string should be translated. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ختم ڪريو** | English string should be translated. |
| `enterprise.questFlow.promptPlaceholder` | توهان جو پروموشن... | **توهان جو پرامپٽ...** | Wrong word sense: 'پروموشن' means promotion, should be 'پرامپٽ' for prompt. |
| `insights.summary` | شروع ڪريو | **خلاصو** | Wrong word sense: 'شروع ڪريو' means start, should be 'خلاصو' for summary. |
| `insights.sentiment` | چاٻي | **لهجو** | Wrong word sense: 'چاٻي' means key, should be 'لهجو' for sentiment/tonality. |
| `insights.leadValues.cold` | ڀڌ | **سرد** | Wrong word sense: 'ڀڌ' refers to temperature, 'سرد' is better for 'cold lead'. |
| `postCallInsights.analyzing` | اچو ته ڳالهه ٻولهه جو تجزيو ڪريون... | **ڳالهه ٻولهه جو تجزيو ڪري رهيا آهيون...** | Grammar: 'اچو ته' means 'let's', should be 'ڳالهه ٻولهه جو تجزيو ڪري رهيا آهيون' for 'analyzing'. |
| `postCallInsights.metricSentiment` | موڊ | **لهجو** | Wrong word sense: 'موڊ' means mood, should be 'لهجو' for sentiment. |
| `postCallInsights.summary` | شروع ڪريو | **خلاصو** | Wrong word sense: 'شروع ڪريو' means start, should be 'خلاصو' for summary. |
| `billingPage.tierLabel` | شرح | **ٽيرف** | Wrong word sense: 'شرح' means rate, should be 'ٽيرف' for tariff/plan. |
| `paywall.subscribe` | ڊيزائن | **سبسڪرائب ڪريو** | Wrong word sense: 'ڊيزائن' means design, should be 'سبسڪرائب ڪريو' for subscribe. |
| `billingPage.topupCarried` | ملتوي ڪيو ويو | **منتقل ٿيل** | Wrong word sense: 'ملتوي ڪيو ويو' means postponed, should be 'منتقل ٿيل' for carried over. |
| `billingPage.ctaSubscribeStandard` | آرڊر جو معيار | **اسٽينڊرڊ حاصل ڪريو** | Literal translation, should be 'اسٽينڊرڊ حاصل ڪريو' for 'get Standard'. |
| `billingPage.languagesCount_few` | {{count}} ٻولي | **{{count}} ٻوليون** | Incorrect plural form for 'few' languages. |
| `billingPage.faqHeading` | وچان وچان سوال ڪرڻ | **اڪثر پڇيا ويندڙ سوال** | Wrong word sense: 'وچان وچان سوال ڪرڻ' means asking frequently, should be 'اڪثر پڇيا ويندڙ سوال' for FAQ. |
| `billingPage.presetHours` | __ وي وي 0__ ڪلاڪ | **{{count}} ڪلاڪ** | Placeholder '{{count}}' is corrupted. |
| `billingPage.presetMinutes` | __ وي وي 0__ ميٽر | **{{count}} منٽ** | Placeholder '{{count}}' is corrupted and 'ميٽر' is wrong unit. |
| `billingPage.renewsOn` | ايڪسٽينشن {{date}} | **تجديد {{date}}** | Wrong word sense: 'ايڪسٽينشن' means extension, should be 'تجديد' for renewal. |
| `auth.common.emailPlaceholder` | you@example.com تي ڪلڪ ڪريو | **you@example.com** | Extraneous phrase 'تي ڪلڪ ڪريو' (click on) in placeholder. |
