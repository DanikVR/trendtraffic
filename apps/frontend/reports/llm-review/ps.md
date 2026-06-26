# LLM Review: Pashto (ps)

**Model:** gemini-2.5-flash  
**Took:** 226.6s  
**Fixes proposed:** 122 (valid after placeholder-check: 122)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | د لټون جریان | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `rooms.tabs.vibeAdd` | وایب اضافه کړئ | **VibeAdd** | Brand name 'VibeAdd' should be preserved, not translated. |
| `balance.minutes` | {{count}} دقیقې | **{{count}} min** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `balance.minutes_one` | {{count}} دقیقه | **{{count}} min** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `balance.minutes_few` | {{count}} دقیقې | **{{count}} min** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `balance.minutes_many` | {{count}} دقیقې | **{{count}} min** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `balance.minutesShort` | دقیقې | **min** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `tier.trial` | محاکمه | **وړیا ازمایښت** | Wrong word sense: 'Trial' means free trial, not court trial. |
| `tier.plus` | جمع | **Plus** | Brand name 'Plus' should be preserved, not translated. |
| `tier.standard` | معیاري | **Standard** | Brand name 'Standard' should be preserved, not translated. |
| `tier.standardYearly` | کلنی | **Yearly** | Brand name 'Yearly' should be preserved, not translated. |
| `moreSheet.enterprise.sub` | د جیمني کیلي، د لټون جریان، ټګونه، CRM | **Gemini کیلي، Quest Flow، ټګونه، CRM** | Brand names 'Gemini', 'Quest Flow', 'CRM' should be preserved. |
| `call.geminiLive` | د جیمني ژوند | **Gemini Live** | Brand name 'Gemini' should be preserved, not translated. |
| `call.toPlayground` | 🎯 د کثافاتو ډکولو ځای ته | **🎯 د روزنې ډګر ته** | Wrong word sense: 'полигон' (training ground) translated as 'landfill'. |
| `roomActions.copyLink` | لینک کوټې ته کاپي کړئ | **د خونې لینک کاپي کړئ** | Inconsistent term for 'room'. Should be 'خونې' (khone) instead of 'کوټې' (kote). |
| `billing.lowBalance` | {{n}} د ژباړې دقیقې پاتې دي | **{{n}} min ژباړه پاتې ده** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `billing.topupCta` | دقیقې · €{{price}} | **min · €{{price}}** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `partner.title` | Partner program | **د ملګرتیا پروګرام** | Should be translated to Pashto. |
| `partner.subtitle` | Share your link and earn | **خپل لینک شریک کړئ او عاید ترلاسه کړئ** | Should be translated to Pashto. |
| `partner.yourLink` | Your link | **ستاسو لینک** | Should be translated to Pashto. |
| `partner.copy` | Copy | **کاپي** | Should be translated to Pashto. |
| `partner.copied` | ✓ Link copied | **✓ لینک کاپي شو** | Should be translated to Pashto. |
| `partner.stats.clicks` | Clicks | **کلیکونه** | Should be translated to Pashto. |
| `partner.stats.registrations` | Sign-ups | **نوم لیکنې** | Should be translated to Pashto. |
| `partner.stats.paid` | Payments | **تادیات** | Should be translated to Pashto. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} کاروونکي · {{minutes}} min** | Should be translated to Pashto, 'min' preserved as per `min_unit` guideline. |
| `partner.terms` | Program terms | **د پروګرام شرایط** | Should be translated to Pashto. |
| `partner.contact` | Contact us | **موږ سره اړیکه ونیسئ** | Should be translated to Pashto. |
| `partner.termsModalTitle` | Partner program terms | **د ملګرتیا پروګرام شرایط** | Should be translated to Pashto. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **د پروګرام شرایط لا تر اوسه نه دي ټاکل شوي. مهرباني وکړئ د سوپراډمین سره اړیکه ونیسئ.** | Should be translated to Pashto. |
| `partner.loadError` | Failed to load partner data | **د ملګرتیا ډاټا بارولو کې پاتې راغلل** | Should be translated to Pashto. |
| `enterprise.page.upsellBody` | دلته تاسو کولی شئ تنظیم کړئ: د جیمني شخصي API کیلي، یو پرامپټ او د پوهې اساس، د کویسټ فلو + ټیلیګرام بوټ سره یوځای کول، او د چیټ ووټ CRM سره نښلول. | **دلته تاسو کولی شئ تنظیم کړئ: شخصي Gemini API کیلي، یو پرامپټ او د پوهې اساس، د Quest Flow + Telegram بوټ سره یوځای کول، او د Chatwoot CRM سره نښلول.** | Brand names 'Gemini', 'API', 'Quest Flow', 'Telegram', 'Chatwoot', 'CRM' should be preserved. |
| `enterprise.tabs.gemini` | جیمني API | **Gemini API** | Brand names 'Gemini' and 'API' should be preserved. |
| `enterprise.tabs.questFlow` | د لټون جریان | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.tabs.chatwoot` | سي آر ایم (چیټ ووټ) | **CRM (Chatwoot)** | Brand names 'CRM' and 'Chatwoot' should be preserved. |
| `enterprise.gemini.heading` | د ګوګل جیمني API کیلي | **Google Gemini API کیلي** | Brand names 'Google', 'Gemini', 'API' should be preserved. |
| `enterprise.gemini.lead` | د AI سټوډیو څخه یوه شخصي کیلي. دا ستاسو په حساب کې د ټولو جیمني زنګونو لپاره نړیوال کیلي بدلوي. | **د AI Studio څخه یوه شخصي کیلي. دا ستاسو په حساب کې د ټولو Gemini زنګونو لپاره نړیوال کیلي بدلوي.** | Brand names 'AI Studio' and 'Gemini' should be preserved. |
| `enterprise.gemini.leadSuffix` | . ستاسو په اکاونټ کې د ټولو جیمني زنګونو لپاره د نړیوال زنګونو پرځای کارول کیږي. | **. ستاسو په اکاونټ کې د ټولو Gemini زنګونو لپاره د نړیوال زنګونو پرځای کارول کیږي.** | Brand name 'Gemini' should be preserved. |
| `enterprise.gemini.aiStudioLink` | د مصنوعي ذهانت سټوډیو | **AI Studio** | Brand name 'AI Studio' should be preserved. |
| `enterprise.gemini.keyPlaceholder` | عیزا... | **AIzaSy...** | Placeholder for API key should be preserved exactly. |
| `enterprise.gemini.errEnterKey` | خپل د جیمني API کیلي دننه کړئ | **خپل Gemini API کیلي دننه کړئ** | Brand names 'Gemini' and 'API' should be preserved. |
| `enterprise.gemini.successValid` | کیلي د اعتبار وړ ده - جیمني API شتون لري. | **کیلي د اعتبار وړ ده - Gemini API شتون لري.** | Brand names 'Gemini' and 'API' should be preserved. |
| `enterprise.gemini.confirmDeleteTitle` | د هر کرایه دار جیمني کیلي حذف کړئ؟ | **د هر کرایه دار Gemini کیلي حذف کړئ؟** | Brand name 'Gemini' should be preserved. |
| `enterprise.gemini.telegram.heading` | د خبرتیاوو لپاره د ټیلیګرام بوټ | **د Telegram بوټ لپاره خبرتیاوې** | Brand name 'Telegram' should be preserved. |
| `enterprise.gemini.telegram.botFatherLabel` | @بوټ فادر | **@BotFather** | Brand name '@BotFather' should be preserved. |
| `enterprise.gemini.telegram.leadStartCmd` | / پیل | **/start** | Command '/start' should be preserved exactly. |
| `enterprise.gemini.telegram.tokenLabel` | د ټیلیګرام بوټ نښه | **د Telegram بوټ نښه** | Brand name 'Telegram' should be preserved. |
| `enterprise.gemini.telegram.tokenPlaceholder` | ۱۲۳۴۵۶۷۸۹:ABCdefGHIjklMNO... | **123456789:ABCdefGHIjklMNO...** | Placeholder for token should be preserved exactly. |
| `enterprise.gemini.telegram.successTestSingle` | ✓ پیغام وسپارل شو. ټیلیګرام وګورئ. | **✓ پیغام وسپارل شو. Telegram وګورئ.** | Brand name 'Telegram' should be preserved. |
| `enterprise.gemini.telegram.successTestMany` | ✓ پیغام {{count}} ترلاسه کونکو ته وسپارل شو. مهرباني وکړئ ټیلیګرام وګورئ. | **✓ پیغام {{count}} ترلاسه کونکو ته وسپارل شو. مهرباني وکړئ Telegram وګورئ.** | Brand name 'Telegram' should be preserved. |
| `enterprise.gemini.telegram.testingLabel` | خولۍ… | **موږ لیږو...** | Wrong word sense: 'Шлём' (sending) translated as 'hat'. |
| `enterprise.prompt.warning` | د کویسټ فلو سره مغشوش نه شئ | **د Quest Flow سره مغشوش نه شئ** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.questFlow.heading` | د لټون جریان | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.subtitle` | د ټیلیګرام بوټونو او انباونډ API له لارې مراجعینو ته د مصنوعي ذهانت ځوابونه | **د Telegram بوټونو او Inbound API له لارې مراجعینو ته د مصنوعي ذهانت ځوابونه** | Brand names 'Telegram' and 'Inbound API' should be preserved. |
| `enterprise.questFlow.apiKeyLabel` | د داخلي API کیلي (بیرر) | **Inbound API Key (Bearer)** | Brand names 'Inbound API Key' and 'Bearer' should be preserved. |
| `enterprise.questFlow.promptLabel` | د لټون جریان سیسټم پرامپټ | **د Quest Flow سیسټم پرامپټ** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.questFlow.kbLabel` | د کوسټ فلو د پوهې اساس | **د Quest Flow د پوهې اساس** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.questFlow.headerLead` | د هر مراجع سره په انفرادي ډول د ټیلیګرام بوټ له لارې چې د کویسټ فلو سره وصل دی، د مصنوعي ذهانت ډیالوګ. | **د هر مراجع سره په انفرادي ډول د Telegram بوټ له لارې چې د Quest Flow سره وصل دی، د مصنوعي ذهانت ډیالوګ.** | Brand names 'Telegram' and 'Quest Flow' should be preserved. |
| `enterprise.questFlow.keysHeading` | د کویسټ فلو API کیلي | **د Quest Flow API کیلي** | Brand names 'API' and 'Quest Flow' should be preserved. |
| `enterprise.questFlow.keysLead` | هره کیلي یو راز دی چې تاسو یې د زنځیر د کویسټ فلو HTTP بلاک کې دننه کوئ. VibeVox دا ستاسو د حساب پیژندلو لپاره کاروي. تاسو کولی شئ د مختلفو زنځیرونو لپاره ډیری کیلي جوړې کړئ. | **هره کیلي یو راز دی چې تاسو یې د زنځیر د Quest Flow HTTP بلاک کې دننه کوئ. VibeVox دا ستاسو د حساب پیژندلو لپاره کاروي. تاسو کولی شئ د مختلفو زنځیرونو لپاره ډیری کیلي جوړې کړئ.** | Brand names 'Quest Flow', 'HTTP', 'VibeVox' should be preserved. |
| `enterprise.questFlow.errDelete` | Delete error | **د حذف کولو تېروتنه** | Should be translated to Pashto. |
| `enterprise.questFlow.deleteTitle` | Delete | **ړنګول** | Should be translated to Pashto. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **کیلي ړنګ کړئ؟** | Should be translated to Pashto. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **کیلي به د تل لپاره حذف شي. Quest Flow به د دې له لارې کار بند کړي - تاسو به اړتیا ولرئ یوه نوې کیلي جوړه کړئ او په جریان کې یې ځای په ځای کړئ.** | Should be translated to Pashto, 'Quest Flow' preserved. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ړنګول** | Should be translated to Pashto. |
| `enterprise.questFlow.promptHeading` | د ټیلیګرام خبرو اترو لپاره غوښتنه وکړئ | **د Telegram خبرو اترو لپاره غوښتنه وکړئ** | Brand name 'Telegram' should be preserved. |
| `enterprise.questFlow.promptLead1` | دا ټاکي چې AI څنګه د کویسټ فلو له لارې له مراجعینو سره اړیکه نیسي: ټون، سټایل، څه باید وپیژندل شي. | **دا ټاکي چې AI څنګه د Quest Flow له لارې له مراجعینو سره اړیکه نیسي: ټون، سټایل، څه باید وپیژندل شي.** | Brand names 'AI' and 'Quest Flow' should be preserved. |
| `enterprise.questFlow.successPromptSaved` | د کوسټ فلو پرامپټ خوندي شو. | **د Quest Flow پرامپټ خوندي شو.** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.questFlow.kbHeading` | د لټون جریان لپاره د پوهې اساس | **د Quest Flow لپاره د پوهې اساس** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.questFlow.confirmKbDeleteBody` | د کویسټ فلو پوهه اساس به پاک شي. دا عمل بیرته نشي راوستل کیدی. | **د Quest Flow پوهه اساس به پاک شي. دا عمل بیرته نشي راوستل کیدی.** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.chatwoot.heading` | د CRM ادغام (چیټ ووټ) | **د CRM ادغام (Chatwoot)** | Brand names 'CRM' and 'Chatwoot' should be preserved. |
| `enterprise.chatwoot.subtitle` | په اتوماتيک ډول د زنګ وهلو تاریخ او ټګونه چیټ ووټ ته واستوئ. | **په اتوماتيک ډول د زنګ وهلو تاریخ او ټګونه Chatwoot ته واستوئ.** | Brand name 'Chatwoot' should be preserved. |
| `enterprise.chatwoot.urlLabel` | د چیټ ووټ URL (د مثال په توګه، https://app.chatwoot.com) | **Chatwoot URL (د مثال په توګه، https://app.chatwoot.com)** | Brand names 'Chatwoot' and 'URL' should be preserved. |
| `enterprise.chatwoot.headingShort` | سي آر ایم (چیټ ووټ) | **CRM (Chatwoot)** | Brand names 'CRM' and 'Chatwoot' should be preserved. |
| `enterprise.chatwoot.headerLead` | د خبرو اترو تاریخ او د پیرودونکو اړتیاو ټګونه چیټ ووټ CRM ته لیږدوي | **د خبرو اترو تاریخ او د پیرودونکو اړتیاو ټګونه Chatwoot CRM ته لیږدوي** | Brand names 'Chatwoot' and 'CRM' should be preserved. |
| `enterprise.chatwoot.urlFieldLabel` | د چیټ ووټ URL (ځان کوربه شوی یا app.chatwoot.com) | **Chatwoot URL (ځان کوربه شوی یا app.chatwoot.com)** | Brand names 'Chatwoot' and 'URL' should be preserved. |
| `enterprise.chatwoot.testSuccess` | اړیکه کار کوي - چیټ ووټ ځواب ورکوي. | **اړیکه کار کوي - Chatwoot ځواب ورکوي.** | Brand name 'Chatwoot' should be preserved. |
| `enterprise.chatwoot.whatSentHeading` | په چیټوټ کې څه لیږدول کیږي | **په Chatwoot کې څه لیږدول کیږي** | Brand name 'Chatwoot' should be preserved. |
| `enterprise.chatwoot.docsLabel` | د چیټ ووټ API اسناد | **د Chatwoot API اسناد** | Brand names 'Chatwoot' and 'API' should be preserved. |
| `chat.telegramBadge` | ټیلیګرام | **Telegram** | Brand name 'Telegram' should be preserved, not translated. |
| `lobby.shareSuccessHint` | ✓ لینک کاپي شوی دی. دا د ټیلیګرام / واټس اپ / بریښنالیک له لارې خپل اړیکې ته واستوئ. تاسو کولی شئ اوس پاڼه وتړئ - لینک تل کار کوي. | **✓ لینک کاپي شوی دی. دا د Telegram / WhatsApp / بریښنالیک له لارې خپل اړیکې ته واستوئ. تاسو کولی شئ اوس پاڼه وتړئ - لینک تل کار کوي.** | Brand names 'Telegram' and 'WhatsApp' should be preserved. |
| `paywall.subtitle` | یو پلان غوره کړئ یا ډیرې دقیقې واخلئ - د سټرایپ له لارې پیسې ورکړئ، دلته سمدلاسه بیرته ورکړئ. | **یو پلان غوره کړئ یا ډیرې دقیقې واخلئ - د Stripe له لارې پیسې ورکړئ، دلته سمدلاسه بیرته ورکړئ.** | Brand name 'Stripe' should be preserved. |
| `paywall.buyPlus` | جمع — €19/میاشت (60 دقیقې) | **Plus — €19/میاشت (60 min)** | Brand name 'Plus' and unit 'min' should be preserved. |
| `paywall.buyStandard` | معیاري – €29/میاشت (120 دقیقې) | **Standard – €29/میاشت (120 min)** | Brand name 'Standard' and unit 'min' should be preserved. |
| `paywall.featureMinutes` | {{count}} دقیقه ژباړه | **{{count}} min ژباړه** | Unit 'min' should be preserved. |
| `paywall.topupPerMin` | €0.17 / دقیقې | **€0.17 / min** | Unit 'min' should be preserved. |
| `paywall.topupCta` | {{count}} دقیقې واخلئ · €{{price}} | **{{count}} min واخلئ · €{{price}}** | Unit 'min' should be preserved. |
| `paywall.topupNoSubInfo` | ℹ تاسو فعال ګډون نلرئ. جمع به ستاسو په پیرود کې د €19/میاشت لپاره اضافه شي—60 دقیقې ستاسو په پلان کې شاملې دي، نو هیڅ اضافي لګښت نشته. | **ℹ تاسو فعال ګډون نلرئ. Plus به ستاسو په پیرود کې د €19/میاشت لپاره اضافه شي—60 دقیقې ستاسو په پلان کې شاملې دي، نو هیڅ اضافي لګښت نشته.** | Brand name 'Plus' should be preserved. |
| `paywall.topupPlusLine` | جمع تعرفه ({{count}} دقیقې شاملې دي) | **Plus تعرفه ({{count}} min شاملې دي)** | Brand name 'Plus' and unit 'min' should be preserved. |
| `paywall.topupFreeLine` | ↳ د تعرفې سره {{count}} دقیقې وړیا | **↳ د تعرفې سره {{count}} min وړیا** | Unit 'min' should be preserved. |
| `paywall.topupAddon` | اضافي پیرود {{count}} دقیقې × €0.17 | **اضافي پیرود {{count}} min × €0.17** | Unit 'min' should be preserved. |
| `paywall.stripeNote` | تادیات د سټرایپ لخوا خوندي شوي دي. دقیقې د تادیې وروسته په اوتومات ډول کریډیټ کیږي. | **تادیات د Stripe لخوا خوندي شوي دي. دقیقې د تادیې وروسته په اوتومات ډول کریډیټ کیږي.** | Brand name 'Stripe' should be preserved. |
| `paywall.checkoutFailed` | د سټرایپ چیک آوټ خلاصولو توان نلري | **د Stripe Checkout خلاصولو توان نلري** | Brand name 'Stripe' should be preserved. |
| `settingsMore.email` | استول | **Email** | Brand name 'Email' should be preserved. |
| `billingPage.balanceMinutes` | دقیقې | **min** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `billingPage.checkoutNoUrl` | د پټې چیک آوټ URL ترلاسه نه شو | **Stripe Checkout URL ترلاسه نه شو** | Brand names 'Stripe' and 'URL' should be preserved. |
| `billingPage.buyNMinutes` | {{count}} دقیقې واخلئ | **{{count}} min واخلئ** | Unit 'min' should be preserved. |
| `billingPage.yearlyMinutes` | ۱،۴۴۰ دقیقې / کال | **۱،۴۴۰ min / کال** | Unit 'min' should be preserved. |
| `billingPage.minutesShort` | دقیقې | **min** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `billingPage.tierPlusName` | جمع | **Plus** | Brand name 'Plus' should be preserved. |
| `billingPage.tierStandardName` | معیاري | **Standard** | Brand name 'Standard' should be preserved. |
| `billingPage.tierPlusMinutes` | ۶۰ دقیقې / میاشت | **۶۰ min / میاشت** | Unit 'min' should be preserved. |
| `billingPage.tierPlusPrice` | €0.31 / دقیقې | **€0.31 / min** | Unit 'min' should be preserved. |
| `billingPage.tierStandardMinutes` | ۱۲۰ دقیقې / میاشت | **۱۲۰ min / میاشت** | Unit 'min' should be preserved. |
| `billingPage.tierStandardPrice` | €0.24 / دقیقې | **€0.24 / min** | Unit 'min' should be preserved. |
| `billingPage.featureCountWithMinutes` | په میاشت کې {{count}} دقیقې ژباړه | **په میاشت کې {{count}} min ژباړه** | Unit 'min' should be preserved. |
| `billingPage.featureAllPlus` | ټول د پلس څخه | **ټول د Plus څخه** | Brand name 'Plus' should be preserved. |
| `billingPage.featureAllStandard` | ټول د معیار څخه | **ټول د Standard څخه** | Brand name 'Standard' should be preserved. |
| `billingPage.featureTelegramAuth` | د ټیلیګرام اجازه + د کارت سره لینک کول | **Telegram اجازه + د کارت سره لینک کول** | Brand name 'Telegram' should be preserved. |
| `billingPage.featureCalendar` | د ګوګل کیلنڈر - د مراجعینو ملاقاتونه | **Google Calendar - د مراجعینو ملاقاتونه** | Brand name 'Google' should be preserved. |
| `billingPage.ctaSubscribePlus` | پلس ترلاسه کړئ | **Plus ترلاسه کړئ** | Brand name 'Plus' should be preserved. |
| `billingPage.ctaSubscribeStandard` | د امر معیار | **Standard امر کړئ** | Brand name 'Standard' should be preserved. |
| `billingPage.whatsAppMessage` | سلام! زه د انټرپرائز وایبوکس پلان سره علاقه لرم. | **سلام! زه د Enterprise VibeVox پلان سره علاقه لرم.** | Brand names 'Enterprise' and 'VibeVox' should be preserved. |
| `billingPage.faqA3` | بشپړ مصنوعي ذهانت سټک: د پیرودونکو کارتونه د اتوماتیک پیژندنې سره، د ټیلیګرام اجازه، شخصي شوي اشارې، ګوګل کیلنڈر، د سمارټ اړتیاو ټګ کول، د CRM صادرات، د questflow.pro سره یوځای کول، او یو جلا اډمین ټب. | **بشپړ AI سټک: د پیرودونکو کارتونه د اتوماتیک پیژندنې سره، Telegram اجازه، شخصي شوي اشارې، Google Calendar، د سمارټ اړتیاو ټګ کول، د CRM صادرات، د questflow.pro سره یوځای کول، او یو جلا اډمین ټب.** | Brand names 'AI', 'Telegram', 'Google', 'CRM', 'questflow.pro' should be preserved. |
| `billingPage.topupSliderMax` | {{max}} دقیقې (۱۰ ساعته) | **{{max}} min (۱۰ ساعته)** | Preserve 'min' as a short unit for minutes as per `min_unit` guideline. |
| `billingPage.presetMinutes` | {{count}}متر | **{{count}}min** | Wrong word sense: 'м' (minutes) translated as 'meter'. Should be 'min'. |
| `billingPage.minutesTimesPrice` | {{count}} دقیقې × €{{price}} | **{{count}} min × €{{price}}** | Unit 'min' should be preserved. |
| `auth.common.googleSignIn` | د ګوګل سره ننوتل | **د Google سره ننوتل** | Brand name 'Google' should be preserved. |
| `auth.common.googleSignUp` | د ګوګل له لارې راجستر کړئ | **د Google له لارې راجستر کړئ** | Brand name 'Google' should be preserved. |
| `auth.common.emailLabel` | استول | **Email** | Brand name 'Email' should be preserved. |
| `auth.login.googleSignInFailed` | د ګوګل له لارې ننوتل ناکام شول | **د Google له لارې ننوتل ناکام شول** | Brand name 'Google' should be preserved. |
| `auth.googleCallback.loading` | د ګوګل له لارې ستاسو د ننوتلو تایید کول… | **د Google له لارې ستاسو د ننوتلو تایید کول…** | Brand name 'Google' should be preserved. |
