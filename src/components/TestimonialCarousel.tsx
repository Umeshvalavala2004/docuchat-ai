import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const TESTIMONIALS = [
  {
    name: "Sarah M.",
    role: "PhD Researcher",
    initials: "SM",
    text: "This tool has completely transformed how I review papers. The AI chat feature saves me hours every week!",
    rating: 5,
  },
  {
    name: "James K.",
    role: "Graduate Student",
    initials: "JK",
    text: "The flashcard generator is incredible. I uploaded my lecture notes and had a full study set in seconds.",
    rating: 5,
  },
  {
    name: "Priya R.",
    role: "Undergraduate",
    initials: "PR",
    text: "Best summarization tool I've used. It picks up on the key points perfectly every time.",
    rating: 5,
  },
  {
    name: "David L.",
    role: "Law Student",
    initials: "DL",
    text: "The AI Writer helped me draft my thesis outline in minutes. Absolutely essential for students.",
    rating: 5,
  },
  {
    name: "Emma T.",
    role: "Medical Student",
    initials: "ET",
    text: "I use the research tool daily. It finds relevant sources I would have never discovered on my own.",
    rating: 4,
  },
];

export default function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const go = (dir: number) => {
    setDirection(dir);
    setCurrent((prev) => (prev + dir + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  const t = TESTIMONIALS[current];

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => go(-1)}
          className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          aria-label="Previous testimonial"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5"
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0 border border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {t.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{t.name}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{t.role}</span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          onClick={() => go(1)}
          className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          aria-label="Next testimonial"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
            }`}
            aria-label={`Go to testimonial ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
