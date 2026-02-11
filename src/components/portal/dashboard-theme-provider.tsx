"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface DashboardThemeContextValue {
  color: string;
  setColor: (color: string) => void;
  saveColor: (color: string) => Promise<void>;
}

const DashboardThemeContext = createContext<DashboardThemeContextValue>({
  color: "#2563eb",
  setColor: () => {},
  saveColor: async () => {},
});

export function useDashboardTheme() {
  return useContext(DashboardThemeContext);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function applyColor(hex: string) {
  const root = document.documentElement;
  root.style.setProperty("--primary", hex);
  root.style.setProperty("--ring", hex);
  root.style.setProperty("--sidebar-primary", hex);
  root.style.setProperty("--sidebar-ring", hex);
  root.style.setProperty("--chart-1", hex);

  // Generate opacity variants for hover states and backgrounds
  const rgb = hexToRgb(hex);
  if (rgb) {
    root.style.setProperty("--primary-light", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
    root.style.setProperty("--sidebar-active-bg", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
    root.style.setProperty("--shadow-primary", `0 4px 14px -2px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);

    // Derive colorful sidebar gradient from primary color
    const sidebarStart = rgbToHex(rgb.r * 0.18 + 10, rgb.g * 0.18 + 10, rgb.b * 0.18 + 14);
    const sidebarEnd = rgbToHex(rgb.r * 0.32 + 8, rgb.g * 0.32 + 8, rgb.b * 0.32 + 12);
    root.style.setProperty("--sidebar-bg-start", sidebarStart);
    root.style.setProperty("--sidebar-bg-end", sidebarEnd);
    root.style.setProperty("--sidebar", sidebarStart);
  }
}

export function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
  const [color, setColorState] = useState("#2563eb");
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("client_id")
        .eq("id", user.id)
        .single();
      if (!userData?.client_id) return;

      setClientId(userData.client_id);

      const { data: client } = await supabase
        .from("clients")
        .select("dashboard_color")
        .eq("id", userData.client_id)
        .single();

      if (client?.dashboard_color) {
        setColorState(client.dashboard_color);
        applyColor(client.dashboard_color);
      }
    }
    load();
  }, []);

  const setColor = useCallback((hex: string) => {
    setColorState(hex);
    applyColor(hex);
  }, []);

  const saveColor = useCallback(async (hex: string) => {
    if (!clientId) return;
    const supabase = createClient();
    await supabase
      .from("clients")
      .update({ dashboard_color: hex })
      .eq("id", clientId);
    setColor(hex);
  }, [clientId, setColor]);

  // Clean up overrides when unmounting (leaving portal)
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-ring");
      root.style.removeProperty("--chart-1");
      root.style.removeProperty("--primary-light");
      root.style.removeProperty("--sidebar-active-bg");
      root.style.removeProperty("--shadow-primary");
      root.style.removeProperty("--sidebar-bg-start");
      root.style.removeProperty("--sidebar-bg-end");
      root.style.removeProperty("--sidebar");
    };
  }, []);

  return (
    <DashboardThemeContext.Provider value={{ color, setColor, saveColor }}>
      {children}
    </DashboardThemeContext.Provider>
  );
}
