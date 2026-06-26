# LLM Review: Yiddish (yi)

**Model:** gemini-2.5-flash  
**Took:** 163.6s  
**Fixes proposed:** 42 (valid after placeholder-check: 42)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `balance.minutes` | {{count}} מינוט | **{{count}} מינוטן** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `balance.minutes_few` | {{count}} מינוט | **{{count}} מינוטן** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `balance.minutes_many` | {{count}} מינוט | **{{count}} מינוטן** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `balance.openPlans` | אָפענע טאַריפס און באַלאַנס | **עפֿענען טאַריפֿן און באַלאַנס** | Incorrect verb form and pluralization for 'Open tariffs'. |
| `billing.lowBalance` | {{n}} מינוט פון איבערזעצונג פארבליבן | **{{n}} מינוטן פון איבערזעצונג פארבליבן** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billing.topupCta` | מינוט · €{{price}} | **מינוטן · €{{price}}** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `partner.title` | Partner program | **פּאַרטנער פּראָגראַם** | Brand/product name translated to English; should be transliterated. |
| `partner.subtitle` | Share your link and earn | **טיילן אייער לינק און פאַרדינען** | English phrase; should be translated to Yiddish. |
| `partner.yourLink` | Your link | **אייער לינק** | English phrase; should be translated to Yiddish. |
| `partner.copy` | Copy | **קאָפּירן** | English word; should be translated to Yiddish. |
| `partner.copied` | ✓ Link copied | **✓ לינק קאָפּירט** | English phrase; should be translated to Yiddish. |
| `partner.stats.clicks` | Clicks | **קליקס** | English word; should be transliterated to Yiddish. |
| `partner.stats.registrations` | Sign-ups | **רעגיסטראַציעס** | English word; should be translated to Yiddish. |
| `partner.stats.paid` | Payments | **צאָלונגען** | English word; should be translated to Yiddish. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} באַניצער · {{minutes}} מינוטן** | English words and incorrect plural for 'minutes'. |
| `partner.terms` | Program terms | **פּראָגראַם באַדינגונגען** | English phrase; should be translated to Yiddish. |
| `partner.contact` | Contact us | **קאָנטאַקט אונדז** | English phrase; should be translated to Yiddish. |
| `partner.termsModalTitle` | Partner program terms | **פּאַרטנער פּראָגראַם באַדינגונגען** | English phrase; should be translated to Yiddish. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **פּראָגראַם באַדינגונגען זענען נאָך נישט באַשטימט. ביטע קאָנטאַקטירט SuperAdmin.** | English phrase; should be translated to Yiddish. |
| `partner.loadError` | Failed to load partner data | **נישט געלונגען צו לאָדן פּאַרטנער דאַטן** | English phrase; should be translated to Yiddish. |
| `sip.incoming.pausedHint` | אַקטיווירן די רעצעפּציע כּדי VibeVox זאָל אָנהייבן איבערזעצן אינקאַמינג רופן. | **אַקטיווירן דעם אָפּנאַם כּדי VibeVox זאָל אָנהייבן איבערזעצן אינקאַמינג רופן.** | 'רעצעפּציע' (reception) is less appropriate than 'אָפּנאַם'. |
| `enterprise.questFlow.errDelete` | Delete error | **אויסמעקן טעות** | English phrase; should be translated to Yiddish. |
| `enterprise.questFlow.deleteTitle` | Delete | **אויסמעקן** | English word; should be translated to Yiddish. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **אויסמעקן שליסל?** | English phrase; should be translated to Yiddish. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **דער שליסל וועט ווערן אויסגעמעקט אויף אייביק. קוועסט פלאָו וועט אויפהערן צו אַרבעטן דורך אים — איר וועט דאַרפֿן צו שאַפֿן אַ נײַעם שליסל און אים פאַרבייַטן אין דער קייט.** | English phrase; should be translated to Yiddish. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **אויסמעקן** | English word; should be translated to Yiddish. |
| `paywall.buyPlus` | פּלוס — €19/חודש (60 מינוט) | **פּלוס — €19/חודש (60 מינוטן)** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `paywall.buyStandard` | סטאַנדאַרט – €29/חודש (120 מינוט) | **סטאַנדאַרט – €29/חודש (120 מינוטן)** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `paywall.featureMinutes` | {{count}} מינוט איבערזעצונג | **{{count}} מינוטן איבערזעצונג** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `paywall.topupCta` | קויף {{count}} מינוט · €{{price}} | **קויף {{count}} מינוטן · €{{price}}** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `paywall.topupNoSubInfo` | ℹ איר האָט נישט קיין אַקטיווע אַבאָנעמענט. פּלוס וועט ווערן צוגעגעבן צו אייער קויפן פֿאַר €19/חודש—60 מינוט זענען אַרייַנגערעכנט אין אייער פּלאַן, אַזוי עס איז נישטאָ קיין עקסטרע אָפּצאָל. | **ℹ איר האָט נישט קיין אַקטיווע אַבאָנעמענט. פּלוס וועט ווערן צוגעגעבן צו אייער קויפן פֿאַר €19/חודש—60 מינוטן זענען אַרייַנגערעכנט אין אייער פּלאַן, אַזוי עס איז נישטאָ קיין עקסטרע אָפּצאָל.** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `paywall.topupPlusLine` | פּלוס טאַריף ({{count}} מינוט אַרייַנגענומען) | **פּלוס טאַריף ({{count}} מינוטן אַרייַנגענומען)** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `paywall.topupFreeLine` | ↳ {{count}} מינוט פריי מיטן טאַריף | **↳ {{count}} מינוטן פריי מיטן טאַריף** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `paywall.topupAddon` | נאָך קויפן {{count}} מינוט × €0.17 | **נאָך קויפן {{count}} מינוטן × €0.17** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billingPage.buyNMinutes` | קויף {{count}} מינוט | **קויף {{count}} מינוטן** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billingPage.yearlyMinutes` | 1,440 מינוט / יאָר | **1,440 מינוטן / יאָר** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billingPage.tierPlusMinutes` | 60 מינוט / חודש | **60 מינוטן / חודש** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billingPage.tierStandardMinutes` | 120 מינוט / חודש | **120 מינוטן / חודש** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billingPage.featureCountWithMinutes` | {{count}} מינוט איבערזעצונג פּער חודש | **{{count}} מינוטן איבערזעצונג פּער חודש** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billingPage.topupDescription` | €0.17 פּער מינוט. פֿון 60 מינוט ביז 10 שעה. קרעדיטירט גלייך נאָך צאָלונג. | **€0.17 פּער מינוט. פֿון 60 מינוטן ביז 10 שעה. קרעדיטירט גלייך נאָך צאָלונג.** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billingPage.topupSliderMax` | {{max}} מינוט (10 שעה) | **{{max}} מינוטן (10 שעה)** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
| `billingPage.minutesTimesPrice` | {{count}} מינוט × €{{price}} | **{{count}} מינוטן × €{{price}}** | Incorrect plural for 'minutes'; should be 'מינוטן'. |
