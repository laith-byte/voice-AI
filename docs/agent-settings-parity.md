# Agent Settings Parity Audit: Invaria Labs vs Retell API

**Audited on:** 2026-02-20
**SDK Version:** retell-sdk v4.66.0
**Sources:** Retell SDK TypeScript types, Retell REST API docs, our codebase

---

## Legend

- **Our Status**: Whether we expose / handle this field
  - `UI + API` = Exposed in our UI and sent to Retell via our API route
  - `API only` = Handled in our config API route but not visible in UI
  - `Missing` = Not implemented at all
  - `Custom` = Invaria-only feature (stored in Supabase, not sent to Retell)
- **Retell Status**: Whether Retell supports this field
  - `Supported` = In Retell's agent API
  - `N/A` = Not a Retell concept (our custom feature)

---

## 1. Core Agent Settings

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| agent_name | UI + API (Supabase only) | Supported | We save name in Supabase but do NOT send `agent_name` to Retell update API. Retell agent name stays out of sync. |
| response_engine | API only | Supported | We build `response_engine` object with `type: "retell-llm"` correctly |
| voice_id | UI + API | Supported | Mapped correctly |
| language | UI + API | Supported | Correctly mapped with language directive injection/stripping |

## 2. LLM / Response Engine Settings

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| system_prompt (general_prompt) | UI + API | Supported | Correctly uses `general_prompt` for voice agents, `system_prompt` for chat agents |
| llm_model (model) | UI + API | Supported | Mapped correctly |
| begin_message (first_message) | UI + API | Supported | Mapped correctly |
| general_tools (functions) | UI + API | Supported | Correctly uses `general_tools` for voice, `tools` for chat |
| model_high_priority | UI + API | Supported | Mapped correctly |
| tool_call_strict_mode | UI + API | Supported | Mapped correctly |
| knowledge_base_ids | UI + API | Supported | Mapped correctly |
| kb_config (top_k, filter_score) | UI + API | Supported | Mapped correctly |

## 3. Voice Configuration (Voice Agents Only)

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| voice_model | UI + API | Supported | Mapped correctly |
| voice_speed | UI + API | Supported | Mapped correctly |
| voice_temperature | UI + API | Supported | Mapped correctly |
| volume | UI + API | Supported | Mapped correctly |
| enable_dynamic_voice_speed | **Missing** | Supported | Retell offers adaptive speed based on context -- we don't expose this |
| voice_emotion | **Missing** | Supported | Retell supports emotional tone (calm, sympathetic, happy, sad, angry, fearful, surprised) -- we don't expose this |
| fallback_voice_ids | UI + API | Supported | Mapped correctly |

## 4. Speech / Interaction Settings (Voice Agents Only)

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| responsiveness | UI + API | Supported | Mapped correctly |
| interruption_sensitivity | UI + API | Supported | Mapped correctly |
| ambient_sound | UI + API | Supported | Mapped correctly (we use `background_sound` -> `ambient_sound`) |
| ambient_sound_volume | UI + API | Supported | Mapped correctly |
| enable_backchannel | UI + API | Supported | Mapped correctly |
| backchannel_frequency | UI + API | Supported | Mapped correctly |
| backchannel_words | UI + API | Supported | Mapped correctly |
| normalize_for_speech | UI + API | Supported | Mapped correctly |
| reminder_trigger_ms | UI + API | Supported | We store in seconds, convert to ms correctly |
| reminder_max_count | UI + API | Supported | Mapped correctly |
| pronunciation_dictionary | UI + API | Supported | Mapped correctly |

## 5. Transcription / STT Settings (Voice Agents Only)

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| denoising_mode | UI + API | Supported | Mapped correctly |
| stt_mode | UI + API | Supported | We use `transcription_mode` -> `stt_mode` |
| vocab_specialization | UI + API | Supported | We use `vocabulary_specialization` -> `vocab_specialization` |
| boosted_keywords | UI + API | Supported | Mapped correctly |
| custom_stt_config | **Missing** | Supported | Retell supports provider-specific STT configurations -- we don't expose this |

## 6. Call Settings (Voice Agents Only)

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| end_call_after_silence_ms | UI + API | Supported | We store in seconds, convert to ms correctly |
| max_call_duration_ms | UI + API | Supported | We store in seconds, convert to ms correctly |
| begin_message_delay_ms | UI + API | Supported | We use `pause_before_speaking` -> `begin_message_delay_ms`. Mapped correctly |
| ring_duration_ms | UI + API | Supported | We store in seconds, convert to ms correctly |

## 7. Voicemail Detection (Voice Agents Only)

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| enable_voicemail_detection | UI + API | Supported | We map `voicemail_detection` -> `enable_voicemail_detection` correctly |
| voicemail_option | UI + API | Supported | **BUG: Structural mismatch.** See Critical Bug #1 below |
| voicemail_detection_timeout_ms | **Missing** | Supported | Retell allows configuring detection timeout (5000-180000ms) -- we don't expose this |

## 8. IVR Detection (Voice Agents Only)

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| ivr_option | **Missing** | Supported | Retell supports IVR detection and response actions -- we don't expose this at all |

## 9. DTMF / Keypad Input (Voice Agents Only)

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| allow_user_dtmf | UI + API | Supported | Mapped correctly via `keypad_input_detection` |
| user_dtmf_options.digit_limit | UI + API | Supported | Mapped correctly |
| user_dtmf_options.termination_key | UI + API | Supported | Mapped correctly |
| user_dtmf_options.timeout_ms | UI + API | Supported | We store in seconds, convert to ms correctly |

## 10. Post-Call / Post-Chat Analysis

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| post_call_analysis_model | UI + API | Supported | Mapped correctly |
| post_call_analysis_data | UI + API | Supported | Mapped correctly |
| analysis_successful_prompt | **Missing** | Supported | Retell allows custom prompt to determine if call was successful -- we don't send this |
| analysis_summary_prompt | **Missing** | Supported | Retell allows custom summary generation prompt -- we don't send this |

## 11. Data Storage / Security

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| data_storage_setting | UI + API | Supported | Mapped correctly |
| opt_in_signed_url | UI + API | Supported | We use `secure_urls` -> `opt_in_signed_url` |
| signed_url_expiration_ms | UI + API | Supported | We store in hours, convert to ms correctly |
| pii_config | UI + API | Supported | Mapped correctly with mode and categories |

## 12. Webhook Configuration

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| webhook_url | UI + API | Supported | Mapped correctly |
| webhook_timeout_ms | UI + API | Supported | We store in seconds, convert to ms correctly |
| webhook_events | **Missing** | Supported | Retell allows subscribing to specific event types -- we don't expose this |

## 13. Dynamic Variables & MCP

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| default_dynamic_variables | UI + API | Supported | Mapped correctly |
| mcp_servers | UI + API | Supported | Mapped correctly |

## 14. Safety & Moderation

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| guardrail_config | **Missing** | Supported | Retell supports prohibited topic detection guardrails -- we don't expose this |

## 15. Versioning & Publishing

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| version | API only (read) | Supported | We display versions but handle versioning through Retell's publish endpoint |
| version_description | **Missing** | Supported | Retell allows documenting what changed in each version -- we don't expose this |
| is_published | API only (read) | Supported | Read-only display |
| is_public | **Missing** | Supported | Retell allows making agent preview link publicly accessible -- we don't expose this |

## 16. Chat Agent-Specific Settings

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| auto_close_message | UI + API | Supported | Mapped correctly |
| end_chat_after_silence_ms | UI + API | Supported | We store in minutes, convert to ms correctly |
| post_chat_analysis_model | **Missing** | Supported | Chat agents have separate analysis model field -- we send `post_call_analysis_model` which may not apply |
| post_chat_analysis_data | **Missing** | Supported | Chat agents have separate analysis data field -- we send `post_call_analysis_data` which may not apply |

## 17. Invaria-Only Features (Custom, Not Sent to Retell)

| Field Name | Our Status | Retell Status | Notes |
|---|---|---|---|
| AI Analysis Config (summary, evaluation, auto-tagging, misunderstood) | Custom (Supabase) | N/A | Stored in `ai_analysis_config` table, not sent to Retell |
| Widget Config (description, layout, branding) | Custom (Supabase) | N/A | Stored in `widget_config` table |
| Cost Breakdown Display | Custom (UI only) | N/A | Calculated client-side using retell-costs.ts |
| Prototype Call / Test Chat | Custom (UI only) | N/A | Uses Retell web call/chat API but UI is custom |

---

## Critical Bugs

### Bug #1: voicemail_option Structure Mismatch (HIGH SEVERITY)

**Location:** `/src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx` lines 1020-1029

**Problem:** Our code sends `voicemail_option` in a flat structure:
```json
{ "type": "hangup" }
{ "type": "leave_voicemail_message", "voicemail_message": "Hello..." }
```

Retell's API expects a nested `action` wrapper:
```json
{ "action": { "type": "hangup" } }
{ "action": { "type": "static_text", "text": "Hello..." } }
```

Additionally, we use `"leave_voicemail_message"` as a type which is not a valid Retell action type. The valid types are: `hangup`, `prompt`, `static_text`, and `bridge_transfer`.

**Impact:** Voicemail settings may silently fail or be ignored by Retell. Any user who configures voicemail detection with a custom message will not have it applied correctly.

**Files affected:**
- `/src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx` (portal settings page)
- `/src/app/(startup)/agents/[id]/agent-config/page.tsx` (startup config page)
- `/src/app/api/agents/[id]/config/route.ts` (API route -- passes voicemail_option through as-is)

### Bug #2: agent_name Not Synced to Retell (LOW SEVERITY)

**Location:** `/src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx` line 873-885

**Problem:** When the user renames an agent, we update the Supabase `agents` table but never send `agent_name` to Retell's update API. The Retell dashboard will show stale names.

**Impact:** Cosmetic only -- affects Retell dashboard users.

### Bug #3: Post-Call Analysis for Chat Agents Uses Wrong Field Names (MEDIUM SEVERITY)

**Location:** `/src/app/api/agents/[id]/config/route.ts` lines 193-196

**Problem:** For chat agents, Retell uses `post_chat_analysis_model` and `post_chat_analysis_data` instead of `post_call_analysis_model` and `post_call_analysis_data`. Our config route sends the voice agent field names regardless of platform type, so post-call analysis settings may not apply to chat agents.

**Impact:** Custom post-chat analysis configuration will not work for chat/SMS agents.

---

## Missing Retell Features (Priority Order)

| Priority | Feature | Retell Field | Reason |
|---|---|---|---|
| High | Voicemail Detection Timeout | `voicemail_detection_timeout_ms` | Important for fine-tuning voicemail behavior |
| High | Analysis Prompts | `analysis_successful_prompt`, `analysis_summary_prompt` | These control the quality of call analysis -- users need to customize |
| High | Guardrails | `guardrail_config` | Safety feature for production agents |
| Medium | IVR Detection | `ivr_option` | Needed for outbound calling to handle automated phone systems |
| Medium | Dynamic Voice Speed | `enable_dynamic_voice_speed` | Improves naturalness of conversations |
| Medium | Voice Emotion | `voice_emotion` | Allows setting emotional tone of the agent |
| Medium | Webhook Event Filtering | `webhook_events` | Allows subscribing to only relevant events |
| Medium | Chat Analysis Fields | `post_chat_analysis_model`, `post_chat_analysis_data` | Needed for proper chat agent analysis |
| Low | Custom STT Config | `custom_stt_config` | Advanced users may need provider-specific STT settings |
| Low | Version Description | `version_description` | Nice-to-have for version management |
| Low | Public Agent Preview | `is_public` | Allows sharing agent preview links |

---

## Field Mapping Reference

For developers -- this is how our internal field names map to Retell's API field names:

| Our Field Name | Retell API Field Name | Direction |
|---|---|---|
| background_sound | ambient_sound | Both |
| background_sound_volume | ambient_sound_volume | Both |
| enable_backchanneling | enable_backchannel | Both |
| speech_normalization | normalize_for_speech | Both |
| reminder_frequency_sec | reminder_trigger_ms (x1000) | Both |
| transcription_mode | stt_mode | Both |
| vocabulary_specialization | vocab_specialization | Both |
| voicemail_detection | enable_voicemail_detection | Both |
| keypad_input_detection | allow_user_dtmf | Both |
| end_call_after_silence | end_call_after_silence_ms (x1000) | Both |
| max_call_duration | max_call_duration_ms (x1000) | Both |
| begin_message_delay | begin_message_delay_ms (x1000) | Both |
| ring_duration | ring_duration_ms (x1000) | Both |
| secure_urls | opt_in_signed_url | Both |
| signed_url_expiration_hours | signed_url_expiration_ms (x3600000) | Both |
| data_storage | data_storage_setting | Both |
| default_dynamic_vars | default_dynamic_variables | Both |
| pii_redaction + pii_categories | pii_config | Both |
| system_prompt | general_prompt (voice) / system_prompt (chat) | Both |
| functions | general_tools (voice) / tools (chat) | Both |
