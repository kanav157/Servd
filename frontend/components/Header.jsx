import React from "react";
import {
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";

import { auth } from "@clerk/nextjs/server";

import Link from "next/link";
import Image from "next/image";

import {
  Cookie,
  Refrigerator,
  Sparkles,
} from "lucide-react";

import UserDropdown from "./UserDropdown";
import PricingModal from "./PricingModal";
import { Badge } from "@/components/ui/badge";
import { checkUser } from "@/lib/checkUser";
import HowToCookModal from "@/components/HowToCookModal";
const Header = async () => {

  const { userId } = await auth();

  // Fetch user from DB
  const user = await checkUser();

  // Dynamic plan
  const subscriptionTier = user?.subscriptionTier || "free";

  return (
    <header className="fixed top-0 w-full bg-white border-b border-gray-200 backdrop-blur-md z-50 supports-backdrop-blur:bg-white/75">

      <nav className="container mx-auto px-4 h-16 flex justify-between items-center gap-2">

        {/* Logo */}
        <Link
          href={userId ? "/dashboard" : "/"}
          className="flex items-center text-2xl font-bold text-gray-900"
        >
          <Image
            src="/logo.png"
            alt="Logo"
            width={36}
            height={36}
            className="mr-2"
          />
          Servd
        </Link>

        {/* Navigation */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">

          <Link
            href="/recipes"
            className="flex items-center gap-2 hover:text-orange-500 transition-colors duration-300"
          >
            <Cookie className="w-4 h-4" />
            My Recipes
          </Link>

          <Link
            href="/pantry"
            className="flex items-center gap-2 hover:text-orange-500 transition-colors duration-300"
          >
            <Refrigerator className="w-4 h-4" />
            My Pantry
          </Link>

        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
         <HowToCookModal />

          {userId ? (
            <>
              {/* Plan Badge */}
<PricingModal>
  <button
    type="button"
    className="focus:outline-none"
  >
    <Badge
      variant="outline"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
        subscriptionTier === "pro"
          ? "bg-gradient-to-r from-orange-600 to-amber-500 text-white border-none shadow-md"
          : "bg-orange-100 text-orange-700 border-orange-200"
      }`}
    >
      <Sparkles className="w-3 h-3" />
      <span>
        {subscriptionTier === "pro"
          ? "Pro Chef"
          : "Free Plan"}
      </span>
    </Badge>
  </button>
</PricingModal>
              {/* User Avatar */}
              <UserDropdown />
            </>
          ) : (
            <>
<SignInButton mode="modal">
  <button className="bg-orange-400 text-black rounded-full px-5 py-2">
    Sign In
  </button>
</SignInButton>

<SignUpButton mode="modal">
  <button className="bg-blue-500 text-white rounded-full px-5 py-2">
    Get Started
  </button>
</SignUpButton>

           </>
          )}

        </div>

      </nav>

    </header>
  );
};

export default Header;