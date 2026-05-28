export type ThemeSettings = {
  background: string;
  foreground: string;
  muted: string;
  buttonBackground: string;
  buttonForeground: string;
  buttonBorder: string;
  buttonBorderWidth: number;
  accent: string;
  fontFamily: string;
  radius: number;
  shadow: string;
  layout: "stack" | "compact" | "spotlight";
  backgroundImage?: string;
};

export const defaultThemes: Array<{ name: string; isDefault: boolean; settings: ThemeSettings }> = [
  {
    name: "Harbor Light",
    isDefault: true,
    settings: {
      background: "#fbfaf7",
      foreground: "#151515",
      muted: "#66615b",
      buttonBackground: "#151515",
      buttonForeground: "#ffffff",
      buttonBorder: "#151515",
      buttonBorderWidth: 1,
      accent: "#2f8f9d",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      radius: 8,
      shadow: "0 12px 28px rgba(21,21,21,.12)",
      layout: "stack"
    }
  },
  {
    name: "Studio Moss",
    isDefault: false,
    settings: {
      background: "#edf1ea",
      foreground: "#1d261f",
      muted: "#5d685f",
      buttonBackground: "#49634d",
      buttonForeground: "#ffffff",
      buttonBorder: "#344838",
      buttonBorderWidth: 1,
      accent: "#db6b57",
      fontFamily: "Georgia, ui-serif, serif",
      radius: 6,
      shadow: "0 10px 24px rgba(29,38,31,.14)",
      layout: "compact"
    }
  },
  {
    name: "Signal Coral",
    isDefault: false,
    settings: {
      background: "#fff6f1",
      foreground: "#231917",
      muted: "#765d55",
      buttonBackground: "#db6b57",
      buttonForeground: "#ffffff",
      buttonBorder: "#b64d3c",
      buttonBorderWidth: 1,
      accent: "#2f8f9d",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      radius: 4,
      shadow: "0 16px 30px rgba(219,107,87,.2)",
      layout: "spotlight"
    }
  },
  {
    name: "Ink Terminal",
    isDefault: false,
    settings: {
      background: "#101211",
      foreground: "#f3f7f1",
      muted: "#a7b0a8",
      buttonBackground: "#f3f7f1",
      buttonForeground: "#101211",
      buttonBorder: "#7ee081",
      buttonBorderWidth: 2,
      accent: "#7ee081",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      radius: 3,
      shadow: "0 0 0 1px rgba(126,224,129,.35), 0 12px 26px rgba(0,0,0,.25)",
      layout: "stack"
    }
  },
  {
    name: "Gallery White",
    isDefault: false,
    settings: {
      background: "#ffffff",
      foreground: "#1c1c1c",
      muted: "#6f6f6f",
      buttonBackground: "#ffffff",
      buttonForeground: "#1c1c1c",
      buttonBorder: "#d8d8d8",
      buttonBorderWidth: 1,
      accent: "#c23b52",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      radius: 2,
      shadow: "0 8px 22px rgba(0,0,0,.08)",
      layout: "compact"
    }
  },
  {
    name: "Poolside",
    isDefault: false,
    settings: {
      background: "linear-gradient(160deg, #e4fbff 0%, #fdf7e7 100%)",
      foreground: "#15363b",
      muted: "#527176",
      buttonBackground: "#2f8f9d",
      buttonForeground: "#ffffff",
      buttonBorder: "#1f6972",
      buttonBorderWidth: 1,
      accent: "#f2b84b",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      radius: 14,
      shadow: "0 18px 35px rgba(47,143,157,.18)",
      layout: "spotlight"
    }
  },
  {
    name: "Night Market",
    isDefault: false,
    settings: {
      background: "#18141f",
      foreground: "#fff8ef",
      muted: "#c8b8d9",
      buttonBackground: "#ffcf5a",
      buttonForeground: "#21160f",
      buttonBorder: "#ff8f70",
      buttonBorderWidth: 2,
      accent: "#ff8f70",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      radius: 10,
      shadow: "0 14px 32px rgba(255,143,112,.18)",
      layout: "stack"
    }
  },
  {
    name: "Editorial Blue",
    isDefault: false,
    settings: {
      background: "#eef3f8",
      foreground: "#17212c",
      muted: "#596879",
      buttonBackground: "#17212c",
      buttonForeground: "#ffffff",
      buttonBorder: "#17212c",
      buttonBorderWidth: 1,
      accent: "#d64e40",
      fontFamily: "Georgia, ui-serif, serif",
      radius: 0,
      shadow: "0 10px 24px rgba(23,33,44,.12)",
      layout: "spotlight"
    }
  },
  {
    name: "Candy Glass",
    isDefault: false,
    settings: {
      background: "linear-gradient(145deg, #ffe3ee 0%, #d8f4ff 55%, #fff7d6 100%)",
      foreground: "#241b2f",
      muted: "#6f5c7d",
      buttonBackground: "rgba(255,255,255,.72)",
      buttonForeground: "#241b2f",
      buttonBorder: "#ffffff",
      buttonBorderWidth: 1,
      accent: "#d93b8c",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      radius: 18,
      shadow: "0 18px 35px rgba(84,45,120,.16)",
      layout: "compact"
    }
  },
  {
    name: "Paper Trail",
    isDefault: false,
    settings: {
      background: "#f7f2e8",
      foreground: "#26211b",
      muted: "#75695d",
      buttonBackground: "#fffdf8",
      buttonForeground: "#26211b",
      buttonBorder: "#b8aa98",
      buttonBorderWidth: 1,
      accent: "#326a64",
      fontFamily: "Georgia, ui-serif, serif",
      radius: 5,
      shadow: "3px 3px 0 rgba(38,33,27,.18)",
      layout: "stack"
    }
  }
];

export function parseTheme(settings?: string | null): ThemeSettings {
  if (!settings) return defaultThemes[0].settings;
  try {
    return { ...defaultThemes[0].settings, ...JSON.parse(settings) };
  } catch {
    return defaultThemes[0].settings;
  }
}
