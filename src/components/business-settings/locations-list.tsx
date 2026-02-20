"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

interface LocationData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_primary: boolean;
}

interface LocationsListProps {
  clientId?: string;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function LocationsList({ clientId }: LocationsListProps) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<LocationData | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/locations", clientId));
      if (!res.ok) throw new Error("Failed to fetch locations");
      const data = await res.json();
      setLocations(data.locations ?? data ?? []);
    } catch {
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this location?")) return;
    try {
      const res = await fetch(apiUrl(`/locations/${id}`, clientId), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete location");
      toast.success("Location deleted");
      fetchLocations();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete location"
      );
    }
  }

  function handleEdit(location: LocationData) {
    setEditingLocation(location);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingLocation(null);
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
              <div className="h-7 w-7 rounded-md bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Locations</h3>
                <p className="text-[11px] text-muted-foreground">
                  Manage your business locations and addresses
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Location
            </Button>
          </div>
        </div>
        <CardContent className="p-4">
          {locations.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No locations added yet. Add your business locations.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="border rounded-lg p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{location.name}</p>
                      {location.is_primary && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Primary
                        </Badge>
                      )}
                    </div>
                    {location.address && (
                      <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {location.address}
                      </p>
                    )}
                    {location.phone && (
                      <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 shrink-0" />
                        {location.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(location)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(location.id)}
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

      <LocationEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        location={editingLocation}
        clientId={clientId}
        onSaved={fetchLocations}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Location Editor Modal (inline since it's tightly coupled)
// ---------------------------------------------------------------------------

interface LocationEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: LocationData | null;
  clientId?: string;
  onSaved: () => void;
}

function LocationEditorModal({
  open,
  onOpenChange,
  location,
  clientId,
  onSaved,
}: LocationEditorModalProps) {
  const isEditMode = !!location;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location) {
      setName(location.name ?? "");
      setAddress(location.address ?? "");
      setPhone(location.phone ?? "");
      setIsPrimary(location.is_primary ?? false);
    } else {
      setName("");
      setAddress("");
      setPhone("");
      setIsPrimary(false);
    }
  }, [location, open]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Location name is required");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      is_primary: isPrimary,
    };

    try {
      let res: Response;
      if (isEditMode && location) {
        res = await fetch(apiUrl(`/locations/${location.id}`, clientId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(apiUrl("/locations", clientId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save location");
      }

      toast.success(
        isEditMode
          ? "Location updated successfully"
          : "Location created successfully"
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save location"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Location" : "Add Location"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Location Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Office, Downtown Branch"
              className="text-sm"
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Suite 100, City, ST 12345"
              className="text-sm"
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. (555) 123-4567"
              className="text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is-primary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is-primary" className="text-sm font-medium">
              Primary location
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditMode ? "Update Location" : "Add Location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
