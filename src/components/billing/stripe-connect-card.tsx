"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StripeConnectCardProps {
  isConnected: boolean;
  stripeAccountId: string | null;
  actionLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onUpdate: () => void;
}

export function StripeConnectCard({
  isConnected,
  stripeAccountId,
  actionLoading,
  onConnect,
  onDisconnect,
  onUpdate,
}: StripeConnectCardProps) {
  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
        <p className="text-sm text-yellow-800">
          Please do not create, edit or delete packages/products directly from
          Stripe Dashboard. All product and subscription management should be
          done through this interface to ensure data consistency.
        </p>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isConnected ? "bg-green-50" : "bg-gray-100"
                }`}
              >
                <CreditCard
                  className={`h-6 w-6 ${
                    isConnected ? "text-green-600" : "text-[#6b7280]"
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium text-[#111827]">
                    Stripe Account
                  </h3>
                  {isConnected && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <p className="text-sm text-[#6b7280] mt-0.5">
                  {isConnected
                    ? "Your Stripe account is connected and ready to go!"
                    : "Connect your Stripe account to start accepting payments."}
                </p>
                {isConnected && stripeAccountId && (
                  <p className="text-xs text-[#6b7280] mt-1 font-mono">
                    {stripeAccountId}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6">
            {isConnected ? (
              <>
                <Button
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                  onClick={onUpdate}
                  disabled={actionLoading}
                >
                  {actionLoading && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Update Stripe Account
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Disconnect Stripe Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Disconnect Stripe Account?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will disconnect your Stripe account. Existing
                        subscriptions will not be affected, but you won&apos;t be
                        able to create new ones until you reconnect.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={onDisconnect}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Button
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                onClick={onConnect}
                disabled={actionLoading}
              >
                {actionLoading && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Connect Stripe Account
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
