"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Sheet {
  id: string;
  name: string;
  lastModified: string;
}

interface GoogleSheetPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}

export function GoogleSheetPicker({
  label,
  value,
  onChange,
  required,
  placeholder,
  error,
}: GoogleSheetPickerProps) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSheets() {
      setLoading(true);
      try {
        const res = await fetch("/api/oauth/google/sheets");
        if (res.ok) {
          const data = await res.json();
          setSheets(data.sheets || []);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchSheets();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading spreadsheets...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder || "Select a spreadsheet"} />
        </SelectTrigger>
        <SelectContent>
          {sheets.map((sheet) => (
            <SelectItem key={sheet.id} value={sheet.id}>
              {sheet.name}
            </SelectItem>
          ))}
          {sheets.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">
              No spreadsheets found
            </div>
          )}
        </SelectContent>
      </Select>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
