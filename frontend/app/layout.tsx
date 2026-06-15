import Header from "@/components/Header";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";
import { Inter, Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import {Toaster} from "@/components/ui/sonner";
const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"]
})
export const metadata: Metadata = {
  title: "Servd - AI Recipes Platform",
  description: "Discover and share AI recipes on Servd, the ultimate platform for AI enthusiasts. Explore a wide range of AI recipes, from machine learning models to natural language processing techniques. Join our community to share your own AI recipes and learn from others. Start your AI journey with Servd today!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
    <html
      lang="en" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        <Header/>
        <main className = "min-h-screen">
        {children}</main>
        <Toaster richColors />
        <footer className="py-8 px-4 border-t">
          <div className = "max-w-6xl mx-auto flex justify-center items-center">
            <p className = "text-sm text-gray-500">© 2024 Servd. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
    </ClerkProvider>
  );
}
