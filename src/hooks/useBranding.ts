import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingConfig {
  id?: string;
  appName: string;
  subtitle: string;
  copyrightYear: string;
  copyrightText: string;
  logoUrl: string | null;
  accentColor: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  appName: "Interface_IQ",
  subtitle: "Powered by Interface_IQ",
  copyrightYear: "2026",
  copyrightText: "Interface_IQ. All rights reserved.",
  logoUrl: null,
  accentColor: "#3b82f6",
};

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyAccentColor(hex: string) {
  const hsl = hexToHSL(hex);
  if (!hsl) return;
  const root = document.documentElement;
  const { h, s, l } = hsl;
  const hslStr = `${h} ${s}% ${l}%`;
  
  // Primary color
  root.style.setProperty("--primary", hslStr);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--ring", hslStr);

  // Glow variant (slightly shifted hue, higher lightness)
  root.style.setProperty("--primary-glow", `${(h + 18) % 360} ${Math.min(s + 10, 100)}% ${Math.min(l + 7, 100)}%`);

  // Gradient tokens
  root.style.setProperty("--gradient-start", hslStr);
  root.style.setProperty("--gradient-end", `${(h + 28) % 360} ${Math.min(s, 100)}% ${Math.min(l + 5, 95)}%`);
  root.style.setProperty("--gradient-accent", `${(h - 22 + 360) % 360} ${s}% ${l}%`);

  // Sidebar primary
  root.style.setProperty("--sidebar-primary", hslStr);
  root.style.setProperty("--sidebar-ring", hslStr);
}

export function useBranding() {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await supabase
        .from("branding_settings" as any)
        .select("*")
        .limit(1)
        .single();
      if (data) {
        const config: BrandingConfig = {
          id: (data as any).id,
          appName: (data as any).app_name || DEFAULT_BRANDING.appName,
          subtitle: (data as any).subtitle || DEFAULT_BRANDING.subtitle,
          copyrightYear: (data as any).copyright_year || DEFAULT_BRANDING.copyrightYear,
          copyrightText: (data as any).copyright_text || DEFAULT_BRANDING.copyrightText,
          logoUrl: (data as any).logo_url || null,
          accentColor: (data as any).accent_color || DEFAULT_BRANDING.accentColor,
        };
        setBranding(config);
        applyAccentColor(config.accentColor);
      }
    } catch (e) {
      console.error("Failed to load branding:", e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateBranding = async (config: Partial<BrandingConfig>) => {
    const updated = { ...branding, ...config };
    setBranding(updated);

    if (updated.accentColor) {
      applyAccentColor(updated.accentColor);
    }

    const payload: Record<string, any> = {
      app_name: updated.appName,
      subtitle: updated.subtitle,
      copyright_year: updated.copyrightYear,
      copyright_text: updated.copyrightText,
      logo_url: updated.logoUrl,
      accent_color: updated.accentColor,
      updated_at: new Date().toISOString(),
    };

    if (branding.id) {
      await supabase.from("branding_settings" as any).update(payload).eq("id", branding.id);
    }
  };

  const copyright = `© ${branding.copyrightYear} ${branding.copyrightText}`;

  return { branding, copyright, loading, updateBranding, refetch: load };
}
