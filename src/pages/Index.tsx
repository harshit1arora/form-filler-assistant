import { useState } from "react";
import { Button } from "@/components/ui/button";

const downloadExtension = () => {
  fetch("/form-copilot.zip")
    .then((res) => {
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "form-copilot.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch((err) => alert(err.message));
};

const FEATURES = [
  {
    icon: "🔍",
    title: "Smart Detection",
    desc: "Scans inputs, textareas, and selects. Extracts names, placeholders, labels, and types.",
  },
  {
    icon: "🧠",
    title: "Heuristic Mapping",
    desc: "Matches fields to CRM schema using keyword analysis with confidence scoring.",
  },
  {
    icon: "⚡",
    title: "One-Click Fill",
    desc: "Autofills matched fields and dispatches native events for React compatibility.",
  },
  {
    icon: "📚",
    title: "Learning System",
    desc: "Remembers user corrections per domain. Prioritizes learned mappings on future visits.",
  },
];

const STEPS = [
  "Download the ZIP file below",
  "Unzip and open chrome://extensions",
  "Enable Developer Mode → Load Unpacked",
  "Navigate to any form and click the extension icon",
];

export default function Index() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--glow)/0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-32 text-center">
          <div className="mb-10 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/20">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
          </div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            Chrome Extension · Manifest V3
          </div>
          <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
            Form <span className="text-primary">Copilot</span>
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-lg text-muted-foreground">
            Detect form fields on any page, map them to your CRM schema, and autofill with one click. Learns from your corrections.
          </p>
          <Button
            size="lg"
            onClick={downloadExtension}
            className="rounded-xl px-8 text-base font-semibold shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30"
          >
            ↓ Download Extension
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoveredFeature(i)}
              onMouseLeave={() => setHoveredFeature(null)}
              className={`rounded-xl border bg-card p-6 transition-all duration-200 ${
                hoveredFeature === i
                  ? "border-primary/40 shadow-lg shadow-primary/10"
                  : "border-border"
              }`}
            >
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="mb-1 text-sm font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Install Steps */}
      <section className="mx-auto max-w-2xl px-6 pb-24">
        <h2 className="mb-8 text-center text-2xl font-bold">Get Started</h2>
        <ol className="space-y-4">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </span>
              <span className="pt-1 text-sm text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Architecture */}
      <section className="mx-auto max-w-2xl px-6 pb-24">
        <h2 className="mb-6 text-center text-2xl font-bold">Architecture</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <pre className="overflow-x-auto text-xs text-muted-foreground">
{`extension/
├── manifest.json    # V3 manifest
├── background.js    # Service worker
├── content.js       # DOM scan + autofill + learning
├── mapping.js       # Heuristic field mapping engine
├── popup.html/js    # Extension popup UI
├── crm.json         # Mock CRM data source
└── icon.png         # Extension icon`}
          </pre>
        </div>
      </section>

      <footer className="border-t border-border py-12 text-center">
        <div className="mb-4 flex justify-center opacity-50 grayscale transition-all hover:opacity-100 hover:grayscale-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Form Copilot — Smart Browser Automation.
        </p>
      </footer>
    </div>
  );
}
