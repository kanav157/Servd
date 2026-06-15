"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Plus, Check, X, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogHeader,
} from "./ui/dialog";
import { scanPantryItem } from "@/actions/pantry.actions";
import useFetch from "@/hooks/use-fetch";
import { Badge } from "@/components/ui/badge";
import { saveToPantry, addPantryItemManually } from "@/actions/pantry.actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const AddToPantryModal = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState("scan");
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scannedIngredients, setScannedIngredients] = useState([]);
  const [manualItem, setManualItem] = useState({ name: "", quantity: "" });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleClose = () => {
    setActiveTab("scan");
    setSelectedImage(null);
    setPreviewUrl(null);
    setScannedIngredients([]);
    setManualItem({ name: "", quantity: "" });
    onClose();
  };

  const { loading: scanning, data: scanData, fn: scanImage } = useFetch(scanPantryItem);
  const { loading: saving, data: saveData, fn: saveScannedItems } = useFetch(saveToPantry);
  const { loading: adding, data: addData, fn: addManualItem } = useFetch(addPantryItemManually);

  useEffect(() => {
    if (scanData?.success && scanData?.ingredients) {
      setScannedIngredients(scanData.ingredients);
      toast.success(`Found ${scanData.ingredients.length} ingredients!`);
    }
  }, [scanData]);

  useEffect(() => {
    if (addData?.success) {
      toast.success("Item added to pantry!");
      setManualItem({ name: "", quantity: "" });
      handleClose();
      if (onSuccess) onSuccess();
    }
  }, [addData]);

  useEffect(() => {
    if (saveData?.success) {
      toast.success(saveData.message);
      handleClose();
      if (onSuccess) onSuccess();
    }
  }, [saveData]);

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setScannedIngredients([]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleScan = async () => {
    if (!selectedImage) return;
    const formData = new FormData();
    formData.append("image", selectedImage);
    await scanImage(formData);
  };

  const handleSaveScanned = async () => {
    if (scannedIngredients.length === 0) {
      toast.error("No ingredients to save");
      return;
    }
    const formData = new FormData();
    formData.append("ingredients", JSON.stringify(scannedIngredients));
    await saveScannedItems(formData);
  };

  const handleAddManual = async (e) => {
    e.preventDefault();
    if (!manualItem.name.trim() || !manualItem.quantity.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    const formData = new FormData();
    formData.append("name", manualItem.name);
    formData.append("quantity", manualItem.quantity);
    await addManualItem(formData);
  };

  const removeIngredients = (index) => {
    setScannedIngredients(scannedIngredients.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-bold text-stone-900">
            Add to Pantry
          </DialogTitle>
          <DialogDescription className="text-stone-500 text-sm">
            Scan your pantry with AI or add items manually
          </DialogDescription>
        </DialogHeader>

        {/* Custom Tab Buttons */}
        <div className="flex rounded-xl bg-stone-100 p-1 mb-5">
          <button
            onClick={() => setActiveTab("scan")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === "scan"
                ? "bg-white shadow-sm text-stone-900"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <Camera className="w-4 h-4" />
            AI Scan
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === "manual"
                ? "bg-white shadow-sm text-stone-900"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Manually
          </button>
        </div>

        {/* AI Scan Tab */}
        {activeTab === "scan" && (
          <div className="space-y-4">
            {scannedIngredients.length === 0 ? (
              <>
                {/* Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  className={`w-full rounded-2xl border-2 border-dashed transition-colors bg-orange-50 py-10 px-6 flex flex-col items-center gap-4 text-center ${
                    isDragging ? "border-orange-500 bg-orange-100" : "border-orange-300"
                  }`}
                >
                  {previewUrl ? (
                    <div className="relative w-full">
                      <img
                        src={previewUrl}
                        alt="Selected"
                        className="w-full max-h-48 object-contain rounded-xl"
                      />
                      <button
                        onClick={() => { setSelectedImage(null); setPreviewUrl(null); }}
                        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"
                      >
                        <X className="w-4 h-4 text-stone-500" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Orange camera bubble */}
                      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                        <Camera className="w-8 h-8 text-orange-500" />
                      </div>

                      <div>
                        <p className="text-lg font-bold text-stone-900">Scan Your Pantry</p>
                        <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                          Take a photo or drag &amp; drop an image of your fridge/pantry
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-5 h-10 gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          Take Photo
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-xl px-5 h-10 gap-2 border-stone-300 text-stone-700 hover:bg-stone-50"
                        >
                          <Upload className="w-4 h-4" />
                          Browse Files
                        </Button>
                      </div>

                      <p className="text-xs text-stone-400">
                        Supports JPG, PNG, WebP • Max 10MB
                      </p>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />

                {selectedImage && (
                  <Button
                    onClick={handleScan}
                    disabled={scanning}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-base rounded-xl"
                  >
                    {scanning ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Analyzing…</>
                    ) : (
                      <><Camera className="w-5 h-5 mr-2" />Scan Image</>
                    )}
                  </Button>
                )}
              </>
            ) : (
              /* Review & Save */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-stone-900">Review Detected Items</h3>
                    <p className="text-sm text-stone-500">Found {scannedIngredients.length} ingredients</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setScannedIngredients([]); setSelectedImage(null); setPreviewUrl(null); }}
                    className="gap-2 rounded-xl"
                  >
                    <Camera className="w-4 h-4" />
                    Scan Again
                  </Button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {scannedIngredients.map((ingredient, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-stone-900 truncate">{ingredient.name}</div>
                        <div className="text-sm text-stone-500">{ingredient.quantity}</div>
                      </div>
                      {ingredient.confidence && (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-200 shrink-0">
                          {Math.round(ingredient.confidence * 100)}%
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeIngredients(index)}
                        className="text-stone-400 hover:text-red-500 shrink-0 p-1 h-auto"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleSaveScanned}
                  disabled={saving || scannedIngredients.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl text-base"
                >
                  {saving ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Saving…</>
                  ) : (
                    <><Check className="w-5 h-5 mr-2" />Save {scannedIngredients.length} Items to Pantry</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Manual Add Tab */}
        {activeTab === "manual" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Ingredient Name
              </label>
              <input
                type="text"
                value={manualItem.name}
                onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                placeholder="e.g., Chicken breast"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                disabled={adding}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Quantity
              </label>
              <input
                type="text"
                value={manualItem.quantity}
                onChange={(e) => setManualItem({ ...manualItem, quantity: e.target.value })}
                placeholder="e.g., 500g, 2 cups, 3 pieces"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                disabled={adding}
              />
            </div>
            <Button
              onClick={handleAddManual}
              disabled={adding}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 rounded-xl text-base"
            >
              {adding ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Adding…</>
              ) : (
                <><Plus className="w-5 h-5 mr-2" />Add Item</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddToPantryModal;