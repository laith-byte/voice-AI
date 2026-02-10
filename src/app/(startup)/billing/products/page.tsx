"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  interval: string;
  active: boolean;
}

export default function BillingProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const fetchConnection = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    if (!currentUser?.organization_id) return null;

    const { data: connection } = await supabase
      .from("stripe_connections")
      .select("stripe_account_id, is_connected")
      .eq("organization_id", currentUser.organization_id)
      .single();

    if (connection?.is_connected) {
      setStripeAccountId(connection.stripe_account_id);
      setIsConnected(true);
      return connection.stripe_account_id;
    }
    setIsConnected(false);
    return null;
  }, []);

  const fetchProducts = useCallback(
    async (accountId: string) => {
      try {
        const res = await fetch("/api/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list_products",
            stripeAccountId: accountId,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: Product[] = (data as any[]).map((p: any) => ({
          id: p.id,
          name: p.name || "Untitled",
          description: p.description || "",
          price: p.default_price?.unit_amount
            ? `$${(p.default_price.unit_amount / 100).toFixed(2)}`
            : "No price",
          interval: p.default_price?.recurring?.interval || "one-time",
          active: p.active,
        }));
        setProducts(mapped);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load products");
        setProducts([]);
      }
    },
    []
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const accountId = await fetchConnection();
      if (accountId) {
        await fetchProducts(accountId);
      }
      setLoading(false);
    };
    init();
  }, [fetchConnection, fetchProducts]);

  const handleCreateProduct = async () => {
    if (!stripeAccountId || !newName) return;
    setCreating(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_product",
          stripeAccountId,
          name: newName,
          description: newDescription,
          price: newPrice ? parseFloat(newPrice) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Refresh list
      await fetchProducts(stripeAccountId);
      setDialogOpen(false);
      setNewName("");
      setNewDescription("");
      setNewPrice("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
        <div className="bg-gray-100 rounded-full p-3 mb-4">
          <Package className="h-6 w-6 text-[#6b7280]" />
        </div>
        <h3 className="text-sm font-medium text-[#111827] mb-1">
          Stripe not connected
        </h3>
        <p className="text-sm text-[#6b7280] mb-4">
          Connect your Stripe account to manage products.
        </p>
        <Link href="/billing/connect">
          <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
            Go to Connect
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-[#111827]">
          {products.length} product{products.length !== 1 ? "s" : ""}
        </h2>
        <Button
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Product
        </Button>
      </div>

      {/* Products List */}
      {products.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Product
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Price
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Interval
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#111827]">
                        {product.name}
                      </p>
                      <p className="text-xs text-[#6b7280]">{product.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#111827]">
                    {product.price}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {product.interval}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        product.active
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-gray-100 text-[#6b7280] border border-[#e5e7eb]"
                      }`}
                    >
                      {product.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <Package className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No products found
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            Create your first product to start billing your clients.
          </p>
          <Button
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Product
          </Button>
        </div>
      )}

      {/* Create Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Product</DialogTitle>
            <DialogDescription>
              Add a new product to your Stripe account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                placeholder="Product name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <Input
                id="product-description"
                placeholder="Product description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Monthly Price (USD)</Label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="29.99"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleCreateProduct}
              disabled={creating || !newName}
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
