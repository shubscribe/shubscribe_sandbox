import type { Metadata } from "next";
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
