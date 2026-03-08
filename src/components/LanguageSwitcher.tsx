import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { languages } from "@/i18n";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors outline-none">
          {currentLang.code.toUpperCase()}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`gap-2.5 text-sm cursor-pointer ${i18n.language === lang.code ? "bg-accent font-semibold" : ""}`}
          >
            <span className="text-base">{lang.flag}</span>
            <span>{lang.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{lang.code.toUpperCase()}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
