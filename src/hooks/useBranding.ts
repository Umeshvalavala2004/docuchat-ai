import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const FONT_OPTIONS = [
  { label: "Plus Jakarta Sans", value: "Plus Jakarta Sans", category: "Modern" },
  { label: "Inter", value: "Inter", category: "Modern" },
  { label: "DM Sans", value: "DM Sans", category: "Modern" },
  { label: "Outfit", value: "Outfit", category: "Modern" },
  { label: "Space Grotesk", value: "Space Grotesk", category: "Modern" },
  { label: "Sora", value: "Sora", category: "Modern" },
  { label: "Poppins", value: "Poppins", category: "Classic" },
  { label: "Nunito", value: "Nunito", category: "Classic" },
  { label: "Lato", value: "Lato", category: "Classic" },
  { label: "Open Sans", value: "Open Sans", category: "Classic" },
  { label: "Roboto", value: "Roboto", category: "Classic" },
  { label: "Merriweather", value: "Merriweather", category: "Serif" },
  { label: "Playfair Display", value: "Playfair Display", category: "Serif" },
  { label: "Lora", value: "Lora", category: "Serif" },
  { label: "Source Serif 4", value: "Source Serif 4", category: "Serif" },
  { label: "IBM Plex Sans", value: "IBM Plex Sans", category: "Technical" },
  { label: "JetBrains Mono", value: "JetBrains Mono", category: "Technical" },
  { label: "Fira Code", value: "Fira Code", category: "Technical" },
];

export interface BrandingConfig {
  id?: string;
  appName: string;
  subtitle: string;
  copyrightYear: string;
  copyrightText: string;
  logoUrl: string | null;
  accentColor: string;
  fontFamily: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  appName: "Interface_IQ",
  subtitle: "Powered by Interface_IQ",
  copyrightYear: "2026",
  copyrightText: "Interface_IQ. All rights reserved.",
  logoUrl: null,
  accentColor: "#3b82f6",
  fontFamily: "Plus Jakarta Sans",
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
  const { h, s, l } = hsl;
  const isDark = document.documentElement.classList.contains("dark");

  // In dark mode, boost lightness for visibility; in light mode, cap it for contrast
  const adjustedL = isDark ? Math.min(l + 12, 78) : Math.max(l, 35);
  const hslStr = `${h} ${s}% ${adjustedL}%`;

  const glowL = isDark ? Math.min(adjustedL + 10, 82) : Math.min(l + 7, 70);
  const endL = isDark ? Math.min(adjustedL + 8, 78) : Math.min(l + 5, 65);

  const root = document.documentElement;
  root.style.setProperty("--primary", hslStr);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--ring", hslStr);
  root.style.setProperty("--primary-glow", `${(h + 18) % 360} ${Math.min(s + 10, 100)}% ${glowL}%`);
  root.style.setProperty("--gradient-start", hslStr);
  root.style.setProperty("--gradient-end", `${(h + 28) % 360} ${Math.min(s, 100)}% ${endL}%`);
  root.style.setProperty("--gradient-accent", `${(h - 22 + 360) % 360} ${s}% ${adjustedL}%`);
  root.style.setProperty("--sidebar-primary", hslStr);
  root.style.setProperty("--sidebar-ring", hslStr);
}

// Re-apply accent color when theme changes
function observeThemeChanges(hex: string): MutationObserver {
  const observer = new MutationObserver(() => {
    applyAccentColor(hex);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return observer;
}

function loadGoogleFont(fontFamily: string) {
  const id = `google-font-${fontFamily.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

function applyFont(fontFamily: string) {
  loadGoogleFont(fontFamily);
  document.documentElement.style.setProperty("--font-sans", `'${fontFamily}', 'Inter', system-ui, -apple-system, sans-serif`);
  document.body.style.fontFamily = `'${fontFamily}', 'Inter', system-ui, -apple-system, sans-serif`;
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
          fontFamily: (data as any).font_family || DEFAULT_BRANDING.fontFamily,
        };
        setBranding(config);
        applyAccentColor(config.accentColor);
        applyFont(config.fontFamily);
      }
    } catch (e) {
      console.error("Failed to load branding:", e);
    }
    setLoading(false);
  };

  // Load branding and observe theme changes to re-apply accent color
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!branding.accentColor) return;
    const observer = observeThemeChanges(branding.accentColor);
    return () => observer.disconnect();
  }, [branding.accentColor]);

  const updateBranding = async (config: Partial<BrandingConfig>) => {
    const updated = { ...branding, ...config };
    setBranding(updated);

    if (updated.accentColor) applyAccentColor(updated.accentColor);
    if (updated.fontFamily) applyFont(updated.fontFamily);

    const payload: Record<string, any> = {
      app_name: updated.appName,
      subtitle: updated.subtitle,
      copyright_year: updated.copyrightYear,
      copyright_text: updated.copyrightText,
      logo_url: updated.logoUrl,
      accent_color: updated.accentColor,
      font_family: updated.fontFamily,
      updated_at: new Date().toISOString(),
    };

    if (branding.id) {
      await supabase.from("branding_settings" as any).update(payload).eq("id", branding.id);
    }
  };

  const copyright = `© ${branding.copyrightYear} ${branding.copyrightText}`;

  return { branding, copyright, loading, updateBranding, refetch: load };
}
