"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Phone,
  Mic,
  MicOff,
  Rocket,
  Building2,
  Globe,
  MapPin,
  User,
  Mail,
  Sparkles,
  AlertTriangle,
  Zap,
} from "lucide-react";
import confetti from "canvas-confetti";
import { RetellWebClient } from "retell-client-js-sdk";
import { createClient } from "@/lib/supabase/client";

import { WizardProgress } from "@/components/onboarding/wizard-progress";
import { TestCallCoaching } from "@/components/onboarding/test-call-coaching";
import { TestCallTranscript } from "@/components/onboarding/test-call-transcript";
import { TestCallReport } from "@/components/onboarding/test-call-report";
import { QuickFixModal } from "@/components/onboarding/quick-fix-modal";

import { HoursEditor } from "@/components/business-settings/hours-editor";
import { ServicesList } from "@/components/business-settings/services-list";
import { FaqsList } from "@/components/business-settings/faqs-list";
import { PoliciesList } from "@/components/business-settings/policies-list";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestScenario {
  title: string;
  description: string;
  opening: string;
}

interface Template {
  id: string;
  name: string;
  vertical: string;
  icon: string;
  description: string | null;
  industry: string | null;
  use_case: string | null;
  industry_icon: string | null;
  use_case_icon: string | null;
  use_case_description: string | null;
  test_scenarios: TestScenario[] | null;
  default_services: { name: string }[] | null;
  default_faqs: { question: string }[] | null;
  default_policies: { name: string }[] | null;
}

interface Industry {
  slug: string;
  name: string;
  icon: string;
}

const USE_CASE_LABELS: Record<string, string> = {
  lead_qualification: "Lead Qualification",
  customer_support: "Customer Support",
  receptionist: "Receptionist",
  dispatch: "Dispatch Service",
};

interface TranscriptEntry {
  role: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OnboardingWizardPage() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Core state
  // ---------------------------------------------------------------------------
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Step 1 state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  // Step 2 state
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Step 4 state
  const [afterHoursBehavior, setAfterHoursBehavior] = useState("callback");
  const [unanswerableBehavior, setUnanswerableBehavior] = useState("message");
  const [escalationPhone, setEscalationPhone] = useState("");
  const [maxCallDuration, setMaxCallDuration] = useState("10");
  const [emailSummary, setEmailSummary] = useState(true);
  const [logToDashboard, setLogToDashboard] = useState(true);
  const [followUpText, setFollowUpText] = useState(false);

  // Step 5 state
  const retellClient = useRef<RetellWebClient | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [callStarting, setCallStarting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [testCallCompleted, setTestCallCompleted] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [showQuickFix, setShowQuickFix] = useState(false);
  const callStartTimeRef = useRef<number | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);

  // Step 6 state
  const [phoneOption, setPhoneOption] = useState("temporary");
  const [goingLive, setGoingLive] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch onboarding status & templates on mount
  // ---------------------------------------------------------------------------
  const fetchInitialData = useCallback(async () => {
    try {
      // Fetch onboarding status
      let savedTemplateId: string | null = null;
      const statusRes = await fetch("/api/onboarding/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();

        if (statusData.status === "completed") {
          router.replace(`/${clientSlug}/portal`);
          return;
        }

        if (statusData.status === "in_progress" && statusData.current_step) {
          setStep(statusData.current_step);
        }

        // Restore previously saved data from the flat onboarding record
        if (statusData.vertical_template_id) {
          setSelectedTemplate(statusData.vertical_template_id);
          savedTemplateId = statusData.vertical_template_id;
        }
        if (statusData.business_name) setBusinessName(statusData.business_name);
        if (statusData.business_phone) setBusinessPhone(statusData.business_phone);
        if (statusData.business_website) setBusinessWebsite(statusData.business_website);
        if (statusData.business_address) setBusinessAddress(statusData.business_address);
        if (statusData.contact_name) setContactName(statusData.contact_name);
        if (statusData.contact_email) setContactEmail(statusData.contact_email);
        if (statusData.after_hours_behavior) setAfterHoursBehavior(statusData.after_hours_behavior);
        if (statusData.unanswerable_behavior) setUnanswerableBehavior(statusData.unanswerable_behavior);
        if (statusData.escalation_phone) setEscalationPhone(statusData.escalation_phone);
        if (statusData.max_call_duration_minutes) setMaxCallDuration(statusData.max_call_duration_minutes);
        if (statusData.post_call_email_summary !== undefined) setEmailSummary(statusData.post_call_email_summary);
        if (statusData.post_call_log !== undefined) setLogToDashboard(statusData.post_call_log);
        if (statusData.post_call_followup_text !== undefined) setFollowUpText(statusData.post_call_followup_text);
        if (statusData.test_call_completed) setTestCallCompleted(true);
      }

      // Fetch wizard-enabled templates from supabase
      const supabase = createClient();
      const { data: templateData } = await supabase
        .from("agent_templates")
        .select("id, name, vertical, icon, description, industry, use_case, industry_icon, use_case_icon, use_case_description, test_scenarios, default_services, default_faqs, default_policies")
        .eq("wizard_enabled", true)
        .order("name");

      if (templateData) {
        setTemplates(templateData as Template[]);
        // If a template was previously selected, restore the industry too
        if (savedTemplateId) {
          const match = (templateData as Template[]).find((t) => t.id === savedTemplateId);
          if (match?.industry) {
            setSelectedIndustry(match.industry);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load onboarding data:", err);
      toast.error("Failed to load onboarding data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [clientSlug, router]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------

  async function saveStep(stepNum: number, data: Record<string, unknown> = {}) {
    const res = await fetch(`/api/onboarding/step/${stepNum}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error ?? "Failed to save step");
    }
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  async function handleStep1Continue() {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      // Start onboarding
      await fetch("/api/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical_template_id: selectedTemplate }),
      });
      // Save step 1
      await saveStep(1, { vertical_template_id: selectedTemplate });
      setStep(2);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2Continue() {
    if (!businessName.trim()) return;
    setSaving(true);
    try {
      // Save step 2 data
      await saveStep(2, {
        business_name: businessName.trim(),
        business_phone: businessPhone.trim(),
        business_website: businessWebsite.trim(),
        business_address: businessAddress.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
      });

      // Create the agent
      setCreatingAgent(true);
      const agentRes = await fetch("/api/onboarding/create-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!agentRes.ok) {
        const err = await agentRes.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to create agent");
      }
      setCreatingAgent(false);

      toast.success("Your AI agent has been created!");
      setStep(3);
    } catch (err) {
      setCreatingAgent(false);
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStep3Continue() {
    setSaving(true);
    try {
      await saveStep(3, {});
      setStep(4);
    } catch {
      toast.error("Failed to save progress.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep4Continue() {
    setSaving(true);
    try {
      await saveStep(4, {
        after_hours_behavior: afterHoursBehavior,
        unanswerable_behavior: unanswerableBehavior,
        escalation_phone:
          unanswerableBehavior === "transfer" ? escalationPhone.trim() : null,
        max_call_duration_minutes: maxCallDuration,
        post_call_email_summary: emailSummary,
        post_call_log: logToDashboard,
        post_call_followup_text: followUpText,
      });
      setStep(5);
    } catch {
      toast.error("Failed to save call handling rules.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep5Continue() {
    setSaving(true);
    try {
      await saveStep(5, { test_call_completed: testCallCompleted });
      setStep(6);
    } catch {
      toast.error("Failed to save progress.");
    } finally {
      setSaving(false);
    }
  }

  // Test call functions
  async function startTestCall() {
    setCallStarting(true);
    setTranscript([]);
    setTestCallCompleted(false);
    setCallDurationSeconds(0);
    try {
      const res = await fetch("/api/onboarding/test-call", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to start test call");
      }
      const { access_token } = await res.json();

      const client = new RetellWebClient();
      retellClient.current = client;

      client.on("call_started", () => {
        setCallActive(true);
        setCallStarting(false);
        callStartTimeRef.current = Date.now();
      });

      client.on("call_ended", () => {
        setCallActive(false);
        setTestCallCompleted(true);
        if (callStartTimeRef.current) {
          setCallDurationSeconds(
            Math.round((Date.now() - callStartTimeRef.current) / 1000)
          );
        }
      });

      client.on("update", (update: { transcript?: TranscriptEntry[] }) => {
        if (update.transcript) {
          setTranscript([...update.transcript]);
        }
      });

      await client.startCall({ accessToken: access_token });
    } catch (err) {
      setCallStarting(false);
      toast.error(
        err instanceof Error ? err.message : "Could not start test call."
      );
    }
  }

  function stopTestCall() {
    retellClient.current?.stopCall();
    setCallActive(false);
    setTestCallCompleted(true);
    if (callStartTimeRef.current) {
      setCallDurationSeconds(
        Math.round((Date.now() - callStartTimeRef.current) / 1000)
      );
    }
  }

  // Go live
  async function handleGoLive() {
    setGoingLive(true);
    try {
      const res = await fetch("/api/onboarding/go-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_option: phoneOption }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to go live");
      }
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      toast.success("Congratulations! Your AI agent is now live!");
      setTimeout(() => router.replace(`/${clientSlug}/portal`), 2000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setGoingLive(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading your onboarding wizard...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Agent creation overlay
  // ---------------------------------------------------------------------------

  if (creatingAgent) {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div className="absolute -inset-3 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">
            Setting up your AI agent...
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            We&apos;re configuring your agent with the template settings and your
            business information. This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <WizardProgress currentStep={step} />

        {/* Step content wrapper with fade animation */}
        <div className="animate-fade-in-up" key={step}>
          {/* ================================================================= */}
          {/* STEP 1: Choose Industry → Use Case (two-step selection)          */}
          {/* ================================================================= */}
          {step === 1 && (() => {
            // Derive unique industries from templates
            const industries: Industry[] = [];
            const seen = new Set<string>();
            for (const t of templates) {
              if (t.industry && !seen.has(t.industry)) {
                seen.add(t.industry);
                industries.push({
                  slug: t.industry,
                  name: t.name.replace(/ ×.*$/, "").replace(/ - .*$/, ""),
                  icon: t.industry_icon || t.icon,
                });
              }
            }
            // Deduplicate industry names from the template name — use a lookup
            const INDUSTRY_NAMES: Record<string, string> = {
              healthcare: "Healthcare",
              financial_services: "Financial Services",
              insurance: "Insurance",
              logistics: "Logistics",
              home_services: "Home Services",
              retail: "Retail & Consumer",
              travel_hospitality: "Travel & Hospitality",
              debt_collection: "Debt Collection",
            };
            industries.forEach((ind) => {
              if (INDUSTRY_NAMES[ind.slug]) ind.name = INDUSTRY_NAMES[ind.slug];
            });

            // Use cases for selected industry
            const useCaseTemplates = selectedIndustry
              ? templates.filter((t) => t.industry === selectedIndustry)
              : [];

            return (
              <div className="space-y-6">
                {/* Step 1a: Choose Industry */}
                {!selectedIndustry && (
                  <>
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 mb-4">
                        <Sparkles className="w-8 h-8 text-primary" />
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        Welcome! Let&apos;s set up your AI voice agent.
                      </h1>
                      <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
                        Choose your industry to get started with a pre-configured
                        template. You can always customize everything later.
                      </p>
                    </div>

                    {industries.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {industries.map((ind, i) => (
                          <button
                            key={ind.slug}
                            type="button"
                            onClick={() => {
                              setSelectedIndustry(ind.slug);
                              setSelectedTemplate(null);
                            }}
                            className="animate-fade-in-up relative w-full text-center rounded-xl border-2 border-gray-200 bg-white p-6 transition-all duration-200 outline-none group hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                            style={{ animationDelay: `${i * 60}ms` }}
                          >
                            <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center text-3xl mx-auto mb-3 transition-transform duration-200 group-hover:scale-110">
                              {ind.icon}
                            </div>
                            <h3 className="font-semibold text-sm leading-tight text-foreground">
                              {ind.name}
                            </h3>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Card className="glass-card">
                        <CardContent className="p-8 text-center">
                          <p className="text-muted-foreground">
                            No templates available. Please contact support.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Step 1b: Choose Use Case */}
                {selectedIndustry && (
                  <>
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 mb-4">
                        <span className="text-3xl">
                          {industries.find((ind) => ind.slug === selectedIndustry)?.icon || "🏢"}
                        </span>
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        How will your AI agent be used?
                      </h1>
                      <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
                        You selected{" "}
                        <span className="font-medium text-foreground">
                          {INDUSTRY_NAMES[selectedIndustry] || selectedIndustry}
                        </span>
                        . Choose the use case that best fits your needs.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {useCaseTemplates.map((t, i) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTemplate(t.id)}
                          className={cn(
                            "animate-fade-in-up relative w-full text-left rounded-xl border-2 p-5 transition-all duration-200 outline-none group",
                            "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
                            "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                            selectedTemplate === t.id
                              ? "border-primary bg-primary/[0.04] shadow-md shadow-primary/10"
                              : "border-gray-200 bg-white"
                          )}
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          {selectedTemplate === t.id && (
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </div>
                          )}
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 transition-transform duration-200 group-hover:scale-110",
                            selectedTemplate === t.id ? "bg-primary/10" : "bg-gray-50"
                          )}>
                            {t.use_case_icon || t.icon}
                          </div>
                          <h3 className={cn(
                            "font-semibold text-[15px] mb-1 transition-colors duration-200",
                            selectedTemplate === t.id ? "text-primary" : "text-foreground"
                          )}>
                            {USE_CASE_LABELS[t.use_case || ""] || t.use_case || t.name}
                          </h3>
                          {t.use_case_description && (
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {t.use_case_description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* What You'll Get preview card */}
                    {selectedTemplate && (() => {
                      const tmpl = useCaseTemplates.find((t) => t.id === selectedTemplate);
                      if (!tmpl) return null;
                      const serviceCount = tmpl.default_services?.length ?? 0;
                      const faqCount = tmpl.default_faqs?.length ?? 0;
                      const policyCount = tmpl.default_policies?.length ?? 0;
                      return (
                        <Card className="glass-card border-primary/20 bg-gradient-to-r from-primary/[0.03] to-transparent animate-fade-in-up mt-4">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="w-4 h-4 text-primary" />
                              <h4 className="text-sm font-semibold">What You&apos;ll Get</h4>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div className="rounded-lg bg-white/60 p-2">
                                <p className="text-lg font-bold text-primary">{serviceCount}</p>
                                <p className="text-[11px] text-muted-foreground">Services</p>
                              </div>
                              <div className="rounded-lg bg-white/60 p-2">
                                <p className="text-lg font-bold text-primary">{faqCount}</p>
                                <p className="text-[11px] text-muted-foreground">FAQs</p>
                              </div>
                              <div className="rounded-lg bg-white/60 p-2">
                                <p className="text-lg font-bold text-primary">{policyCount}</p>
                                <p className="text-[11px] text-muted-foreground">Policies</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              Pre-configured for{" "}
                              {INDUSTRY_NAMES[selectedIndustry] || selectedIndustry}.
                              Estimated setup: 5-10 minutes.
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })()}

                    <div className="flex items-center justify-between pt-4">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedIndustry(null);
                          setSelectedTemplate(null);
                        }}
                        className="gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Change Industry
                      </Button>
                      <Button
                        size="lg"
                        onClick={handleStep1Continue}
                        disabled={!selectedTemplate || saving}
                        className="min-w-[160px] gap-2"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Continue
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* ================================================================= */}
          {/* STEP 2: Business Information                                      */}
          {/* ================================================================= */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Tell us about your business
                </h1>
                <p className="text-muted-foreground mt-1">
                  This information helps your AI agent represent your business
                  accurately on calls.
                </p>
              </div>

              <Card className="glass-card">
                <CardContent className="p-6 space-y-5">
                  {/* Business Name */}
                  <div className="space-y-2">
                    <Label htmlFor="biz-name" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      Business Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="biz-name"
                      placeholder="e.g. Sunrise Dental Studio"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="max-w-md"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="biz-phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Phone Number
                    </Label>
                    <Input
                      id="biz-phone"
                      placeholder="e.g. (555) 123-4567"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      className="max-w-md"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label htmlFor="biz-website" className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      Website
                    </Label>
                    <Input
                      id="biz-website"
                      placeholder="e.g. https://www.yourbusiness.com"
                      value={businessWebsite}
                      onChange={(e) => setBusinessWebsite(e.target.value)}
                      className="max-w-md"
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="biz-address" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      Address
                    </Label>
                    <Input
                      id="biz-address"
                      placeholder="e.g. 123 Main St, Suite 200, Austin, TX 78701"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                    />
                  </div>

                  <div className="border-t pt-5" />

                  {/* Primary Contact Name */}
                  <div className="space-y-2">
                    <Label htmlFor="contact-name" className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Primary Contact Name
                    </Label>
                    <Input
                      id="contact-name"
                      placeholder="e.g. Jane Smith"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="max-w-md"
                    />
                  </div>

                  {/* Primary Contact Email */}
                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Primary Contact Email
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="e.g. jane@yourbusiness.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="max-w-md"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handleStep2Continue}
                  disabled={!businessName.trim() || saving}
                  className="min-w-[160px] gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: Business Settings                                         */}
          {/* ================================================================= */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Configure your business details
                </h1>
                <p className="text-muted-foreground mt-1">
                  Set your hours, services, FAQs, and policies. These help your
                  AI agent answer caller questions accurately.
                </p>
              </div>

              <div className="space-y-6">
                <HoursEditor />
                <ServicesList />
                <FaqsList />
                <PoliciesList />
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleStep3Continue}
                    disabled={saving}
                    className="text-muted-foreground gap-1"
                  >
                    <span className="text-xs">Skip for now</span>
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleStep3Continue}
                    disabled={saving}
                    className="min-w-[160px] gap-2"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/60 text-center">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Your template comes with pre-filled defaults. You can always edit these later.
              </p>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 4: Call Handling Rules                                        */}
          {/* ================================================================= */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  How should your AI agent handle calls?
                </h1>
                <p className="text-muted-foreground mt-1">
                  Configure how your agent behaves in different situations.
                </p>
              </div>

              <Card className="glass-card">
                <CardContent className="p-6 space-y-6">
                  {/* After Hours Behavior */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      After Hours Behavior
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      What should your AI do when someone calls outside business
                      hours?
                    </p>
                    <RadioGroup
                      value={afterHoursBehavior}
                      onValueChange={setAfterHoursBehavior}
                      className="space-y-3"
                    >
                      <label
                        htmlFor="ah-callback"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                          afterHoursBehavior === "callback"
                            ? "border-primary bg-primary/[0.03]"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <RadioGroupItem
                          value="callback"
                          id="ah-callback"
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              Offer to schedule a callback
                            </span>
                            <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                              Recommended
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            The AI will collect the caller&apos;s preferred
                            callback time and notify you.
                          </p>
                        </div>
                      </label>
                      <label
                        htmlFor="ah-message"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                          afterHoursBehavior === "message"
                            ? "border-primary bg-primary/[0.03]"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <RadioGroupItem
                          value="message"
                          id="ah-message"
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            Take a message and email it to me
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            The AI records the caller&apos;s message and sends
                            you an email summary.
                          </p>
                        </div>
                      </label>
                      <label
                        htmlFor="ah-hours"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                          afterHoursBehavior === "hours"
                            ? "border-primary bg-primary/[0.03]"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <RadioGroupItem
                          value="hours"
                          id="ah-hours"
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            Tell them our hours and suggest they call back
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            The AI shares your business hours and politely ends
                            the call.
                          </p>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="border-t" />

                  {/* Unanswerable Question Behavior */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      Unanswerable Question Behavior
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      What should the AI do when it can&apos;t answer a
                      caller&apos;s question?
                    </p>
                    <RadioGroup
                      value={unanswerableBehavior}
                      onValueChange={setUnanswerableBehavior}
                      className="space-y-3"
                    >
                      <label
                        htmlFor="ua-transfer"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                          unanswerableBehavior === "transfer"
                            ? "border-primary bg-primary/[0.03]"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <RadioGroupItem
                          value="transfer"
                          id="ua-transfer"
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            Transfer to my phone
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            The AI transfers the caller directly to your phone
                            number.
                          </p>
                          {unanswerableBehavior === "transfer" && (
                            <div className="mt-3">
                              <Input
                                placeholder="e.g. (555) 123-4567"
                                value={escalationPhone}
                                onChange={(e) =>
                                  setEscalationPhone(e.target.value)
                                }
                                className="max-w-xs text-sm"
                              />
                            </div>
                          )}
                        </div>
                      </label>
                      <label
                        htmlFor="ua-message"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                          unanswerableBehavior === "message"
                            ? "border-primary bg-primary/[0.03]"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <RadioGroupItem
                          value="message"
                          id="ua-message"
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              Take a message and email it to me
                            </span>
                            <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                              Recommended
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            The AI captures the question and sends you a
                            detailed email.
                          </p>
                        </div>
                      </label>
                      <label
                        htmlFor="ua-website"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                          unanswerableBehavior === "website"
                            ? "border-primary bg-primary/[0.03]"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <RadioGroupItem
                          value="website"
                          id="ua-website"
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            Apologize and suggest they visit our website
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            The AI directs the caller to your website for more
                            information.
                          </p>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="border-t" />

                  {/* Max Call Duration */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      Max Call Duration
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      The maximum amount of time the AI will stay on a single
                      call.
                    </p>
                    <Select
                      value={maxCallDuration}
                      onValueChange={setMaxCallDuration}
                    >
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 minutes</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="20">20 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t" />

                  {/* Post-Call Actions */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      Post-Call Actions
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      What happens automatically after each call ends?
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="pc-email"
                          checked={emailSummary}
                          onCheckedChange={(checked) =>
                            setEmailSummary(checked === true)
                          }
                          className="mt-0.5"
                        />
                        <div>
                          <Label
                            htmlFor="pc-email"
                            className="text-sm font-normal cursor-pointer"
                          >
                            Email me a summary
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Receive an email after each call with a summary and
                            transcript.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="pc-log"
                          checked={logToDashboard}
                          onCheckedChange={(checked) =>
                            setLogToDashboard(checked === true)
                          }
                          className="mt-0.5"
                        />
                        <div>
                          <Label
                            htmlFor="pc-log"
                            className="text-sm font-normal cursor-pointer"
                          >
                            Log the call in my dashboard
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            All calls are recorded and searchable in your portal
                            dashboard.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="pc-text"
                          checked={followUpText}
                          onCheckedChange={(checked) =>
                            setFollowUpText(checked === true)
                          }
                          className="mt-0.5"
                        />
                        <div>
                          <Label
                            htmlFor="pc-text"
                            className="text-sm font-normal cursor-pointer"
                          >
                            Send caller a follow-up text
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically text the caller after the call.
                            Requires Twilio integration.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep(3)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleStep4Continue}
                    disabled={saving}
                    className="text-muted-foreground gap-1"
                  >
                    <span className="text-xs">Skip for now</span>
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleStep4Continue}
                    disabled={saving}
                    className="min-w-[160px] gap-2"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/60 text-center">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Defaults are already configured. You can fine-tune these later from your dashboard.
              </p>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 5: Test Call (enhanced with coaching, transcript, report)    */}
          {/* ================================================================= */}
          {step === 5 && (() => {
            const currentTemplate = templates.find((t) => t.id === selectedTemplate);
            const testScenarios: TestScenario[] = currentTemplate?.test_scenarios ?? [];

            return (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Let&apos;s make sure everything sounds right!
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Have a quick conversation with your AI agent to test how it
                    handles calls.
                  </p>
                </div>

                {/* PRE-CALL: Coaching card with scenarios */}
                {!callActive && !testCallCompleted && transcript.length === 0 && (
                  <>
                    {testScenarios.length > 0 && (
                      <TestCallCoaching
                        scenarios={testScenarios}
                        selectedScenario={selectedScenario}
                        onSelect={setSelectedScenario}
                      />
                    )}

                    <Card className="glass-card overflow-hidden">
                      <CardContent className="p-0">
                        <div className="bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent p-6 border-b">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                              <Phone className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">
                                {businessName || "Your AI Agent"}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                                <span className="text-xs text-muted-foreground">
                                  {callStarting ? "Connecting..." : "Ready to test"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 flex flex-col items-center justify-center text-center py-8">
                          <div className="relative mb-6">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                              <Mic className="w-10 h-10 text-primary/60" />
                            </div>
                            <div className="absolute inset-0 rounded-full border-2 border-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
                          </div>
                          <p className="text-sm text-muted-foreground max-w-sm">
                            {selectedScenario !== null
                              ? "Great choice! Click below to start your test call and use the suggested opening line."
                              : "Click the button below to start a test call. Speak naturally -- your AI agent will respond just like it would on a real call."}
                          </p>
                        </div>

                        <div className="px-6 pb-6 flex items-center justify-center">
                          <Button
                            size="lg"
                            onClick={startTestCall}
                            disabled={callStarting}
                            className="gap-2 min-w-[180px] bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/20"
                          >
                            {callStarting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Mic className="w-4 h-4" />
                            )}
                            Start Test Call
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* DURING CALL: Live transcript */}
                {callActive && (
                  <Card className="glass-card overflow-hidden">
                    <CardContent className="p-0">
                      <div className="bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent p-6 border-b">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
                            <Phone className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">
                              {businessName || "Your AI Agent"}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-xs text-muted-foreground">On call</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 min-h-[280px] flex flex-col">
                        <TestCallTranscript
                          transcript={transcript}
                          callActive={callActive}
                          agentName={businessName || "AI Agent"}
                        />
                      </div>

                      <div className="px-6 pb-6 flex items-center justify-center">
                        <Button
                          size="lg"
                          variant="destructive"
                          onClick={stopTestCall}
                          className="gap-2 min-w-[180px] shadow-lg"
                        >
                          <MicOff className="w-4 h-4" />
                          End Call
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* AFTER CALL: Report card */}
                {testCallCompleted && !callActive && (
                  <>
                    <div className="flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                        <Check className="w-8 h-8 text-green-600" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-lg text-center">
                      Test Complete!
                    </h3>

                    <TestCallReport
                      durationSeconds={callDurationSeconds}
                      transcript={transcript}
                      scenarios={testScenarios}
                      onTryAgain={() => {
                        setTestCallCompleted(false);
                        setTranscript([]);
                        setCallDurationSeconds(0);
                      }}
                      onMakeChanges={() => setShowQuickFix(true)}
                      onContinue={handleStep5Continue}
                    />

                    <QuickFixModal
                      open={showQuickFix}
                      onClose={() => setShowQuickFix(false)}
                      onNavigate={(navStep) => setStep(navStep)}
                    />
                  </>
                )}

                <div className="flex items-center justify-between pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(4)}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <div className="flex items-center gap-3">
                    {!testCallCompleted && (
                      <Button
                        variant="ghost"
                        onClick={handleStep5Continue}
                        disabled={saving}
                        className="text-muted-foreground"
                      >
                        Skip for now
                      </Button>
                    )}
                    {!testCallCompleted && (
                      <Button
                        size="lg"
                        onClick={handleStep5Continue}
                        disabled={saving}
                        className="min-w-[160px] gap-2"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Continue
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {!testCallCompleted && (
                  <p className="text-xs text-muted-foreground/60 text-center">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Testing helps catch issues before your agent handles real calls. We recommend at least one test.
                  </p>
                )}
              </div>
            );
          })()}

          {/* ================================================================= */}
          {/* STEP 6: Go Live                                                   */}
          {/* ================================================================= */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">
                  You&apos;re almost ready!
                </h1>
                <p className="text-muted-foreground mt-1">
                  Review your setup and choose a phone number to go live.
                </p>
              </div>

              {/* Setup checklist */}
              <Card className="glass-card">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wide">
                    Setup Checklist
                  </h3>
                  <div className="space-y-3">
                    {[
                      {
                        label: "Business information complete",
                        done: !!businessName.trim(),
                      },
                      {
                        label: "Business hours set",
                        done: true, // Managed via settings components
                      },
                      {
                        label: "Services & FAQs configured",
                        done: true, // Managed via settings components
                      },
                      {
                        label: "Call handling rules set",
                        done: true, // They completed step 4
                      },
                      {
                        label: "Test call completed",
                        done: testCallCompleted,
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 py-2"
                      >
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                            item.done
                              ? "bg-green-100 text-green-600"
                              : "bg-gray-100 text-gray-400"
                          )}
                        >
                          {item.done ? (
                            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-300" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-sm",
                            item.done
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Phone number selection */}
              <Card className="glass-card">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-sm mb-1">
                    Choose a phone number
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Select how you&apos;d like callers to reach your AI agent.
                  </p>
                  <RadioGroup
                    value={phoneOption}
                    onValueChange={setPhoneOption}
                    className="space-y-3"
                  >
                    <label
                      htmlFor="phone-temp"
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                        phoneOption === "temporary"
                          ? "border-primary bg-primary/[0.03]"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <RadioGroupItem
                        value="temporary"
                        id="phone-temp"
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            Use our temporary number
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-green-50 text-green-700 border-0"
                          >
                            Free for 7 days
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Get started right away with a temporary number. Upgrade
                          anytime.
                        </p>
                      </div>
                    </label>
                    <label
                      htmlFor="phone-new"
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                        phoneOption === "purchase"
                          ? "border-primary bg-primary/[0.03]"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <RadioGroupItem
                        value="purchase"
                        id="phone-new"
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          Purchase a new number
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Get a dedicated phone number for $2/mo.
                        </p>
                      </div>
                    </label>
                    <label
                      htmlFor="phone-port"
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                        phoneOption === "port"
                          ? "border-primary bg-primary/[0.03]"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <RadioGroupItem
                        value="port"
                        id="phone-port"
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          Port an existing number
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Transfer your current business number. Takes 2-5
                          business days.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep(5)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handleGoLive}
                  disabled={goingLive}
                  className="min-w-[200px] gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/25 text-base font-semibold h-12"
                >
                  {goingLive ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      Go Live
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
