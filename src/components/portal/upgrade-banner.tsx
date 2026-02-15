"use client";

import { Lock, ArrowRight } from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface UpgradeBannerProps {
  feature: string;
  plan?: string;
  description?: string;
}

export function UpgradeBanner({
  feature,
  plan = "Professional",
  description,
}: UpgradeBannerProps) {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  return (
    <Card className="border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {feature}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            {description || `Upgrade to the ${plan} plan to unlock this feature.`}
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40 shrink-0"
        >
          <Link href={clientSlug ? `/${clientSlug}/portal/billing` : "#"}>
            Upgrade to {plan}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
