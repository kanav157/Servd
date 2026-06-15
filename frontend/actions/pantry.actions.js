"use server";

import { freePantryScans , proTierLimit } from "@/lib/arcjet";
import { checkUser } from '@/lib/checkUser';
import { request } from "@arcjet/next";
import Groq from "groq-sdk";
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
export async function scanPantryItem(formData)
{
    try {
        const user = await checkUser();
        if (!user)
        {
            throw new Error("User not authenticated");
        }

        const isPro = user.subscription === "pro";

        const arcjetClient = isPro ? proTierLimit : freePantryScans;

        const req = await request();

        const decision = await arcjetClient.protect(req, { 
            userId: user.clerkId,
            requested: 1,
        });

        if (decision.isDenied())
        {
            if (decision.reason.isRateLimit())
            {
                throw new Error (
                    `Monthly scan limit reached. ${
                        isPro ? "Please upgrade to pro for more scans" : "Please wait until your limit resets"
                    }`
                );
            }
            throw new Error ("Request denied by security system");
        }

        const imageFile = formData.get("image");
        if (!imageFile)
        {
            throw new Error("No image provided");
        }

        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString("base64");

        const prompt = `
You are a professional chef and ingredient recognition expert. Analyze this image of a pantry/fridge and identify all visible food ingredients.

Return ONLY a valid JSON array with this exact structure (no markdown, no explanations):
[
  {
    "name": "ingredient name",
    "quantity": "estimated quantity with unit",
    "confidence": 0.95
  }
]

Rules:
- Only identify food ingredients (not containers, utensils, or packaging)
- Be specific (e.g., "Cheddar Cheese" not just "Cheese")
- Estimate realistic quantities (e.g., "3 eggs", "1 cup milk", "2 tomatoes")
- Confidence should be 0.7-1.0 (omit items below 0.7)
- Maximum 20 items
- Common pantry staples are acceptable (salt, pepper, oil)
`;

const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "user",
      content: prompt,
    },
  ],
  temperature: 0.7,
});

const text = completion.choices[0].message.content;

        let ingredients;
        try {
            const cleanText = text
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();
            ingredients = JSON.parse(cleanText);
        }
        catch(error)
        {
            console.error("Failed to parse Groq response: ", text);
            throw new Error("Failed to parse ingredients. Please try again.");
        }

        if (!Array.isArray(ingredients) || ingredients.length === 0)
        {
            throw new Error(
                "No ingredients detected in the image. Please try again with a clearer image or different angle."
            );
        }

        return {
            success: true,
            ingredients: ingredients.slice(0, 20),
            scansLimit: isPro ? "unlimited" : 10,
            message: `Found ${ingredients.length} ingredients!`,
        };
    }
    catch (error) {
        console.error("Error scanning pantry: ", error);
        throw new Error(error.message || "Failed to scan image");
    }
}

export async function saveToPantry(formData)
{
    try {
        const user = await checkUser();
        if (!user)
        {
            throw new Error("User not authenticated");
        }

        const ingredientsJson = formData.get("ingredients");
        const ingredients = JSON.parse(ingredientsJson);

        if (!ingredients || ingredients.length === 0)
        {
            throw new Error("No ingredients to save");
        }

        const savedItems = [];

        for (const ingredient of ingredients)
        {
            const response = await fetch(`${STRAPI_URL}/api/pantry-items`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${STRAPI_API_TOKEN}`,
                },
                body: JSON.stringify({
                    data: {
                        name: ingredient.name,
                        quantity: ingredient.quantity,
                        imageUrl: "",
                        users_permissions_user: user.id,
                    },
                }),
            });

            if (response.ok)
            {
                const data = await response.json();
                savedItems.push(data.data);
            }
        }

        return {
            success: true,
            savedItems,
            message: `Saved ${savedItems.length} items to your pantry!`,
        };
    }
    catch (error) {
        console.error("Error saving pantry item: ", error);
        throw new Error(error.message || "Failed to save pantry item");
    }
}

export async function addPantryItemManually(formData)
{
    try {
        const user = await checkUser();
        if (!user)
        {
            throw new Error("User not authenticated");
        }

        const name = formData.get("name");
        const quantity = formData.get("quantity");

        if (!name || !quantity)
        {
            throw new Error("Name and quantity are required");
        }

        const response = await fetch(`${STRAPI_URL}/api/pantry-items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: JSON.stringify({
                data: {
                    name: name.trim(),
                    quantity: quantity.trim(),
                    imageUrl: "",
                    users_permissions_user: user.id,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Status:", response.status);
            console.error("Error:", errorText);
            throw new Error(errorText);
        }

        const data = await response.json();

        return {
            success: true,
            item: data.data,
            message: "Item added successfully",
        };
    }
    catch (error)
    {
        console.error("Error adding pantry item manually: ", error);
        throw new Error(error.message || "Failed to add pantry item");
    }
}

export async function getPantryItems()
{
    try {
        const user = await checkUser();
        if (!user)
        {
            throw new Error("User not authenticated");
        }

        const response = await fetch(
            `${STRAPI_URL}/api/pantry-items?filters[users_permissions_user][id][$eq]=${user.id}&sort=createdAt:desc`,
            {
                headers: {
                    Authorization: `Bearer ${STRAPI_API_TOKEN}`,
                },
                cache: "no-store",
            }
        );

        if (!response.ok)
        {
            const errorText = await response.text();
            console.log("STATUS:", response.status);
            console.log("ERROR:", errorText);
            throw new Error(errorText);
        }

        const data = await response.json();
        const isPro = user.subscriptionTier === "pro";

        return {
            success: true,
            items: data.data || [],
            scansLimit: isPro ? "unlimited" : 10,
        };
    }
    catch (error)
    {
        console.error("Error fetching pantry items: ", error);
        throw new Error(error.message || "Failed to fetch pantry items");
    }
}

export async function deletePantryItem(formData)
{
    try {
        const user = await checkUser();
        if (!user)
        {
            throw new Error("User not authenticated");
        }

        const itemId = formData.get("itemId");

        const response = await fetch(
            `${STRAPI_URL}/api/pantry-items/${itemId}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${STRAPI_API_TOKEN}`,
                },
            }
        );

        if (!response.ok)
        {
            throw new Error("Failed to delete pantry item");
        }

        return {
            success: true,
            message: "Item removed from pantry",
        };
    }
    catch (error)
    {
        console.error("Error deleting pantry item: ", error);
        throw new Error(error.message || "Failed to delete pantry item");
    }
}

export async function updatePantryItem(formData)
{
    try {
        const user = await checkUser();
        if (!user)
        {
            throw new Error("User not authenticated");
        }

        const itemId = formData.get("itemId");
        const name = formData.get("name");
        const quantity = formData.get("quantity");

        const response = await fetch(
            `${STRAPI_URL}/api/pantry-items/${itemId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${STRAPI_API_TOKEN}`,
                },
                body: JSON.stringify({
                    data: {
                        name,
                        quantity,
                    },
                }),
            }
        );

        if (!response.ok)
        {
            throw new Error("Failed to update pantry item");
        }

        const data = await response.json();

        return {
            success: true,
            item: data.data,
            message: "Item updated successfully",
        };
    }
    catch (error)
    {
        console.error("Error updating pantry item: ", error);
        throw new Error(error.message || "Failed to update pantry item");
    }
}