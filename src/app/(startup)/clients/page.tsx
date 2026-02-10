"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/types/database";

type ClientStatus = "active" | "inactive" | "suspended";

function StatusBadge({ status }: { status: ClientStatus }) {
  const variants: Record<ClientStatus, { className: string; label: string }> = {
    active: {
      className: "bg-green-50 text-green-700 border-green-200",
      label: "Active",
    },
    inactive: {
      className: "bg-gray-50 text-gray-600 border-gray-200",
      label: "Inactive",
    },
    suspended: {
      className: "bg-red-50 text-red-700 border-red-200",
      label: "Suspended",
    },
  };

  const { className, label } = variants[status] || variants.active;

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [clients, setClients] = useState<(Client & { agentCount: number })[]>([]);
  const [newClient, setNewClient] = useState({
    name: "",
    slug: "",
    language: "English",
    dashboard_theme: "light",
  });

  const fetchClients = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clients")
      .select("*, agents(id)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load clients");
    } else if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setClients(data.map((c: any) => ({
        ...c,
        agentCount: c.agents?.length || 0,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filteredClients = clients.filter((client) => {
    const matchesSearch = client.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateClient = async () => {
    setCreating(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });

    if (res.ok) {
      setDialogOpen(false);
      setNewClient({ name: "", slug: "", language: "English", dashboard_theme: "light" });
      fetchClients();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Failed to create client");
    }
    setCreating(false);
  };

  const handleNameChange = (name: string) => {
    setNewClient({
      ...newClient,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#111827]">Clients</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Manage your startup clients and their configurations
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Client</DialogTitle>
              <DialogDescription>
                Add a new client to your startup. You can configure their access
                and settings after creation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  placeholder="Enter client name"
                  value={newClient.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-slug">Slug</Label>
                <Input
                  id="client-slug"
                  placeholder="client-slug"
                  value={newClient.slug}
                  onChange={(e) =>
                    setNewClient({ ...newClient, slug: e.target.value })
                  }
                />
                <p className="text-xs text-[#6b7280]">
                  Used in URLs. Auto-generated from name.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-language">Language</Label>
                <Select
                  value={newClient.language}
                  onValueChange={(value) =>
                    setNewClient({ ...newClient, language: value })
                  }
                >
                  <SelectTrigger id="client-language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="German">German</SelectItem>
                    <SelectItem value="Arabic">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-theme">Dashboard Theme</Label>
                <Select
                  value={newClient.dashboard_theme}
                  onValueChange={(value) =>
                    setNewClient({ ...newClient, dashboard_theme: value })
                  }
                >
                  <SelectTrigger id="client-theme">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                onClick={handleCreateClient}
                disabled={!newClient.name.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Client"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="rounded-lg">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
              <Input
                placeholder="Search clients..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Client Table */}
      {loading ? (
        <Card className="rounded-lg">
          <CardContent className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
          </CardContent>
        </Card>
      ) : filteredClients.length > 0 ? (
        <Card className="rounded-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Client Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/clients/${client.id}/overview`)}
                  >
                    <TableCell className="pl-6 font-medium text-[#111827]">
                      {client.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={client.status as ClientStatus} />
                    </TableCell>
                    <TableCell className="text-[#6b7280]">
                      {client.agentCount}
                    </TableCell>
                    <TableCell className="text-[#6b7280]">
                      {new Date(client.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-lg">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-[#6b7280]" />
            </div>
            <h3 className="text-base font-medium text-[#111827] mb-1">
              No clients found
            </h3>
            <p className="text-sm text-[#6b7280] mb-4 max-w-sm">
              {search || statusFilter !== "all"
                ? "No clients match your current filters. Try adjusting your search or filter criteria."
                : "Get started by creating your first client. Clients can access their own dashboard and manage their assigned agents."}
            </p>
            {!search && statusFilter === "all" && (
              <Button
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Client
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
