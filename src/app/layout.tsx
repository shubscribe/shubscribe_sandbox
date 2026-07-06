import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans-var",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mission Control — Job Tracker",
  description: "Personal job application tracker and mission control dashboard",
  manifest: "/manifest.json",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Mission Control" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c1a" },
    { media: "(prefers-color-scheme: light)", color: "#f4f4fb" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <div className="ambient" />
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: { toast: "glass-raised !rounded-2xl !text-ink" },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
