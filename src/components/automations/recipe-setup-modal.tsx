"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { OAuthConnectButton } from "@/components/automations/oauth-connect-button";
import { GoogleSheetPicker } from "@/components/automations/resource-pickers/google-sheet-picker";
import { GoogleCalendarPicker } from "@/components/automations/resource-pickers/google-calendar-picker";
import { SlackChannelPicker } from "@/components/automations/resource-pickers/slack-channel-picker";
import { WebhookConfig } from "@/components/automations/webhook-config";

type FieldDef = {
  key: string;
  label: string;
  type:
    | "text"
    | "url"
    | "email"
    | "select"
    | "multi_select"
    | "toggle"
    | "number"
    | "oauth_connect"
    | "resource_picker"
    | "webhook_config";
  required?: boolean;
  placeholder?: string;
  default?: string | number | boolean;
  options?: string[];
  help_text?: string;
  provider?: string;
  picker_type?: string;
  depends_on?: string;
};

interface OAuthConnection {
  provider: string;
  provider_email: string | null;
}

interface RecipeSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: {
    id: string;
    name: string;
    icon: string | null;
    long_description: string | null;
    config_schema: FieldDef[];
    what_gets_sent: string[] | null;
  } | null;
  existingConfig?: Record<string, unknown>;
  saving?: boolean;
  onSave: (recipeId: string, config: Record<string, unknown>) => void;
  clientId?: string;
  oauthConnections?: OAuthConnection[];
  onConnectionChange?: () => void;
}

function buildInitialValues(
  schema: FieldDef[],
  existingConfig?: Record<string, unknown>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of schema) {
    if (field.type === "oauth_connect") continue; // not a form value
    if (existingConfig && field.key in existingConfig) {
      values[field.key] = existingConfig[field.key];
    } else if (field.default !== undefined) {
      values[field.key] = field.default;
    } else if (field.type === "toggle") {
      values[field.key] = false;
    } else if (field.type === "multi_select") {
      values[field.key] = [];
    } else if (field.type === "number") {
      values[field.key] = "";
    } else {
      values[field.key] = "";
    }
  }
  return values;
}

export function RecipeSetupModal({
  open,
  onOpenChange,
  recipe,
  existingConfig,
  saving,
  onSave,
  clientId,
  oauthConnections,
  onConnectionChange,
}: RecipeSetupModalProps) {
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Re-initialize form values when the recipe or existingConfig changes, or when the modal opens
  useEffect(() => {
    if (recipe && open) {
      setFormValues(
        buildInitialValues(recipe.config_schema, existingConfig)
      );
      setErrors({});
    }
  }, [recipe, existingConfig, open]);

  const updateField = useCallback((key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  const isProviderConnected = useCallback(
    (provider: string): boolean => {
      return oauthConnections?.some((c) => c.provider === provider) ?? false;
    },
    [oauthConnections]
  );

  const getConnection = useCallback(
    (provider: string): OAuthConnection | null => {
      return oauthConnections?.find((c) => c.provider === provider) ?? null;
    },
    [oauthConnections]
  );

  const validate = useCallback((): boolean => {
    if (!recipe) return false;
    const newErrors: Record<string, string> = {};

    for (const field of recipe.config_schema) {
      if (field.type === "oauth_connect") {
        // Check if OAuth is connected
        if (field.required && field.provider && !isProviderConnected(field.provider)) {
          newErrors[field.key] = `Please connect your ${field.provider} account`;
        }
        continue;
      }

      // Skip validation for fields whose dependency isn't met
      if (field.depends_on) {
        const depField = recipe.config_schema.find((f) => f.key === field.depends_on);
        if (depField?.type === "oauth_connect" && depField.provider) {
          if (!isProviderConnected(depField.provider)) continue;
        }
      }

      if (!field.required) continue;

      const value = formValues[field.key];

      if (field.type === "multi_select") {
        if (!Array.isArray(value) || value.length === 0) {
          newErrors[field.key] = `${field.label} is required`;
        }
      } else if (field.type === "toggle") {
        // toggles always have a value, skip validation
      } else if (field.type === "number") {
        if (value === "" || value === undefined || value === null) {
          newErrors[field.key] = `${field.label} is required`;
        }
      } else {
        if (
          !value ||
          (typeof value === "string" && value.trim().length === 0)
        ) {
          newErrors[field.key] = `${field.label} is required`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [recipe, formValues, isProviderConnected]);

  const handleSubmit = useCallback(() => {
    if (!recipe || saving) return;
    if (!validate()) return;

    // Clean up number fields: convert string values to numbers
    const cleanedValues = { ...formValues };
    for (const field of recipe.config_schema) {
      if (field.type === "number" && cleanedValues[field.key] !== "") {
        cleanedValues[field.key] = Number(cleanedValues[field.key]);
      }
    }

    onSave(recipe.id, cleanedValues);
  }, [recipe, saving, validate, formValues, onSave]);

  if (!recipe) return null;

  const renderField = (field: FieldDef) => {
    const value = formValues[field.key];
    const error = errors[field.key];

    // Check if a dependency is satisfied
    if (field.depends_on) {
      const depField = recipe.config_schema.find((f) => f.key === field.depends_on);
      if (depField?.type === "oauth_connect" && depField.provider) {
        if (!isProviderConnected(depField.provider)) {
          return null; // Hide until OAuth is connected
        }
      }
    }

    switch (field.type) {
      case "oauth_connect":
        return (
          <div key={field.key} className="space-y-2">
            <Label>{field.label}</Label>
            <OAuthConnectButton
              provider={field.provider || ""}
              clientId={clientId || ""}
              connection={getConnection(field.provider || "")}
              onDisconnected={onConnectionChange}
            />
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
        );

      case "resource_picker":
        switch (field.picker_type) {
          case "google-sheet":
            return (
              <GoogleSheetPicker
                key={field.key}
                label={field.label}
                value={(value as string) ?? ""}
                onChange={(v) => updateField(field.key, v)}
                required={field.required}
                placeholder={field.placeholder}
                error={error}
              />
            );
          case "google-calendar":
            return (
              <GoogleCalendarPicker
                key={field.key}
                label={field.label}
                value={(value as string) ?? ""}
                onChange={(v) => updateField(field.key, v)}
                required={field.required}
                placeholder={field.placeholder}
                error={error}
              />
            );
          case "slack-channel":
            return (
              <SlackChannelPicker
                key={field.key}
                label={field.label}
                value={(value as string) ?? ""}
                onChange={(v) => updateField(field.key, v)}
                required={field.required}
                placeholder={field.placeholder}
                error={error}
              />
            );
          default:
            return null;
        }

      case "webhook_config":
        return (
          <WebhookConfig
            key={field.key}
            label={field.label}
            value={(value as string) ?? ""}
            onChange={(v) => updateField(field.key, v)}
            required={field.required}
            placeholder={field.placeholder}
            helpText={field.help_text}
            error={error}
          />
        );

      case "text":
      case "url":
      case "email":
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Input
              id={field.key}
              type={field.type}
              placeholder={field.placeholder}
              value={(value as string) ?? ""}
              onChange={(e) => updateField(field.key, e.target.value)}
            />
            {field.help_text && (
              <p className="text-muted-foreground text-xs">
                {field.help_text}
              </p>
            )}
            {error && (
              <p className="text-destructive text-xs">{error}</p>
            )}
          </div>
        );

      case "number":
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Input
              id={field.key}
              type="number"
              placeholder={field.placeholder}
              value={(value as string | number) ?? ""}
              onChange={(e) => updateField(field.key, e.target.value)}
            />
            {field.help_text && (
              <p className="text-muted-foreground text-xs">
                {field.help_text}
              </p>
            )}
            {error && (
              <p className="text-destructive text-xs">{error}</p>
            )}
          </div>
        );

      case "select":
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Select
              value={(value as string) ?? ""}
              onValueChange={(v) => updateField(field.key, v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={field.placeholder ?? "Select an option"}
                />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.help_text && (
              <p className="text-muted-foreground text-xs">
                {field.help_text}
              </p>
            )}
            {error && (
              <p className="text-destructive text-xs">{error}</p>
            )}
          </div>
        );

      case "multi_select":
        return (
          <div key={field.key} className="space-y-2">
            <Label>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <div className="space-y-2">
              {field.options?.map((option) => {
                const selected = Array.isArray(value)
                  ? (value as string[])
                  : [];
                const isChecked = selected.includes(option);
                return (
                  <div
                    key={option}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`${field.key}-${option}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateField(field.key, [...selected, option]);
                        } else {
                          updateField(
                            field.key,
                            selected.filter((s) => s !== option)
                          );
                        }
                      }}
                    />
                    <Label
                      htmlFor={`${field.key}-${option}`}
                      className="font-normal cursor-pointer"
                    >
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
            {field.help_text && (
              <p className="text-muted-foreground text-xs">
                {field.help_text}
              </p>
            )}
            {error && (
              <p className="text-destructive text-xs">{error}</p>
            )}
          </div>
        );

      case "toggle":
        return (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.help_text && (
                  <p className="text-muted-foreground text-xs">
                    {field.help_text}
                  </p>
                )}
              </div>
              <Switch
                id={field.key}
                checked={Boolean(value)}
                onCheckedChange={(checked) =>
                  updateField(field.key, checked)
                }
              />
            </div>
            {error && (
              <p className="text-destructive text-xs">{error}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {recipe.icon && <span className="text-xl">{recipe.icon}</span>}
            {recipe.name}
          </DialogTitle>
          {recipe.long_description && (
            <DialogDescription>{recipe.long_description}</DialogDescription>
          )}
        </DialogHeader>

        {recipe.what_gets_sent && recipe.what_gets_sent.length > 0 && (
          <div className="bg-muted/50 rounded-md px-4 py-3 space-y-2">
            <p className="text-sm font-medium">What gets sent:</p>
            <ul className="space-y-1.5">
              {recipe.what_gets_sent.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recipe.config_schema.length > 0 && (
          <div className="space-y-4">
            {recipe.config_schema.map((field) => renderField(field))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {existingConfig ? "Save Changes" : "Enable Automation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
