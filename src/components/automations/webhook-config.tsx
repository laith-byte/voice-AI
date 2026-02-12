"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface WebhookConfigProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  error?: string;
}

export function WebhookConfig({
  label,
  value,
  onChange,
  required,
  placeholder,
  helpText,
  error,
}: WebhookConfigProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  async function handleTest() {
    if (!value) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/automations/webhook-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_url: value }),
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success
          ? `Test payload sent successfully (${data.status_code})`
          : `Failed: ${data.error}`,
      });
    } catch {
      setTestResult({ success: false, message: "Failed to send test" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          type="url"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setTestResult(null);
          }}
          placeholder={placeholder || "https://hooks.example.com/..."}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!value || testing}
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
        </Button>
      </div>
      {helpText && (
        <p className="text-muted-foreground text-xs">{helpText}</p>
      )}
      {testResult && (
        <div
          className={`flex items-center gap-1.5 text-xs ${
            testResult.success ? "text-green-600" : "text-destructive"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {testResult.message}
        </div>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
