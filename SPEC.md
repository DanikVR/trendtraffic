# PROJECT SPECIFICATION: VIBEVOX (SaaS)

## 1. Executive Summary & Tech Stack
VibeVox is a real-time, multi-tenant SaaS application that provides simultaneous voice-to-voice and video translation using cutting-edge generative AI.

- **Frontend:** React, TypeScript, Tailwind CSS (optimized for Safari/iOS and Chrome/Android).
- **Backend/Core:** Node.js (TypeScript), PostgreSQL (Multi-tenant data isolation).
- **AI Audio & Translation Engine:** Google Gemini 3.5 Flash Live API (Native Audio Mode). No external TTS/STT cascades.
- **WebRTC Infrastructure:** LiveKit Cloud.
- **Deployment:** Hostinger VPS (KVM 4 Tariff). Deployment process must ensure persistent storage and zero data loss for clients during version updates.

---

## 2. Core Functional Requirements

### 2.1. Dynamic Real-Time Translation Room
- Users enter a room via a generated link.
- **Zero Language Guessing (UX):** Upon entering, each user selects *only* their native language (e.g., User A selects French, User B selects Russian).
- **Automatic Language Detection:** Gemini Live API automatically analyzes the incoming stream, identifies the spoken language, and outputs the translated audio to the counterpart in real-time.
- **Voice Preference:** Inside the room configuration, users can select the desired gender of the translator's voice ("Male" or "Female"). This configuration dynamically maps to Gemini's native HD voices (e.g., Kore, Aoede).

### 2.2. Universal SIP Telephony Bridge (WhatsApp & Voice)
- **RFC-Compliant Universal Gateway:** Standard integration with any budget SIP providers (e.g., Zadarma, OnlinePBX, Asterisk/FreePBX).
- **Inbound Calls (Inbound Routing):** System generates a unique LiveKit SIP URI per tenant (e.g., `sip:tenant-123.sip.livekit.cloud`). Users forward calls from any virtual number or third-party WhatsApp-SIP gateway to this URI.
- **Outbound Calls (Outbound Trunk):** Users fill out standard credentials (SIP Server, Username, Password, verified Caller ID, Transport type: UDP/TCP/TLS). Credentials are encrypted using AES-256-GCM. Outbound trunks are provisioned dynamically via LiveKit's `CreateSIPOutboundTrunk`.

### 2.3. AI Assistant & Post-Call Processing
- **AI-Only Conversations:** A secondary mode allowing standalone voice interactions with an AI agent trained on a specific knowledge base.
- **Custom Persona/Prompting:** Users can inject a `custom_system_prompt` (e.g., setting tone, script, negotiation style) and `custom_crm_attributes` in their settings.
- **Dynamic JSON Extraction:** Post-call analysis using dynamic JSON schemas to auto-extract specified CRM attributes (e.g., tagging customers as "Requires Lawyer" or "Requires Doctor").
- **Google Calendar Integration:** Uses the `freebusy.query` API to rigorously verify available time slots before booking appointments directly through the conversation.
- **CRM Integration:** Out-of-the-box native synchronization with Chatwoot CRM.

---

## 3. Monetization & Subscription Model (Stripe Integration)
The system operates on a 3-Tier subscription model synchronized via Stripe Webhooks with full persistence mapping:

1. **Tier 1 (Trial / Pay-As-You-Go):** Pay for a fixed package of pre-paid translation minutes.
2. **Tier 2 (Monthly/Annual Subscription):** Recurring standard tier. Annual subscriptions trigger a custom discount set in the Superadmin panel.
3. **Tier 3 (Enterprise):** Full access including customer profile cards, full data analysis, and advanced integrations.

### Additional Billing Rules:
- **Feature Toggles:** Advanced analytics, LiveKit Egress recording, and CRM post-processing are explicitly blocked on lower tiers to protect token margins.
- **Overtime Purchases:** Users can buy additional translation minutes top-up beyond their current plan limits.
- **Advanced Promo Codes:** Managed via Stripe Node.js SDK using `max_redemptions` (usage limit) and `expires_at` (expiration timestamp). System must support both limited promotions and unlimited/infinite promo codes.

---

## 4. Development & Architectural Guardrails
- **Knowledge Encyclopedia Structure:** Every significant feature or module *must* be contained within its own dedicated folder. Monolithic or bloated single-file architectures are strictly forbidden.
- **Spec-Driven Methodology:** The AI developer agent must generate an **Implementation Plan** and verify data structures against this `SPEC.md` file *before* producing production code.
- **Security Checkpoints:** High-security logic (Telegram HMAC verification, Stripe webhook verification, AES-256-GCM database encryption) should be flagged for detailed safety audits.