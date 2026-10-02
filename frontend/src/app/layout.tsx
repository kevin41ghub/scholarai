import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Header from "@/components/Header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SCHOLARAi — Student Funding & Application Intelligence",
  description:
    "Student Funding & Application Intelligence platform. AI assists. Official sources decide. Student approves.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        <div className="flex min-h-screen">
          <Navigation />
          <div className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
              SCHOLARAi Phase 1 Foundation &bull; Trust principle: &ldquo;AI assists. Official sources decide. Student approves.&rdquo;
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
