"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ServiceEditorModal,
  type ServiceData,
} from "./service-editor-modal";

interface ServicesListProps {
  clientId?: string;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function ServicesList({ clientId }: ServicesListProps) {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceData | null>(
    null
  );

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/services", clientId));
      if (!res.ok) throw new Error("Failed to fetch services");
      const data = await res.json();
      setServices(data.services ?? data ?? []);
    } catch {
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(apiUrl(`/services/${id}`, clientId), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete service");
      toast.success("Service deleted");
      fetchServices();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete service"
      );
    }
  }

  function handleEdit(service: ServiceData) {
    setEditingService(service);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingService(null);
    setModalOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card className="overflow-hidden animate-fade-in-up glass-card">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Services</h3>
                <p className="text-[11px] text-muted-foreground">
                  Manage the services your business offers
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Service
            </Button>
          </div>
        </div>
        <CardContent className="p-4">
          {services.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No services added yet. Add your first service to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="border rounded-lg p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{service.name}</p>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {service.description}
                      </p>
                    )}
                    {service.price_text && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">
                          {service.price_text}
                        </span>
                        {service.duration_text && (
                          <span className="ml-2">
                            {service.duration_text}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(service)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(service.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ServiceEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        service={editingService}
        clientId={clientId}
        onSaved={fetchServices}
      />
    </>
  );
}
