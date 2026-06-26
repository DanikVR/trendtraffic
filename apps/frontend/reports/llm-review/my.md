# LLM Review: Burmese (my)

**Model:** gemini-2.5-flash  
**Took:** 177.3s  
**Fixes proposed:** 52 (valid after placeholder-check: 52)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.home` | အိမ် | **ပင်မစာမျက်နှာသို့** | More specific for 'To home page' in UI context. |
| `rooms.subtitle` | သင့်ရဲ့ တက်ကြွတဲ့ တစ်ပြိုင်နက်တည်း အဓိပ္ပာယ်ဖွင့်ဆိုချက် အစည်းအဝေးတွေ | **သင့်ရဲ့ တက်ကြွတဲ့ တစ်ပြိုင်နက်တည်း ဘာသာပြန်ဆိုခြင်း အစည်းအဝေးများ** | Use 'ဘာသာပြန်ဆိုခြင်း' (translation) instead of 'အဓိပ္ပာယ်ဖွင့်ဆိုချက်' (interpretation). |
| `balance.label` | ချိန်ခွင်လျှာ | **လက်ကျန်ငွေ** | Use 'လက်ကျန်ငွေ' for account balance, not 'ချိန်ခွင်လျှာ' (equilibrium). |
| `call.waitingPeer` | စကားပြောသူကို စောင့်မျှော်နေမိတယ်... | **စကားပြောသူကို စောင့်မျှော်နေသည်...** | Remove informal 'မိတယ်' suffix for a neutral tone. |
| `call.you` | မင်း | **သင်** | Use formal 'သင်' instead of informal 'မင်း'. |
| `call.validating` | VibeVox လုံခြုံသော ချိတ်ဆက်မှုကို စမ်းသပ်နေသည်… | **VibeVox လုံခြုံသော ချိတ်ဆက်မှုကို စစ်ဆေးနေသည်…** | Use 'စစ်ဆေးနေသည်' (checking/validating) instead of 'စမ်းသပ်နေသည်' (testing). |
| `coach.promptLabel` | မင်းရဲ့ဆန္ဒတွေ (လေသံ၊ စတိုင်၊ အတိမ်အနက်) | **သင့်ဆန္ဒများ (လေသံ၊ စတိုင်၊ အတိမ်အနက်)** | Use formal 'သင့်' instead of informal 'မင်းရဲ့'. |
| `coach.yourReply` | သင့်အဖြေ | **သင့်အဖြေ** | Use formal 'သင့်' instead of informal 'သင့်'. |
| `roomActions.copyLink` | လင့်ခ်ကို အခန်းသို့ ကူးယူပါ | **အခန်းလင့်ခ်ကို ကူးယူပါ** | More natural phrasing for 'Copy room link'. |
| `billing.quotaExhausted` | ဘာသာပြန်ချိန် ကုန်ဆုံးသွားပါပြီ | **ဘာသာပြန်မိနစ်များ ကုန်ဆုံးသွားပါပြီ** | More precise for 'translation minutes' instead of 'translation time'. |
| `billing.paywallLowBalance` | သင့်လက်ကျန်ငွေတွင် မိနစ်အနည်းငယ်မျှ မကျန်တော့ပါ - အစီအစဉ်တစ်ခုအတွက် စာရင်းသွင်းပါ သို့မဟုတ် နောက်ထပ်ဝယ်ယူပါ | **သင့်လက်ကျန်ငွေတွင် မိနစ်မရှိတော့ပါ - အစီအစဉ်တစ်ခုအတွက် စာရင်းသွင်းပါ သို့မဟုတ် နောက်ထပ်ဝယ်ယူပါ** | Correct meaning for 'no minutes' instead of 'only a few minutes left'. |
| `partner.title` | Partner program | **မိတ်ဖက်အစီအစဉ်** | Translate 'Partner program'. |
| `partner.subtitle` | Share your link and earn | **သင့်လင့်ခ်ကို မျှဝေပြီး ဝင်ငွေရှာပါ** | Translate 'Share your link and earn'. |
| `partner.yourLink` | Your link | **သင့်လင့်ခ်** | Translate 'Your link'. |
| `partner.copy` | Copy | **မိတ္တူကူးပါ** | Translate 'Copy'. |
| `partner.copied` | ✓ Link copied | **✓ လင့်ခ်ကို ကူးယူပြီးပါပြီ** | Translate 'Link copied'. |
| `partner.stats.clicks` | Clicks | **ကလစ်များ** | Translate 'Clicks'. |
| `partner.stats.registrations` | Sign-ups | **မှတ်ပုံတင်ခြင်းများ** | Translate 'Sign-ups'. |
| `partner.stats.paid` | Payments | **ငွေပေးချေမှုများ** | Translate 'Payments'. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} ဦး · {{minutes}} မိနစ်** | Translate 'users' and 'min' units. |
| `partner.terms` | Program terms | **အစီအစဉ် စည်းကမ်းသတ်မှတ်ချက်များ** | Translate 'Program terms'. |
| `partner.contact` | Contact us | **ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ** | Translate 'Contact us'. |
| `partner.termsModalTitle` | Partner program terms | **မိတ်ဖက်အစီအစဉ် စည်းကမ်းသတ်မှတ်ချက်များ** | Translate 'Partner program terms'. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **အစီအစဉ်စည်းကမ်းသတ်မှတ်ချက်များကို မသတ်မှတ်ရသေးပါ။ SuperAdmin ကို ဆက်သွယ်ပါ။** | Translate 'Program terms are not set yet. Please contact SuperAdmin.'. |
| `partner.loadError` | Failed to load partner data | **မိတ်ဖက်ဒေတာများကို တင်၍မရပါ** | Translate 'Failed to load partner data'. |
| `toneMenu.anotherTone` | ကွဲပြားတဲ့ သံစဉ်တစ်ခု | **အခြားလေသံ** | Use 'လေသံ' (tone of voice) instead of 'သံစဉ်' (melody/tune). |
| `toneMenu.tone` | တန်ချိန် | **လေသံ** | Use 'လေသံ' (tone of voice) instead of 'တန်ချိန်' (tonnage/weight). |
| `enterprise.prompt.subtitle` | ဗီဒီယိုအခန်းများတွင်သာ စာသားပြန်ဆိုရန်အတွက် လျင်မြန်မှုနှင့် ဗဟုသုတအခြေခံ | **ဗီဒီယိုအခန်းများတွင်သာ စာသားပြန်ဆိုရန်အတွက် Prompt နှင့် ဗဟုသုတအခြေခံ** | Preserve 'Prompt' as a technical term, instead of 'လျင်မြန်မှု' (speed/quickness). |
| `enterprise.prompt.promptLabel` | စနစ်အချက်ပြမှု (လေသံ၊ ပုံစံ၊ ဝေါဟာရ) | **စနစ် Prompt (လေသံ၊ ပုံစံ၊ ဝေါဟာရ)** | Preserve 'Prompt' as a technical term, instead of 'အချက်ပြမှု' (signal/indication). |
| `enterprise.prompt.savePrompt` | ပရိုမ်ကို သိမ်းဆည်းပါ | **Prompt ကို သိမ်းဆည်းပါ** | Preserve 'Prompt' as a technical term, instead of transliteration 'ပရိုမ်'. |
| `enterprise.prompt.defaultLabel` | VibeVox မူရင်းညွှန်ကြားချက် | **VibeVox မူရင်း Prompt** | Preserve 'Prompt' as a technical term, instead of 'ညွှန်ကြားချက်' (instruction). |
| `enterprise.prompt.headerLeadBold2` | "မင်းရဲ့ တောင်းဆိုချက်အရ" | **"သင့် Prompt အရ"** | Use formal 'သင့်' instead of informal 'မင်းရဲ့' and preserve 'Prompt'. |
| `enterprise.prompt.contextHeading` | အခြေအနေ / promt | **အခြေအနေ / Prompt** | Correct spelling/transliteration of 'Prompt'. |
| `enterprise.prompt.contextLeadBold` | "မင်းရဲ့ တောင်းဆိုချက်အရ" | **"သင့် Prompt အရ"** | Use formal 'သင့်' instead of informal 'မင်းရဲ့' and preserve 'Prompt'. |
| `enterprise.prompt.extendNoteText` | ၎င်းတို့၏ကိုယ်ပိုင်စည်းမျဉ်းများ/စတိုင်/ဝေါဟာရများဖြင့် - ၎င်းတို့ကို အထက်ဖော်ပြပါ မူရင်း prompt နှင့် knowledge base နှင့် ပေါင်းစပ်သွားမည်ဖြစ်သည်။ | **၎င်းတို့၏ကိုယ်ပိုင်စည်းမျဉ်းများ/စတိုင်/ဝေါဟာရများဖြင့် - ၎င်းတို့ကို အထက်ဖော်ပြပါ မူရင်း Prompt နှင့် knowledge base နှင့် ပေါင်းစပ်သွားမည်ဖြစ်သည်။** | Capitalize 'Prompt' for consistency. |
| `enterprise.questFlow.savePrompt` | ပရိုမ်ကို သိမ်းဆည်းပါ | **Prompt ကို သိမ်းဆည်းပါ** | Preserve 'Prompt' as a technical term, instead of transliteration 'ပရိုမ်'. |
| `enterprise.questFlow.errDelete` | Delete error | **ဖျက်ရာတွင် အမှား** | Translate 'Delete error'. |
| `enterprise.questFlow.deleteTitle` | Delete | **ဖျက်ရန်** | Translate 'Delete'. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **သော့ကို ဖျက်မလား။** | Translate 'Delete key?'. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **သော့ကို ပြန်လည်ရယူ၍မရအောင် ဖျက်ပစ်ပါမည်။ Quest Flow သည် ၎င်းမှတစ်ဆင့် အလုပ်လုပ်တော့မည်မဟုတ်ပါ — သော့အသစ်တစ်ခု ဖန်တီးပြီး flow တွင် အစားထိုးရန် လိုအပ်ပါမည်။** | Translate 'The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow.'. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ဖျက်ရန်** | Translate 'Delete'. |
| `chat.tone` | တန်ချိန် | **လေသံ** | Use 'လေသံ' (tone of voice) instead of 'တန်ချိန်' (tonnage/weight). |
| `lobby.nameLabel` | သင့်နာမည်ဘယ်လိုခေါ်လဲ? | **သင့်နာမည်ဘယ်လိုခေါ်လဲ?** | Use formal 'သင့်' instead of informal 'သင့်'. |
| `paywall.titleLowBalance` | သင့်လက်ကျန်ငွေတွင် မိနစ်အနည်းငယ်မျှ မကျန်တော့ပါ - အစီအစဉ်တစ်ခုအတွက် စာရင်းသွင်းပါ သို့မဟုတ် နောက်ထပ်ဝယ်ယူပါ | **သင့်လက်ကျန်ငွေတွင် မိနစ်မရှိတော့ပါ - အစီအစဉ်တစ်ခုအတွက် စာရင်းသွင်းပါ သို့မဟုတ် နောက်ထပ်ဝယ်ယူပါ** | Correct meaning for 'no minutes' instead of 'only a few minutes left'. |
| `paywall.buyEnterprise` | ကြှနျုပျတို့ကိုဆကျသှယျရနျ | **ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ** | Correct grammar/spelling for 'Contact us'. |
| `billingPage.promoCode` | ကြော်ငြာကုဒ် | **ပရိုမိုကုဒ်** | Use common transliteration 'ပရိုမိုကုဒ်' for 'Promo code'. |
| `billingPage.presetHours` | {{count}}h | **{{count}} နာရီ** | Translate 'h' to 'နာရီ' (hours). |
| `billingPage.presetMinutes` | {{count}}m | **{{count}} မိနစ်** | Translate 'm' to 'မိနစ်' (minutes). |
| `auth.login.forgot` | သင့်စကားဝှက်ကိုမေ့နေပါသလား? | **သင့်စကားဝှက်ကိုမေ့နေပါသလား?** | Use formal 'သင့်' instead of informal 'သင့်'. |
| `auth.register.namePlaceholder` | သင့်နာမည် | **သင့်နာမည်** | Use formal 'သင့်' instead of informal 'သင့်'. |
| `pwaInstall.buttonSubtitle` | Home screen ကိုသွားပါ - တစ်ချက်နှိပ်ရုံဖြင့် စတင်ပါ | **ပင်မမျက်နှာပြင်သို့ သွားပါ - တစ်ချက်နှိပ်ရုံဖြင့် စတင်ပါ** | Translate 'Home screen' to 'ပင်မမျက်နှာပြင်'. |
| `enterprise.prompt.presetsHeading` | နားလည်လွယ်သော ရှင်းလင်းချက်အသံများ | **နားလည်လွယ်သော ရှင်းလင်းချက်လေသံများ** | Use 'လေသံ' (tone of voice) instead of 'အသံ' (sound). |
