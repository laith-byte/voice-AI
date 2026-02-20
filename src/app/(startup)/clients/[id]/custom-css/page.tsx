"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Save, Code, Info, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export default function CustomCssPage() {
  const [css, setCss] = useState("");

  const handleSave = () => {
    toast.info("Custom CSS saving coming soon.");
  };

  return (
    <div className="space-y-6">
      {/* Phase 2 Notice */}
      <Card className="rounded-lg border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-amber-800">
                  Phase 2 Feature
                </p>
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-700 border-amber-300 text-xs"
                >
                  Coming Soon
                </Badge>
              </div>
              <p className="text-xs text-amber-700 mt-0.5">
                Custom CSS injection is planned for Phase 2. You can prepare
                your styles now and they will be applied when the feature is
                released.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSS Editor */}
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Code className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">Custom CSS</CardTitle>
              <p className="text-sm text-[#6b7280] mt-0.5">
                Add custom CSS to override the client dashboard styles
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-css">CSS Code</Label>
            <Textarea
              id="custom-css"
              placeholder={`/* Custom styles for this client's dashboard */\n\n.header {\n  background-color: #1a1a2e;\n}\n\n.sidebar {\n  border-right: 1px solid #e5e7eb;\n}`}
              value={css}
              onChange={(e) => setCss(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          {/* Tip */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-800">
                  Tip: Finding Class Names
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Use your browser&apos;s inspect tool (right-click and select
                  &quot;Inspect&quot;) to find the class names of elements you
                  want to style. You can target specific components using the
                  data-slot attributes or standard CSS selectors.
                </p>
              </div>
            </div>
          </div>

          {/* Preview Info */}
          <div className="bg-gray-50 rounded-lg p-4 border border-[#e5e7eb]">
            <p className="text-xs font-medium text-[#111827] mb-2">
              CSS Preview
            </p>
            <pre className="text-xs text-[#6b7280] bg-white p-3 rounded border border-[#e5e7eb] overflow-x-auto min-h-[60px]">
              <code>
                {css || "/* Your custom CSS will appear here */"}
              </code>
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleSave}
              disabled={!css.trim()}
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save CSS
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
