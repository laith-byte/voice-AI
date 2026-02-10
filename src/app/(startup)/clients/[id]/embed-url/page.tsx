"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Save, Globe, Info } from "lucide-react";

export default function EmbedUrlPage() {
  const params = useParams();
  const [domain, setDomain] = useState("");

  const handleSave = () => {
    // TODO: API call to save embed domain
    console.log("Saving embed domain:", domain, "for client:", params.id);
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
                White-label embed URL configuration is planned for Phase 2.
                You can set up the domain now and it will be activated when
                the feature is released.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Configuration */}
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Embed Domain</CardTitle>
              <p className="text-sm text-[#6b7280] mt-0.5">
                Configure the domain for white-label widget embedding
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="embed-domain">Allowed Domain</Label>
            <Input
              id="embed-domain"
              placeholder="https://app.clientdomain.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <p className="text-xs text-[#6b7280]">
              Enter the domain where the client will embed the widget. The
              widget will only load on this domain for security purposes.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-[#e5e7eb]">
            <p className="text-xs font-medium text-[#111827] mb-2">
              Embed Code Preview
            </p>
            <pre className="text-xs text-[#6b7280] bg-white p-3 rounded border border-[#e5e7eb] overflow-x-auto">
              <code>{`<script src="https://embed.invarialabs.com/widget.js"
  data-client-id="${params.id}"
  data-domain="${domain || 'your-domain.com'}"
></script>`}</code>
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleSave}
              disabled={!domain.trim()}
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save Domain
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
