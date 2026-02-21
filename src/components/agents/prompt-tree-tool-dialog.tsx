"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  Plus,
  X,
  Code2,
  Calendar,
  Phone,
  PhoneForwarded,
  ArrowRightLeft,
  Hash,
  MessageCircle,
  Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  ConversationFlowCustomTool,
  ConversationFlowTool,
  CheckAvailabilityCalTool,
  BookAppointmentCalTool,
  EndCallTool,
  TransferCallTool,
  AgentSwapTool,
  PressDigitTool,
  SendSMSTool,
  ExtractDynamicVariableTool,
} from "@/lib/prompt-tree-types";

// ─── Key-Value Pair Helper ──────────────────────────────────────────────────

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

function makeId() {
  return `kv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function recordToKvPairs(record: Record<string, string> | undefined): KeyValuePair[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => ({
    id: makeId(),
    key,
    value,
  }));
}

function kvPairsToRecord(pairs: KeyValuePair[]): Record<string, string> | undefined {
  const filtered = pairs.filter((p) => p.key.trim() !== "");
  if (filtered.length === 0) return undefined;
  const record: Record<string, string> = {};
  for (const pair of filtered) {
    record[pair.key] = pair.value;
  }
  return record;
}

function KeyValuePairEditor({
  label,
  pairs,
  onChange,
}: {
  label: string;
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {pairs.map((pair, i) => (
        <div key={pair.id} className="flex items-center gap-2">
          <Input
            placeholder="Key"
            className="flex-1"
            value={pair.key}
            onChange={(e) => {
              const updated = [...pairs];
              updated[i] = { ...pair, key: e.target.value };
              onChange(updated);
            }}
          />
          <Input
            placeholder="Value"
            className="flex-1"
            value={pair.value}
            onChange={(e) => {
              const updated = [...pairs];
              updated[i] = { ...pair, value: e.target.value };
              onChange(updated);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onChange(pairs.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => onChange([...pairs, { id: makeId(), key: "", value: "" }])}
      >
        <Plus className="size-3.5" />
        New key value pair
      </Button>
    </div>
  );
}

// ─── Parameter Form Types ───────────────────────────────────────────────────

interface ParameterRow {
  id: string;
  name: string;
  description: string;
  type: "string" | "number" | "boolean";
  required: boolean;
}

function makeParamId() {
  return `param_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parametersToRows(
  parameters: ConversationFlowCustomTool["parameters"]
): ParameterRow[] {
  if (!parameters?.properties) return [];
  const requiredSet = new Set(parameters.required ?? []);
  return Object.entries(parameters.properties).map(([name, schema]) => {
    const s = schema as { type?: string; description?: string };
    return {
      id: makeParamId(),
      name,
      description: s.description ?? "",
      type: (s.type as "string" | "number" | "boolean") ?? "string",
      required: requiredSet.has(name),
    };
  });
}

function rowsToParameters(
  rows: ParameterRow[]
): ConversationFlowCustomTool["parameters"] | undefined {
  const filtered = rows.filter((r) => r.name.trim() !== "");
  if (filtered.length === 0) return undefined;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const row of filtered) {
    properties[row.name] = {
      type: row.type,
      ...(row.description ? { description: row.description } : {}),
    };
    if (row.required) {
      required.push(row.name);
    }
  }
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function parametersToJson(
  parameters: ConversationFlowCustomTool["parameters"]
): string {
  if (!parameters) return "{}";
  return JSON.stringify(parameters, null, 2);
}

function jsonToParameters(
  json: string
): ConversationFlowCustomTool["parameters"] | undefined {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && parsed.type === "object") {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ─── Custom Function Dialog ─────────────────────────────────────────────────

interface ToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: ConversationFlowCustomTool | null;
  onSave: (tool: ConversationFlowCustomTool) => void;
}

export function CustomFunctionDialog({
  open,
  onOpenChange,
  tool,
  onSave,
}: ToolDialogProps) {
  const isEditing = tool !== null;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">("POST");
  const [url, setUrl] = useState("");
  const [timeoutMs, setTimeoutMs] = useState<number | undefined>(undefined);
  const [headers, setHeaders] = useState<KeyValuePair[]>([]);
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([]);
  const [parameterRows, setParameterRows] = useState<ParameterRow[]>([]);
  const [parametersJson, setParametersJson] = useState("{}");
  const [parametersViewMode, setParametersViewMode] = useState<"form" | "json">("form");
  const [responseVariables, setResponseVariables] = useState<KeyValuePair[]>([]);
  const [speakDuringExecution, setSpeakDuringExecution] = useState(false);
  const [speakAfterExecution, setSpeakAfterExecution] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Reset form when dialog opens or tool changes
  useEffect(() => {
    if (open) {
      if (tool) {
        setName(tool.name ?? "");
        setDescription(tool.description ?? "");
        setMethod(tool.method ?? "POST");
        setUrl(tool.url ?? "");
        setTimeoutMs(tool.timeout_ms);
        setHeaders(recordToKvPairs(tool.headers));
        setQueryParams(recordToKvPairs(tool.query_params));
        setParameterRows(parametersToRows(tool.parameters));
        setParametersJson(parametersToJson(tool.parameters));
        setResponseVariables(recordToKvPairs(tool.response_variables));
        setSpeakDuringExecution(tool.speak_during_execution ?? false);
        setSpeakAfterExecution(tool.speak_after_execution ?? false);
      } else {
        setName("");
        setDescription("");
        setMethod("POST");
        setUrl("");
        setTimeoutMs(undefined);
        setHeaders([]);
        setQueryParams([]);
        setParameterRows([]);
        setParametersJson("{}");
        setResponseVariables([]);
        setSpeakDuringExecution(false);
        setSpeakAfterExecution(false);
      }
      setParametersViewMode("form");
      setJsonError(null);
    }
  }, [open, tool]);

  // Sync parameter rows to JSON when switching to JSON view
  const handleViewModeChange = useCallback(
    (mode: string) => {
      if (mode === "json") {
        const params = rowsToParameters(parameterRows);
        setParametersJson(parametersToJson(params));
        setJsonError(null);
      } else if (mode === "form") {
        const params = jsonToParameters(parametersJson);
        if (params) {
          setParameterRows(parametersToRows(params));
          setJsonError(null);
        }
      }
      setParametersViewMode(mode as "form" | "json");
    },
    [parameterRows, parametersJson]
  );

  const handleSave = useCallback(() => {
    let parameters: ConversationFlowCustomTool["parameters"] | undefined;
    if (parametersViewMode === "form") {
      parameters = rowsToParameters(parameterRows);
    } else {
      parameters = jsonToParameters(parametersJson);
      if (parametersJson.trim() !== "{}" && parametersJson.trim() !== "" && !parameters) {
        setJsonError("Invalid JSON schema");
        return;
      }
    }

    const result: ConversationFlowCustomTool = {
      type: "custom",
      name: name.trim(),
      url: url.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(method !== "POST" ? { method } : { method }),
      ...(timeoutMs !== undefined ? { timeout_ms: timeoutMs } : {}),
      ...(() => {
        const h = kvPairsToRecord(headers);
        return h ? { headers: h } : {};
      })(),
      ...(() => {
        const q = kvPairsToRecord(queryParams);
        return q ? { query_params: q } : {};
      })(),
      ...(parameters ? { parameters } : {}),
      ...(() => {
        const r = kvPairsToRecord(responseVariables);
        return r ? { response_variables: r } : {};
      })(),
      ...(speakDuringExecution ? { speak_during_execution: true } : {}),
      ...(speakAfterExecution ? { speak_after_execution: true } : {}),
      ...(tool?.tool_id ? { tool_id: tool.tool_id } : {}),
    };

    onSave(result);
  }, [
    name,
    description,
    method,
    url,
    timeoutMs,
    headers,
    queryParams,
    parameterRows,
    parametersJson,
    parametersViewMode,
    responseVariables,
    speakDuringExecution,
    speakAfterExecution,
    tool,
    onSave,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-2xl p-0"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted">
            <Code2 className="size-4 text-muted-foreground" />
          </div>
          <DialogTitle className="flex-1 text-base font-semibold">
            Custom Function
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable form body */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. get_customer_info"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Description{" "}
                <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Textarea
                placeholder="Describe what this function does..."
                className="min-h-20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Separator />

            {/* API Endpoint */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">API Endpoint</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={method}
                  onValueChange={(val) =>
                    setMethod(val as "GET" | "POST" | "PUT" | "PATCH" | "DELETE")
                  }
                >
                  <SelectTrigger className="w-28 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="https://api.example.com/endpoint"
                  className="flex-1"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Timeout (ms)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  className="flex-1"
                  value={timeoutMs ?? ""}
                  onChange={(e) =>
                    setTimeoutMs(e.target.value ? Number(e.target.value) : undefined)
                  }
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  milliseconds
                </span>
              </div>
            </div>

            <Separator />

            {/* Headers */}
            <KeyValuePairEditor
              label="Headers"
              pairs={headers}
              onChange={setHeaders}
            />

            <Separator />

            {/* Query Parameters */}
            <KeyValuePairEditor
              label="Query Parameters"
              pairs={queryParams}
              onChange={setQueryParams}
            />

            <Separator />

            {/* Parameters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Parameters{" "}
                  <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Tabs
                  value={parametersViewMode}
                  onValueChange={handleViewModeChange}
                  className="w-auto"
                >
                  <TabsList className="h-7">
                    <TabsTrigger value="form" className="px-3 text-xs">
                      Form
                    </TabsTrigger>
                    <TabsTrigger value="json" className="px-3 text-xs">
                      JSON
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {parametersViewMode === "form" ? (
                <div className="space-y-2">
                  {parameterRows.length > 0 && (
                    <div className="rounded-md border">
                      {/* Table header */}
                      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                        <div className="w-[28%]">Parameter Name</div>
                        <div className="w-[28%]">Detail</div>
                        <div className="w-[20%]">Type</div>
                        <div className="w-[14%] text-center">Required</div>
                        <div className="w-[10%]" />
                      </div>
                      {/* Table rows */}
                      {parameterRows.map((row, i) => (
                        <div
                          key={row.id}
                          className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0"
                        >
                          <div className="w-[28%]">
                            <Input
                              placeholder="name"
                              className="h-8 text-sm"
                              value={row.name}
                              onChange={(e) => {
                                const updated = [...parameterRows];
                                updated[i] = { ...row, name: e.target.value };
                                setParameterRows(updated);
                              }}
                            />
                          </div>
                          <div className="w-[28%]">
                            <Input
                              placeholder="description"
                              className="h-8 text-sm"
                              value={row.description}
                              onChange={(e) => {
                                const updated = [...parameterRows];
                                updated[i] = { ...row, description: e.target.value };
                                setParameterRows(updated);
                              }}
                            />
                          </div>
                          <div className="w-[20%]">
                            <Select
                              value={row.type}
                              onValueChange={(val) => {
                                const updated = [...parameterRows];
                                updated[i] = {
                                  ...row,
                                  type: val as "string" | "number" | "boolean",
                                };
                                setParameterRows(updated);
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">string</SelectItem>
                                <SelectItem value="number">number</SelectItem>
                                <SelectItem value="boolean">boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-[14%] flex justify-center">
                            <Checkbox
                              checked={row.required}
                              onCheckedChange={(checked) => {
                                const updated = [...parameterRows];
                                updated[i] = { ...row, required: !!checked };
                                setParameterRows(updated);
                              }}
                            />
                          </div>
                          <div className="w-[10%] flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                setParameterRows(
                                  parameterRows.filter((_, j) => j !== i)
                                )
                              }
                            >
                              <Trash2 className="size-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() =>
                      setParameterRows([
                        ...parameterRows,
                        {
                          id: makeParamId(),
                          name: "",
                          description: "",
                          type: "string",
                          required: false,
                        },
                      ])
                    }
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Textarea
                    className="min-h-40 font-mono text-sm"
                    value={parametersJson}
                    onChange={(e) => {
                      setParametersJson(e.target.value);
                      setJsonError(null);
                    }}
                  />
                  {jsonError && (
                    <p className="text-xs text-destructive">{jsonError}</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Store Fields as Variables */}
            <KeyValuePairEditor
              label="Store Fields as Variables"
              pairs={responseVariables}
              onChange={setResponseVariables}
            />

            <Separator />

            {/* Speak During Execution */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="speak-during"
                checked={speakDuringExecution}
                onCheckedChange={(checked) => setSpeakDuringExecution(!!checked)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="speak-during" className="text-sm font-medium cursor-pointer">
                  Speak During Execution
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow the agent to speak while the function is being executed, reducing
                  perceived latency.
                </p>
              </div>
            </div>

            {/* Speak After Execution */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="speak-after"
                checked={speakAfterExecution}
                onCheckedChange={(checked) => setSpeakAfterExecution(!!checked)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="speak-after" className="text-sm font-medium cursor-pointer">
                  Speak After Execution
                </Label>
                <p className="text-xs text-muted-foreground">
                  Have the agent speak a response after the function execution completes
                  with the result.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <Button type="button" variant="outline" size="sm">
            Test
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!name.trim() || !url.trim()}
              onClick={handleSave}
            >
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cal.com Tool Dialog ────────────────────────────────────────────────────

interface CalToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: CheckAvailabilityCalTool | BookAppointmentCalTool | null;
  toolType: "check_availability_cal" | "book_appointment_cal";
  onSave: (tool: CheckAvailabilityCalTool | BookAppointmentCalTool) => void;
}

const CAL_TOOL_LABELS: Record<string, string> = {
  check_availability_cal: "Check Availability",
  book_appointment_cal: "Book Appointment",
};

export function CalToolDialog({
  open,
  onOpenChange,
  tool,
  toolType,
  onSave,
}: CalToolDialogProps) {
  const isEditing = tool !== null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [calApiKey, setCalApiKey] = useState("");
  const [eventTypeId, setEventTypeId] = useState<number | undefined>(undefined);
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    if (open) {
      if (tool) {
        setName(tool.name ?? "");
        setDescription(tool.description ?? "");
        setCalApiKey(tool.cal_api_key ?? "");
        setEventTypeId(tool.event_type_id);
        setTimezone(tool.timezone ?? "");
      } else {
        setName("");
        setDescription("");
        setCalApiKey("");
        setEventTypeId(undefined);
        setTimezone("");
      }
    }
  }, [open, tool]);

  const handleSave = useCallback(() => {
    const base = {
      name: name.trim(),
      cal_api_key: calApiKey.trim(),
      event_type_id: eventTypeId ?? 0,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(timezone.trim() ? { timezone: timezone.trim() } : {}),
      ...(tool?.tool_id ? { tool_id: tool.tool_id } : {}),
    };

    if (toolType === "check_availability_cal") {
      onSave({ ...base, type: "check_availability_cal" } as CheckAvailabilityCalTool);
    } else {
      onSave({ ...base, type: "book_appointment_cal" } as BookAppointmentCalTool);
    }
  }, [name, description, calApiKey, eventTypeId, timezone, toolType, tool, onSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-lg p-0"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted">
            <Calendar className="size-4 text-muted-foreground" />
          </div>
          <DialogTitle className="flex-1 text-base font-semibold">
            {CAL_TOOL_LABELS[toolType] ?? "Cal.com Tool"}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Form body */}
        <div className="space-y-6 px-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. check_availability"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              placeholder="Describe what this tool does..."
              className="min-h-20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Separator />

          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">API Key (Cal.com)</Label>
            <Input
              type="password"
              placeholder="cal_live_..."
              value={calApiKey}
              onChange={(e) => setCalApiKey(e.target.value)}
            />
          </div>

          {/* Event Type ID */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Event Type ID (Cal.com)</Label>
            <Input
              type="number"
              placeholder="e.g. 12345"
              value={eventTypeId ?? ""}
              onChange={(e) =>
                setEventTypeId(e.target.value ? Number(e.target.value) : undefined)
              }
            />
            <p className="text-xs text-muted-foreground">
              Learn more about finding your Event Type ID in the{" "}
              <a
                href="https://cal.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Cal.com documentation
              </a>
              .
            </p>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Timezone{" "}
              <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              placeholder="e.g. America/New_York"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!name.trim() || !calApiKey.trim() || eventTypeId === undefined}
            onClick={handleSave}
          >
            {isEditing ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tool Config Dialog (end_call, call_transfer, agent_transfer, press_digit, sms, extract_variable) ──

type ToolConfigType =
  | "end_call"
  | "transfer_call"
  | "agent_swap"
  | "press_digit"
  | "send_sms"
  | "extract_dynamic_variable";

const TOOL_CONFIG_META: Record<
  ToolConfigType,
  { label: string; icon: React.ElementType; namePlaceholder: string }
> = {
  end_call: { label: "End Call", icon: Phone, namePlaceholder: "e.g. end_call" },
  transfer_call: {
    label: "Call Transfer",
    icon: PhoneForwarded,
    namePlaceholder: "e.g. transfer_to_support",
  },
  agent_swap: {
    label: "Agent Transfer",
    icon: ArrowRightLeft,
    namePlaceholder: "e.g. transfer_to_agent",
  },
  press_digit: {
    label: "Press Digit (IVR Navigation)",
    icon: Hash,
    namePlaceholder: "e.g. press_digit_ivr",
  },
  send_sms: { label: "Send SMS", icon: MessageCircle, namePlaceholder: "e.g. send_sms" },
  extract_dynamic_variable: {
    label: "Extract Variable",
    icon: Braces,
    namePlaceholder: "e.g. extract_customer_email",
  },
};

interface VariableRow {
  id: string;
  name: string;
  description: string;
  type: "string" | "number" | "boolean";
}

function makeVarId() {
  return `var_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface ToolConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolType: ToolConfigType;
  tool: ConversationFlowTool | null;
  onSave: (tool: ConversationFlowTool) => void;
}

export function ToolConfigDialog({
  open,
  onOpenChange,
  toolType,
  tool,
  onSave,
}: ToolConfigDialogProps) {
  const isEditing = tool !== null;
  const meta = TOOL_CONFIG_META[toolType];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // call_transfer fields
  const [transferNumber, setTransferNumber] = useState("");
  const [showTransfereeAsCaller, setShowTransfereeAsCaller] = useState(false);
  // agent_transfer fields
  const [agentId, setAgentId] = useState("");
  // extract_variable fields
  const [variables, setVariables] = useState<VariableRow[]>([]);

  useEffect(() => {
    if (open) {
      if (tool) {
        setName(tool.name ?? "");
        setDescription(tool.description ?? "");
        if (tool.type === "transfer_call") {
          setTransferNumber(tool.number ?? "");
          setShowTransfereeAsCaller(tool.show_transferee_as_caller ?? false);
        }
        if (tool.type === "agent_swap") {
          setAgentId(tool.agent_id ?? "");
        }
        if (tool.type === "extract_dynamic_variable" && tool.variables) {
          setVariables(
            tool.variables.map((v) => ({ id: makeVarId(), ...v }))
          );
        }
      } else {
        setName("");
        setDescription("");
        setTransferNumber("");
        setShowTransfereeAsCaller(false);
        setAgentId("");
        setVariables([]);
      }
    }
  }, [open, tool]);

  const handleSave = useCallback(() => {
    const base = {
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(tool && "tool_id" in tool && tool.tool_id
        ? { tool_id: tool.tool_id }
        : {}),
    };

    switch (toolType) {
      case "end_call":
        onSave({ ...base, type: "end_call" } as EndCallTool);
        break;
      case "transfer_call":
        onSave({
          ...base,
          type: "transfer_call",
          ...(transferNumber.trim() ? { number: transferNumber.trim() } : {}),
          ...(showTransfereeAsCaller
            ? { show_transferee_as_caller: true }
            : {}),
        } as TransferCallTool);
        break;
      case "agent_swap":
        onSave({
          ...base,
          type: "agent_swap",
          agent_id: agentId.trim(),
        } as AgentSwapTool);
        break;
      case "press_digit":
        onSave({ ...base, type: "press_digit" } as PressDigitTool);
        break;
      case "send_sms":
        onSave({ ...base, type: "send_sms" } as SendSMSTool);
        break;
      case "extract_dynamic_variable": {
        const filteredVars = variables
          .filter((v) => v.name.trim())
          .map(({ name: vName, description: vDesc, type: vType }) => ({
            name: vName,
            description: vDesc,
            type: vType,
          }));
        onSave({
          ...base,
          type: "extract_dynamic_variable",
          ...(filteredVars.length > 0 ? { variables: filteredVars } : {}),
        } as ExtractDynamicVariableTool);
        break;
      }
    }
  }, [
    name,
    description,
    toolType,
    transferNumber,
    showTransfereeAsCaller,
    agentId,
    variables,
    tool,
    onSave,
  ]);

  const isValid = (() => {
    if (!name.trim()) return false;
    if (toolType === "agent_swap" && !agentId.trim()) return false;
    return true;
  })();

  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-lg p-0"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <DialogTitle className="flex-1 text-base font-semibold">
            {meta.label}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Form body */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder={meta.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (Optional)
                </span>
              </Label>
              <Textarea
                placeholder="Describe what this tool does..."
                className="min-h-20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* transfer_call: phone number */}
            {toolType === "transfer_call" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Transfer Phone Number
                  </Label>
                  <Input
                    placeholder="+1 (555) 123-4567"
                    value={transferNumber}
                    onChange={(e) => setTransferNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The phone number to transfer the call to. Leave empty to
                    have the agent infer it from context.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="show-transferee"
                    checked={showTransfereeAsCaller}
                    onCheckedChange={(checked) =>
                      setShowTransfereeAsCaller(!!checked)
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="show-transferee"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Show transferee as caller
                  </Label>
                </div>
              </>
            )}

            {/* agent_swap: agent ID */}
            {toolType === "agent_swap" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Agent ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="agent_..."
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The Retell agent ID to transfer the conversation to.
                  </p>
                </div>
              </>
            )}

            {/* extract_dynamic_variable: variables list */}
            {toolType === "extract_dynamic_variable" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Variables</Label>
                  {variables.length > 0 && (
                    <div className="space-y-2">
                      {variables.map((v, i) => (
                        <div
                          key={v.id}
                          className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3"
                        >
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Variable name"
                              className="text-sm"
                              value={v.name}
                              onChange={(e) => {
                                const updated = [...variables];
                                updated[i] = { ...v, name: e.target.value };
                                setVariables(updated);
                              }}
                            />
                            <Input
                              placeholder="Description"
                              className="text-sm"
                              value={v.description}
                              onChange={(e) => {
                                const updated = [...variables];
                                updated[i] = {
                                  ...v,
                                  description: e.target.value,
                                };
                                setVariables(updated);
                              }}
                            />
                            <Select
                              value={v.type}
                              onValueChange={(val) => {
                                const updated = [...variables];
                                updated[i] = {
                                  ...v,
                                  type: val as "string" | "number" | "boolean",
                                };
                                setVariables(updated);
                              }}
                            >
                              <SelectTrigger className="w-32 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">string</SelectItem>
                                <SelectItem value="number">number</SelectItem>
                                <SelectItem value="boolean">boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              setVariables(
                                variables.filter((_, j) => j !== i)
                              )
                            }
                          >
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() =>
                      setVariables([
                        ...variables,
                        {
                          id: makeVarId(),
                          name: "",
                          description: "",
                          type: "string",
                        },
                      ])
                    }
                  >
                    <Plus className="size-3.5" />
                    Add Variable
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isValid}
            onClick={handleSave}
          >
            {isEditing ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
