// ─── Prompt Tree / Conversation Flow Types ──────────────────────────────────
// Maps to Retell AI's Conversation Flow API.
// Used by both the API route and the React Flow canvas editor.
// ─────────────────────────────────────────────────────────────────────────────

// Node types supported by Retell's Conversation Flow
export type PromptTreeNodeType =
  | "conversation"
  | "end"
  | "transfer_call"
  | "function"
  | "sms"
  | "press_digit"
  | "agent_swap"
  | "branch";

// ─── Instruction ─────────────────────────────────────────────────────────────

export interface NodeInstructionPrompt {
  text: string;
  type: "prompt";
}

export interface NodeInstructionStaticText {
  text: string;
  type: "static_text";
}

export type NodeInstruction = NodeInstructionPrompt | NodeInstructionStaticText;

// ─── Transition Conditions ───────────────────────────────────────────────────

export interface PromptCondition {
  prompt: string;
  type: "prompt";
}

export interface EquationCondition {
  equations: Array<{
    left: string;
    operator:
      | "=="
      | "!="
      | ">"
      | ">="
      | "<"
      | "<="
      | "contains"
      | "not_contains"
      | "exists"
      | "not_exist";
    right?: string;
  }>;
  operator: "||" | "&&";
  type: "equation";
}

export type TransitionCondition = PromptCondition | EquationCondition;

// ─── Edge (stored on nodes in Retell API) ────────────────────────────────────

export interface RetellEdge {
  id: string;
  destination_node_id?: string;
  transition_condition: TransitionCondition;
}

// ─── Display Position ────────────────────────────────────────────────────────

export interface DisplayPosition {
  x?: number;
  y?: number;
}

// ─── Global Node Setting ─────────────────────────────────────────────────────

export interface GlobalNodeSetting {
  condition: string;
  positive_finetune_examples?: Array<{ transcript: Array<{ content: string; role: string }> }>;
  negative_finetune_examples?: Array<{ transcript: Array<{ content: string; role: string }> }>;
}

// ─── Transfer Types ──────────────────────────────────────────────────────────

export interface TransferDestinationPredefined {
  number: string;
  type: "predefined";
  extension?: string;
}

export interface TransferDestinationInferred {
  prompt: string;
  type: "inferred";
}

export type TransferDestination =
  | TransferDestinationPredefined
  | TransferDestinationInferred;

export interface TransferOptionColdTransfer {
  type: "cold_transfer";
  show_transferee_as_caller?: boolean;
}

export interface TransferOptionWarmTransfer {
  type: "warm_transfer";
  agent_detection_timeout_ms?: number;
  on_hold_music?: "none" | "relaxing_sound" | "uplifting_beats" | "ringtone";
  show_transferee_as_caller?: boolean;
}

export interface TransferOptionAgenticWarmTransfer {
  type: "agentic_warm_transfer";
  on_hold_music?: "none" | "relaxing_sound" | "uplifting_beats" | "ringtone";
  show_transferee_as_caller?: boolean;
}

export type TransferOption =
  | TransferOptionColdTransfer
  | TransferOptionWarmTransfer
  | TransferOptionAgenticWarmTransfer;

// ─── Model Choice ────────────────────────────────────────────────────────────

export interface ModelChoice {
  model:
    | "gpt-4.1"
    | "gpt-4.1-mini"
    | "gpt-4.1-nano"
    | "gpt-5"
    | "gpt-5-mini"
    | "gpt-5-nano"
    | "claude-4.5-sonnet"
    | "claude-4.5-haiku"
    | "gemini-2.5-flash"
    | "gemini-2.5-flash-lite";
  type: "cascading";
  high_priority?: boolean;
}

// ─── Retell Node Types ───────────────────────────────────────────────────────

export interface RetellConversationNode {
  id: string;
  type: "conversation";
  name?: string;
  display_position?: DisplayPosition;
  instruction: NodeInstruction;
  edges?: RetellEdge[];
  global_node_setting?: GlobalNodeSetting;
  model_choice?: ModelChoice;
  interruption_sensitivity?: number;
  knowledge_base_ids?: string[] | null;
  skip_response_edge?: RetellEdge;
  responsiveness?: number;
  voice_speed?: number;
}

export interface RetellEndNode {
  id: string;
  type: "end";
  name?: string;
  display_position?: DisplayPosition;
  global_node_setting?: GlobalNodeSetting;
  instruction?: NodeInstruction;
  speak_during_execution?: boolean;
}

export interface RetellTransferCallNode {
  id: string;
  type: "transfer_call";
  name?: string;
  display_position?: DisplayPosition;
  transfer_destination: TransferDestination;
  transfer_option: TransferOption;
  edge: RetellEdge; // "Transfer failed" fallback edge
  global_node_setting?: GlobalNodeSetting;
  model_choice?: ModelChoice;
  custom_sip_headers?: Record<string, string>;
  ignore_e164_validation?: boolean;
  speak_during_execution?: boolean;
  instruction?: NodeInstruction;
}

export interface RetellFunctionNode {
  id: string;
  type: "function";
  name?: string;
  display_position?: DisplayPosition;
  tool_id: string;
  tool_type: "local" | "shared";
  wait_for_result: boolean;
  edges?: RetellEdge[];
  instruction?: NodeInstruction;
  speak_during_execution?: boolean;
  global_node_setting?: GlobalNodeSetting;
  model_choice?: ModelChoice;
}

export interface RetellSMSNode {
  id: string;
  type: "sms";
  name?: string;
  display_position?: DisplayPosition;
  sms_content: string;
  success_edge?: RetellEdge;
  failed_edge?: RetellEdge;
  global_node_setting?: GlobalNodeSetting;
}

export interface RetellPressDigitNode {
  id: string;
  type: "press_digit";
  name?: string;
  display_position?: DisplayPosition;
  instruction: { text: string; type: "prompt" };
  delay_ms?: number;
  edges?: RetellEdge[];
  global_node_setting?: GlobalNodeSetting;
  model_choice?: ModelChoice;
}

export interface RetellBranchNode {
  id: string;
  type: "branch";
  name?: string;
  display_position?: DisplayPosition;
  conditions?: Array<{
    id: string;
    condition: TransitionCondition;
    destination_node_id?: string;
  }>;
  else_edge?: RetellEdge;
  global_node_setting?: GlobalNodeSetting;
}

export interface RetellAgentSwapNode {
  id: string;
  type: "agent_swap";
  name?: string;
  display_position?: DisplayPosition;
  agent_id: string;
  edge?: RetellEdge;
  global_node_setting?: GlobalNodeSetting;
  agent_version?: number;
  post_call_analysis_setting?: "both_agents" | "only_destination_agent";
  webhook_setting?: "both_agents" | "only_destination_agent" | "only_source_agent";
  keep_current_voice?: boolean;
  speak_during_execution?: boolean;
  instruction?: NodeInstruction;
}

export type RetellNode =
  | RetellConversationNode
  | RetellEndNode
  | RetellTransferCallNode
  | RetellFunctionNode
  | RetellSMSNode
  | RetellPressDigitNode
  | RetellBranchNode
  | RetellAgentSwapNode;

// ─── Flow-Level Tools ────────────────────────────────────────────────────────

export interface CustomFunctionToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required?: boolean;
}

export interface ConversationFlowCustomTool {
  type: "custom";
  name: string;
  description?: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  timeout_ms?: number;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  parameters?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  response_variables?: Record<string, string>;
  speak_during_execution?: boolean;
  speak_after_execution?: boolean;
  tool_id?: string;
}

export interface CheckAvailabilityCalTool {
  type: "check_availability_cal";
  name: string;
  description?: string;
  cal_api_key: string;
  event_type_id: number;
  timezone?: string;
  tool_id?: string;
}

export interface BookAppointmentCalTool {
  type: "book_appointment_cal";
  name: string;
  description?: string;
  cal_api_key: string;
  event_type_id: number;
  timezone?: string;
  tool_id?: string;
}

export interface EndCallTool {
  type: "end_call";
  name: string;
  description?: string;
  tool_id?: string;
}

export interface TransferCallTool {
  type: "transfer_call";
  name: string;
  description?: string;
  number?: string;
  show_transferee_as_caller?: boolean;
  tool_id?: string;
}

export interface AgentSwapTool {
  type: "agent_swap";
  name: string;
  description?: string;
  agent_id: string;
  tool_id?: string;
}

export interface PressDigitTool {
  type: "press_digit";
  name: string;
  description?: string;
  tool_id?: string;
}

export interface SendSMSTool {
  type: "send_sms";
  name: string;
  description?: string;
  tool_id?: string;
}

export interface ExtractDynamicVariableTool {
  type: "extract_dynamic_variable";
  name: string;
  description?: string;
  variables?: Array<{
    name: string;
    description: string;
    type: "string" | "number" | "boolean";
  }>;
  tool_id?: string;
}

export type ConversationFlowTool =
  | ConversationFlowCustomTool
  | CheckAvailabilityCalTool
  | BookAppointmentCalTool
  | EndCallTool
  | TransferCallTool
  | AgentSwapTool
  | PressDigitTool
  | SendSMSTool
  | ExtractDynamicVariableTool;

// ─── Conversation Flow (top-level) ──────────────────────────────────────────

export interface ConversationFlowData {
  conversation_flow_id?: string;
  version?: number;
  nodes: RetellNode[];
  start_node_id?: string | null;
  start_speaker?: "user" | "agent";
  global_prompt?: string | null;
  model_choice?: ModelChoice;
  model_temperature?: number | null;
  begin_tag_display_position?: DisplayPosition | null;
  begin_after_user_silence_ms?: number | null;
  tools?: ConversationFlowTool[];
  knowledge_base_ids?: string[] | null;
  default_dynamic_variables?: Record<string, string> | null;
  tool_call_strict_mode?: boolean | null;
}

// ─── Retell LLM State Types (for retell-llm engine type) ────────────────────
// When an agent uses response_engine.type = "retell-llm", the conversation flow
// is stored as "states" inside the LLM object, not as standalone conversation-flow nodes.

export interface RetellLLMStateEdge {
  destination_state_name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    description?: string;
  };
}

export interface RetellLLMState {
  name: string;
  state_prompt?: string;
  edges?: RetellLLMStateEdge[];
  tools?: ConversationFlowTool[];
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ConversationFlowAPIResponse {
  exists: boolean;
  flow: ConversationFlowData | null;
  conversation_flow_id?: string;
  /** Which Retell engine type this agent uses */
  engine_type?: "conversation-flow" | "retell-llm";
  /** LLM ID (only for retell-llm engine type) */
  llm_id?: string;
  /** Raw LLM data preserved for round-tripping (retell-llm only) */
  _retell_llm_data?: unknown;
}

// ─── React Flow Node Data ────────────────────────────────────────────────────
// The `data` field on React Flow nodes uses this union.

export interface PromptTreeNodeDataBase {
  [key: string]: unknown;
  type: PromptTreeNodeType;
  name: string;
  global_node_setting?: GlobalNodeSetting;
}

export interface ConversationNodeData extends PromptTreeNodeDataBase {
  type: "conversation";
  instruction: NodeInstruction;
  edges: RetellEdge[];
  model_choice?: ModelChoice;
  interruption_sensitivity?: number;
  knowledge_base_ids?: string[] | null;
  skip_response_edge?: RetellEdge;
  responsiveness?: number;
  voice_speed?: number;
}

export interface EndNodeData extends PromptTreeNodeDataBase {
  type: "end";
  instruction?: NodeInstruction;
  speak_during_execution?: boolean;
}

export interface TransferCallNodeData extends PromptTreeNodeDataBase {
  type: "transfer_call";
  transfer_destination: TransferDestination;
  transfer_option: TransferOption;
  edge: RetellEdge;
  model_choice?: ModelChoice;
  ignore_e164_validation?: boolean;
  speak_during_execution?: boolean;
  instruction?: NodeInstruction;
  custom_sip_headers?: Record<string, string>;
}

export interface FunctionNodeData extends PromptTreeNodeDataBase {
  type: "function";
  tool_id: string;
  tool_type: "local" | "shared";
  wait_for_result: boolean;
  edges: RetellEdge[];
  instruction?: NodeInstruction;
  speak_during_execution?: boolean;
  model_choice?: ModelChoice;
}

export interface SMSNodeData extends PromptTreeNodeDataBase {
  type: "sms";
  sms_content: string;
  success_edge?: RetellEdge;
  failed_edge?: RetellEdge;
}

export interface PressDigitNodeData extends PromptTreeNodeDataBase {
  type: "press_digit";
  instruction: { text: string; type: "prompt" };
  delay_ms?: number;
  edges: RetellEdge[];
  model_choice?: ModelChoice;
}

export interface BranchNodeData extends PromptTreeNodeDataBase {
  type: "branch";
  conditions: Array<{
    id: string;
    condition: TransitionCondition;
    destination_node_id?: string;
  }>;
  else_edge?: RetellEdge;
}

export interface AgentSwapNodeData extends PromptTreeNodeDataBase {
  type: "agent_swap";
  agent_id: string;
  edge?: RetellEdge;
  agent_version?: number;
  post_call_analysis_setting?: "both_agents" | "only_destination_agent";
  webhook_setting?: "both_agents" | "only_destination_agent" | "only_source_agent";
  keep_current_voice?: boolean;
  speak_during_execution?: boolean;
  instruction?: NodeInstruction;
}

// Begin tag (UI-only, not a real Retell node)
export interface BeginTagNodeData {
  [key: string]: unknown;
  type: "begin_tag";
  startSpeaker: "user" | "agent";
}

export type PromptTreeNodeData =
  | ConversationNodeData
  | EndNodeData
  | TransferCallNodeData
  | FunctionNodeData
  | SMSNodeData
  | PressDigitNodeData
  | BranchNodeData
  | AgentSwapNodeData
  | BeginTagNodeData;

// ─── Default Templates ──────────────────────────────────────────────────────

export const DEFAULT_FLOW_TEMPLATE: ConversationFlowData = {
  nodes: [
    {
      id: "node_intro",
      type: "conversation",
      name: "Greeting & Identification",
      display_position: { x: 0, y: 150 },
      instruction: {
        text: `You are the first point of contact for all incoming calls. Your goal in this state is to create a warm, professional first impression and quickly identify who you're speaking with and what they need.

**Opening greeting:**
- Greet the caller with a warm, natural tone: "Hi there, thanks for calling [Company Name]! My name is [Agent Name]. Who do I have the pleasure of speaking with today?"
- If it's a return caller and you recognize them (e.g. via caller ID or CRM lookup), acknowledge them: "Welcome back, [Name]! Great to hear from you again."

**Information gathering:**
- After getting their name, ask: "Thanks, [Name]! How can I help you today?"
- Listen carefully to their initial request. Do NOT interrupt them while they're explaining.
- If their request is vague (e.g. "I have a question"), gently probe: "Of course! I'd be happy to help. Could you tell me a bit more about what you're looking for?"

**Tone & style:**
- Be conversational, not robotic. Use natural fillers like "absolutely," "of course," "great question."
- Mirror the caller's energy — if they're upbeat, match it. If they seem stressed or frustrated, be calm and reassuring.
- Keep your sentences short and clear. Avoid jargon unless the caller uses it first.
- NEVER say "I'm an AI" or "I'm a virtual assistant" unless directly asked. If asked, be honest but redirect: "I'm an AI assistant here to help! I can handle most requests, and if needed, I can connect you with a team member."`,
        type: "prompt",
      },
      edges: [
        {
          id: "edge_intro_to_needs",
          destination_node_id: "node_needs_assessment",
          transition_condition: {
            type: "prompt",
            prompt: "The caller has introduced themselves and stated their general need, question, or reason for calling.",
          },
        },
      ],
    },
    {
      id: "node_needs_assessment",
      type: "conversation",
      name: "Needs Assessment",
      display_position: { x: 0, y: 450 },
      instruction: {
        text: `Your goal in this state is to fully understand the caller's needs so you can either resolve their request directly or route them appropriately. Ask targeted follow-up questions to clarify their situation.

**Clarification approach:**
- Summarize what you've heard so far: "So if I understand correctly, you're looking to [restate their need]. Is that right?"
- Ask one follow-up question at a time — never stack multiple questions in one turn.
- Use open-ended questions to understand context: "Can you tell me a bit more about...?" or "What's your timeline for this?"
- For complex requests, break them down: "Let's tackle that one step at a time. First, let me help you with [most urgent part]."

**Gathering key details (as relevant):**
- Contact information: name, email, phone number — but only ask for what you don't already have.
- Specific needs: what product/service they're interested in, what problem they're trying to solve.
- Timeline: how soon they need help, any deadlines.
- Budget or constraints: only ask if directly relevant and the conversation has naturally led there.

**Handling common scenarios:**
- If they need something you can resolve: proceed to help them directly with clear, step-by-step guidance.
- If they need to be transferred: let them know who you're connecting them with and why: "I'd love to connect you with [Name/Department] — they specialize in exactly this and can give you the best answer."
- If they're just browsing or have general questions: be helpful and informative without being pushy. Provide value.

**What NOT to do:**
- Don't make promises you can't keep (e.g. specific pricing, guaranteed timelines) unless you have confirmed data.
- Don't rush the caller. Let them explain at their own pace.
- Don't use filler phrases like "I understand your frustration" unless they've actually expressed frustration.`,
        type: "prompt",
      },
      edges: [
        {
          id: "edge_needs_to_resolution",
          destination_node_id: "node_resolution",
          transition_condition: {
            type: "prompt",
            prompt: "You have a clear understanding of the caller's needs and have gathered enough information to either resolve their request or provide a clear next step.",
          },
        },
      ],
    },
    {
      id: "node_resolution",
      type: "conversation",
      name: "Resolution & Next Steps",
      display_position: { x: 0, y: 750 },
      instruction: {
        text: `Your goal in this state is to provide a clear resolution and confirm next steps before wrapping up the call. The caller should leave feeling their issue was fully addressed.

**Delivering the resolution:**
- Clearly state what you've done or what will happen next: "Great news — I've [action taken]. Here's what happens next..."
- If scheduling is involved, confirm all details: date, time, location, what to bring/prepare.
- If you're sending information (email, SMS, link), confirm the destination: "I'll send that to [email/phone]. You should receive it within [timeframe]."

**Confirming understanding:**
- Summarize the key points: "Just to recap: [summary of what was discussed and agreed upon]."
- Ask for confirmation: "Does that all sound good to you?"
- Leave space for additional questions: "Before we wrap up, is there anything else I can help you with today?"

**Handling additional requests:**
- If they have another question, address it fully before trying to close again.
- If the new request requires a different department, offer to transfer: "That's a great question — let me connect you with our [department] team who can help with that specifically."

**Setting expectations:**
- If follow-up is needed, be specific about who, what, and when: "You'll receive a call from [Name] within [timeframe] to finalize the details."
- If they need to take action, clearly outline the steps: "On your end, you'll want to [step 1], then [step 2]."

**Closing warmly:**
- Thank them by name: "Thanks so much for calling, [Name]!"
- End with something warm and specific, not generic: "I hope the [appointment/order/info] works out perfectly for you. Have a wonderful [time of day]!"
- If they've been a great caller, acknowledge it: "It was really great chatting with you. Don't hesitate to call back anytime!"`,
        type: "prompt",
      },
      edges: [
        {
          id: "edge_resolution_to_end",
          destination_node_id: "node_end",
          transition_condition: {
            type: "prompt",
            prompt: "The caller has confirmed they're satisfied, has no additional questions, and the conversation is naturally wrapping up with a goodbye.",
          },
        },
      ],
    },
    {
      id: "node_end",
      type: "end",
      name: "End Call",
      display_position: { x: 0, y: 1050 },
    },
  ],
  start_node_id: "node_intro",
  start_speaker: "agent",
  global_prompt: `You are a professional, friendly AI phone agent representing the company. Follow these guidelines across ALL conversation states:

**Voice & personality:**
- Speak naturally and conversationally — like a helpful, knowledgeable team member, not a scripted bot.
- Be warm but efficient. Respect the caller's time while being thorough.
- Use the caller's name periodically (but not every sentence — that feels unnatural).

**Pacing & flow:**
- Keep responses concise — aim for 1-3 sentences per turn unless explaining something complex.
- Pause naturally between thoughts. Don't rush through information.
- If you need to look something up or process something, let them know: "Give me just a moment to pull that up for you."

**Handling difficult situations:**
- If a caller is upset, acknowledge their feelings first before problem-solving: "I completely understand why that would be frustrating. Let me see what I can do."
- If you don't know the answer, be honest: "That's a great question. I want to make sure I give you the right information, so let me connect you with someone who specializes in that."
- Never argue with the caller. De-escalate by validating and redirecting.

**Compliance & accuracy:**
- Never fabricate information. If you're unsure, say so and offer to find out.
- Don't share other customers' information or internal policies that aren't meant for customers.
- If asked about pricing, provide ranges or direct them to the right resource rather than guessing.`,
  model_choice: { model: "gpt-4.1", type: "cascading" },
};
