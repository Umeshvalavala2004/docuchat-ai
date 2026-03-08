import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingConfig {
  id?: string;
  appName: string;
  subtitle: string;
  copyrightYear: string;
  copyrightText: string;
  logoUrl: string | null;
}

const DEFAULT_BRANDING: BrandingConfig = {
  appName: "Interface_IQ",
  subtitle: "Powered by Interface_IQ",
  copyrightYear: "2026",
  copyrightText: "Interface_IQ. All rights reserved.",
  logoUrl: null,
};

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
        setBranding({
          id: (data as any).id,
          appName: (data as any).app_name || DEFAULT_BRANDING.appName,
          subtitle: (data as any).subtitle || DEFAULT_BRANDING.subtitle,
          copyrightYear: (data as any).copyright_year || DEFAULT_BRANDING.copyrightYear,
          copyrightText: (data as any).copyright_text || DEFAULT_BRANDING.copyrightText,
          logoUrl: (data as any).logo_url || null,
        });
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

    const payload: Record<string, any> = {
      app_name: updated.appName,
      subtitle: updated.subtitle,
      copyright_year: updated.copyrightYear,
      copyright_text: updated.copyrightText,
      logo_url: updated.logoUrl,
      updated_at: new Date().toISOString(),
    };

    if (branding.id) {
      await supabase.from("branding_settings" as any).update(payload).eq("id", branding.id);
    }
  };

  const copyright = `© ${branding.copyrightYear} ${branding.copyrightText}`;

  return { branding, copyright, loading, updateBranding, refetch: load };
}
