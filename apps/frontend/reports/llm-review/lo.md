# LLM Review: Lao (lo)

**Model:** gemini-2.5-flash  
**Took:** 157.2s  
**Fixes proposed:** 36 (valid after placeholder-check: 36)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `billing.topupCta` | min · €{{price}} | **ນາທີ · €{{price}}** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `partner.title` | Partner program | **ໂຄງການຄູ່ຮ່ວມງານ** | Translate 'Partner program' as it is not a preserved brand name. |
| `partner.subtitle` | Share your link and earn | **ແບ່ງປັນລິ້ງຂອງທ່ານ ແລະ ສ້າງລາຍໄດ້** | Translate the marketing copy as it is not a preserved brand name. |
| `partner.yourLink` | Your link | **ລິ້ງຂອງທ່ານ** | Translate 'Your link' as it is not a preserved brand name. |
| `partner.copy` | Copy | **ສຳເນົາ** | Translate 'Copy' as it is a common UI action, not a brand. |
| `partner.copied` | ✓ Link copied | **✓ ສຳເນົາລິ້ງແລ້ວ** | Translate 'Link copied' as it is a common UI message, not a brand. |
| `partner.stats.clicks` | Clicks | **ການຄລິກ** | Translate 'Clicks' as it is a common metric, not a brand. |
| `partner.stats.registrations` | Sign-ups | **ການລົງທະບຽນ** | Translate 'Sign-ups' as it is a common metric, not a brand. |
| `partner.stats.paid` | Payments | **ການຈ່າຍເງິນ** | Translate 'Payments' as it is a common metric, not a brand. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} ຜູ້ໃຊ້ · {{minutes}} ນາທີ** | Translate 'users' and 'min' to Lao equivalents. |
| `partner.terms` | Program terms | **ເງື່ອນໄຂໂຄງການ** | Translate 'Program terms' as it is not a preserved brand name. |
| `partner.contact` | Contact us | **ຕິດຕໍ່ພວກເຮົາ** | Translate 'Contact us' as it is a common UI action, not a brand. |
| `partner.termsModalTitle` | Partner program terms | **ເງື່ອນໄຂໂຄງການຄູ່ຮ່ວມງານ** | Translate 'Partner program terms' as it is not a preserved brand name. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **ເງື່ອນໄຂໂຄງການຍັງບໍ່ໄດ້ກຳນົດເທື່ອ. ກະລຸນາຕິດຕໍ່ SuperAdmin.** | Translate the message as it is not a preserved brand name. |
| `partner.loadError` | Failed to load partner data | **ໂຫຼດຂໍ້ມູນຄູ່ຮ່ວມງານບໍ່ສຳເລັດ** | Translate the error message as it is not a preserved brand name. |
| `sip.outbound.noTrunkHint` | ຕື່ມແບບຟອມ "New SIP Trunk" ຢູ່ເທິງສຸດຂອງໜ້າ - VibeVox ຈະໃຊ້ຜູ້ໃຫ້ບໍລິການ SIP ຂອງທ່ານ (Zadarma, OnlinePBX, ແລະອື່ນໆ) ສຳລັບການໂທອອກ. | **ຕື່ມແບບຟອມ "SIP-ລຳຕົ້ນໃໝ່" ຢູ່ເທິງສຸດຂອງໜ້າ - VibeVox ຈະໃຊ້ຜູ້ໃຫ້ບໍລິການ SIP ຂອງທ່ານ (Zadarma, OnlinePBX, ...) ສຳລັບການໂທອອກ.** | Translate 'New SIP Trunk' as it's a UI element, and preserve '...' as per instructions. |
| `enterprise.questFlow.promptLabel` | System Prompt Quest Flow | **Prompt ລະບົບ Quest Flow** | Translate 'System Prompt' as it is not a brand name. |
| `enterprise.questFlow.errDelete` | Delete error | **ຄວາມຜິດພາດໃນການລຶບ** | Translate 'Delete error' as it is a common error message, not a brand. |
| `enterprise.questFlow.deleteTitle` | Delete | **ລຶບ** | Translate 'Delete' as it is a common UI action, not a brand. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **ລຶບກະແຈບໍ?** | Translate 'Delete key?' as it is a common UI message, not a brand. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **ກະແຈຈະຖືກລຶບຢ່າງຖາວອນ. Quest Flow ຈະຢຸດເຮັດວຽກຜ່ານມັນ — ທ່ານຈະຕ້ອງສ້າງກະແຈໃໝ່ ແລະ ປ່ຽນແທນໃນລະບົບ.** | Translate the message as it is not a preserved brand name. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ລຶບ** | Translate 'Delete' as it is a common UI action, not a brand. |
| `paywall.buyPlus` | Plus — €19/ເດືອນ (60 min) | **Plus — €19/ເດືອນ (60 ນາທີ)** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `paywall.buyStandard` | Standard — €29/ເດືອນ (120 min) | **Standard — €29/ເດືອນ (120 ນາທີ)** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `paywall.featureMinutes` | {{count}} min ການແປ | **{{count}} ນາທີການແປ** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `paywall.topupPerMin` | €0.17 / min | **€0.17 / ນາທີ** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `paywall.topupCta` | ຊື້ {{count}} min · €{{price}} | **ຊື້ {{count}} ນາທີ · €{{price}}** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `paywall.topupPlusLine` | ແຜນ Plus (ລວມ {{count}} min ແລ້ວ) | **ແຜນ Plus (ລວມ {{count}} ນາທີ ແລ້ວ)** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `paywall.topupFreeLine` | ↳ {{count}} min ຟຣີພ້ອມແຜນການ | **↳ {{count}} ນາທີ ຟຣີພ້ອມແຜນການ** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `paywall.topupAddon` | ຊື້ເພີ່ມເຕີມ {{count}} min × €0.17 | **ຊື້ເພີ່ມເຕີມ {{count}} ນາທີ × €0.17** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `billingPage.balanceMinutes` | min | **ນາທີ** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `billingPage.minutesShort` | min | **ນາທີ** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `billingPage.tierPlusPrice` | €0.31 / min | **€0.31 / ນາທີ** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `billingPage.tierStandardPrice` | €0.24 / min | **€0.24 / ນາທີ** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `billingPage.topupSliderMax` | {{max}} min (10 ຊົ່ວໂມງ) | **{{max}} ນາທີ (10 ຊົ່ວໂມງ)** | Translate 'min' to 'ນາທີ' for consistency with other minute translations. |
| `billingPage.presetHours` | {{count}}h | **{{count}}ຊມ** | Translate 'h' (hours) to its Lao abbreviation 'ຊມ'. |
