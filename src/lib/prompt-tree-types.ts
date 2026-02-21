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
}

export interface RetellEndNode {
  id: string;
  type: "end";
  name?: string;
  display_position?: DisplayPosition;
  global_node_setting?: GlobalNodeSetting;
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
  tools?: unknown[];
  knowledge_base_ids?: string[] | null;
  default_dynamic_variables?: Record<string, string> | null;
  tool_call_strict_mode?: boolean | null;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ConversationFlowAPIResponse {
  exists: boolean;
  flow: ConversationFlowData | null;
  conversation_flow_id?: string;
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
}

export interface EndNodeData extends PromptTreeNodeDataBase {
  type: "end";
}

export interface TransferCallNodeData extends PromptTreeNodeDataBase {
  type: "transfer_call";
  transfer_destination: TransferDestination;
  transfer_option: TransferOption;
  edge: RetellEdge;
  model_choice?: ModelChoice;
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
}

export type PromptTreeNodeData =
  | ConversationNodeData
  | EndNodeData
  | TransferCallNodeData
  | FunctionNodeData
  | SMSNodeData
  | PressDigitNodeData
  | BranchNodeData
  | AgentSwapNodeData;

// ─── Default Templates ──────────────────────────────────────────────────────

export const DEFAULT_FLOW_TEMPLATE: ConversationFlowData = {
  nodes: [
    {
      id: "node_intro",
      type: "conversation",
      name: "Greeting",
      display_position: { x: 0, y: 150 },
      instruction: {
        text: "Greet the caller warmly and ask how you can help them today.",
        type: "prompt",
      },
      edges: [
        {
          id: "edge_intro_to_main",
          destination_node_id: "node_main",
          transition_condition: {
            type: "prompt",
            prompt: "The caller has stated their needs or question.",
          },
        },
      ],
    },
    {
      id: "node_main",
      type: "conversation",
      name: "Main Conversation",
      display_position: { x: 0, y: 400 },
      instruction: {
        text: "Address the caller's needs. Help them with their question or request. If you cannot help, offer to transfer them to a human agent.",
        type: "prompt",
      },
      edges: [
        {
          id: "edge_main_to_end",
          destination_node_id: "node_end",
          transition_condition: {
            type: "prompt",
            prompt: "The caller's needs have been addressed and the conversation is wrapping up.",
          },
        },
      ],
    },
    {
      id: "node_end",
      type: "end",
      name: "End Call",
      display_position: { x: 0, y: 650 },
    },
  ],
  start_node_id: "node_intro",
  start_speaker: "agent",
  global_prompt: null,
  model_choice: { model: "gpt-4.1", type: "cascading" },
};
