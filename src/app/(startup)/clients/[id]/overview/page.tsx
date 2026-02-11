"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Save, Plus, Trash2, Loader2, ExternalLink, RotateCcw, Sparkles, Eye, CheckCircle2, Clock } from "lucide-react";
import type { Client } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { OnboardingTutorial } from "@/components/onboarding/onboarding-tutorial";

interface Member {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "client_admin" | "client_member";
  onboarding_completed_at: string | null;
}

function RoleBadge({ role }: { role: Member["role"] }) {
  if (role === "client_admin") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        Admin
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
      Member
    </Badge>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ClientOverviewPage() {
  const params = useParams();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    email: "",
    role: "client_member" as Member["role"],
  });
  const [previewOnboarding, setPreviewOnboarding] = useState(false);

  const fetchClient = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (data && !error) {
      setClient(data as Client);
    }
  }, [id]);

  const fetchMembers = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, avatar_url, role, onboarding_completed_at")
      .eq("client_id", id)
      .in("role", ["client_admin", "client_member"]);

    if (data && !error) {
      setMembers(data as Member[]);
    }
  }, [id]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchClient(), fetchMembers()]);
      setLoading(false);
    }

    loadData();
  }, [fetchClient, fetchMembers]);

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .update({
        name: client.name,
        slug: client.slug,
        status: client.status,
        language: client.language,
        dashboard_theme: client.dashboard_theme,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to save client:", error);
      alert("Failed to save changes. Please try again.");
    }

    setSaving(false);
  };

  const handleAddMember = () => {
    // Real invite flow requires email sending, auth user creation, etc.
    alert(`Invite flow not yet implemented. Would invite ${newMember.email} as ${newMember.role}.`);
    setAddMemberOpen(false);
    setNewMember({ email: "", role: "client_member" });
  };

  const handleRemoveMember = async (memberId: string) => {
    const confirmed = window.confirm("Are you sure you want to remove this member?");
    if (!confirmed) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", memberId);

    if (error) {
      console.error("Failed to remove member:", error);
      alert("Failed to remove member. Please try again.");
      return;
    }

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleResetOnboarding = async (memberId: string, memberName: string) => {
    const confirmed = window.confirm(
      `Reset onboarding for ${memberName}? They will see the tutorial again on next login.`
    );
    if (!confirmed) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ onboarding_completed_at: null })
      .eq("id", memberId);

    if (error) {
      console.error("Failed to reset onboarding:", error);
      alert("Failed to reset onboarding. Please try again.");
    } else {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, onboarding_completed_at: null } : m
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
        <span className="ml-2 text-[#6b7280]">Loading client data...</span>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[#6b7280]">Client not found.</span>
      </div>
    );
  }

  const onboardedCount = members.filter((m) => m.onboarding_completed_at).length;
  const pendingCount = members.filter((m) => !m.onboarding_completed_at).length;

  return (
    <div className="space-y-6">
      {/* Client Portal Experience Card */}
      <Card className="rounded-lg border-blue-200/50 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111827]">Client Portal Experience</h3>
                <p className="text-sm text-[#6b7280] mt-0.5">
                  View the portal exactly as {client.name}&apos;s team sees it, or preview the onboarding tutorial they go through on first login.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {members.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-[#6b7280]">{onboardedCount} onboarded</span>
                      </div>
                      {pendingCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[#6b7280]">{pendingCount} pending</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOnboarding(true)}
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Preview Onboarding
              </Button>
              <a href="/login" target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  View as Client
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Info Form */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Client Name</Label>
              <Input
                id="name"
                value={client.name}
                onChange={(e) =>
                  setClient({ ...client, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={client.slug}
                onChange={(e) =>
                  setClient({ ...client, slug: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={client.status}
                onValueChange={(value: Client["status"]) =>
                  setClient({ ...client, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={client.language}
                onValueChange={(value) =>
                  setClient({ ...client, language: value })
                }
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Dashboard Theme</Label>
              <Select
                value={client.dashboard_theme}
                onValueChange={(value) =>
                  setClient({ ...client, dashboard_theme: value })
                }
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Members</CardTitle>
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Member</DialogTitle>
                  <DialogDescription>
                    Invite a new member to this client. They will receive an
                    email invitation.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="member-email">Email Address</Label>
                    <Input
                      id="member-email"
                      type="email"
                      placeholder="member@example.com"
                      value={newMember.email}
                      onChange={(e) =>
                        setNewMember({ ...newMember, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="member-role">Role</Label>
                    <Select
                      value={newMember.role}
                      onValueChange={(value: Member["role"]) =>
                        setNewMember({ ...newMember, role: value })
                      }
                    >
                      <SelectTrigger id="member-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client_admin">Admin</SelectItem>
                        <SelectItem value="client_member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddMemberOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                    onClick={handleAddMember}
                    disabled={!newMember.email.trim()}
                  >
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Onboarding</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-[#6b7280] py-8">
                    No members found for this client.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center text-xs font-medium">
                          {getInitials(member.name)}
                        </div>
                        <span className="font-medium text-[#111827]">
                          {member.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6b7280]">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell>
                      {member.onboarding_completed_at ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        {member.onboarding_completed_at && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                            title="Reset onboarding — member will see the tutorial again"
                            onClick={() => handleResetOnboarding(member.id, member.name)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Onboarding Tutorial Preview */}
      <OnboardingTutorial
        open={previewOnboarding}
        onOpenChange={setPreviewOnboarding}
        onComplete={() => setPreviewOnboarding(false)}
      />
    </div>
  );
}
