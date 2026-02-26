# Fix: Agent Prompt & Prompt Tree Not Syncing After Onboarding

## Root Cause Analysis

After thoroughly tracing the entire data flow across 8 files, I've identified **3 compounding bugs** that cause:
1. The wrong agent name showing on the Agent Settings page ("Jake" instead of "Samantha")
2. The Prompt Tree page appearing empty after onboarding

### Bug 1: RLS blocks `agents` table writes for client users (CRITICAL)

The `client_own_agents` RLS policy is `FOR SELECT` only. Client users can **read** their agents but **cannot UPDATE** them. Two endpoints silently fail to save `conversation_flow_id`:

- **Deploy endpoint** (`POST /api/conversation-flows/[id]`, line 452): Uses `supabase` (user session) to `UPDATE agents SET conversation_flow_id = ...` — **silently blocked by RLS**.
- **Prompt tree auto-save** (`PUT /api/agents/[id]/conversation-flow`, line 652): Same issue.

**Effect**: Our DB `agents.conversation_flow_id` stays null. The prompt tree GET endpoint falls back to checking Retell's `response_engine.conversation_flow_id`, which should work IF the Retell agent was linked correctly. But if Retell linking also failed (e.g., stale flow ID), there's no fallback at all.

### Bug 2: `create-agent` route doesn't save `conversation_flow_id` to our DB

When `cloneTemplateConversationFlow` creates a new flow on Retell, the flow ID is used in `response_engine` for the Retell agent update, but it's **never saved** to `agents.conversation_flow_id` in our DB. Combined with Bug 1 (deploy can't write either), our DB never knows about the flow.

### Bug 3: Deploy endpoint uses user-session client where service client is needed

The deploy endpoint uses `supabase` (user session) for multiple DB writes that can fail silently for client users. These all need service client.

## Fix Plan

### Step 1: Fix deploy endpoint RLS issue ✅
**File**: `src/app/api/conversation-flows/[id]/route.ts`

- [x] Import `createServiceClient`
- [x] Create `adminDb` at the top of the POST handler
- [x] Use `adminDb` for `agents.update({ conversation_flow_id })` (line 452)
- [x] Use `adminDb` for `conversation_flows.update({ is_active, version })` (lines 458-465)
- [x] Use `adminDb` for `conversation_flows.update({ is_active: false })` (lines 469-473)

### Step 2: Fix create-agent to save `conversation_flow_id` ✅
**File**: `src/app/api/onboarding/create-agent/route.ts`

- [x] Existing agent reconfiguration: save flow ID via `adminDb` after Retell update
- [x] Chat/SMS agent creation: capture `conversationFlowId` after cloning
- [x] Voice agent creation: capture `conversationFlowId` after cloning
- [x] Include `conversation_flow_id` in agent row insert

### Step 3: Fix prompt tree auto-save RLS issue ✅
**File**: `src/app/api/agents/[id]/conversation-flow/route.ts`

- [x] Import `createServiceClient`
- [x] Use `adminDb` for clearing stale flow ID in GET handler
- [x] Use `adminDb` for saving new flow ID in PUT handler

### Step 4: Build and verify ✅
- [x] Run `npm run build` — no type errors
- [x] All imports resolve
