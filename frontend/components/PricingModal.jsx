"use client";

import React from "react";
import PricingSection from "./PricingSection";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PricingModal = ({ subscriptionTier = "free", children }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const canOpen = subscriptionTier === "free";

  const handleOpenChange = (open) => {
    if (canOpen) {
      setIsOpen(open);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>

      <DialogContent className="p-8 pt-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle />
        </DialogHeader>

        <PricingSection />
      </DialogContent>
    </Dialog>
  );
};

export default PricingModal;