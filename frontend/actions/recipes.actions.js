"use server";

import { freeMealRecommendations , proTierLimit } from "@/lib/arcjet";
import { checkUser } from '@/lib/checkUser';
import { request } from "@arcjet/next";
import Groq from "groq-sdk";

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
export async function getRecipesByPantryIngredients() {
    try {
        const user = await checkUser();
        if (!user) throw new Error("User not authenticated");

        const isPro = user.subscriptionTier === "pro";
        const arcjetClient = isPro ? proTierLimit : freeMealRecommendations;
        const req = await request();

        const decision = await arcjetClient.protect(req, {
            userId: user.clerkId,
            requested: 1,
        });

        if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) {
                throw new Error(
                    `Monthly scan limit reached. ${isPro ? "Please upgrade to pro for more scans" : "Please wait until your limit resets"}`
                );
            }
            throw new Error("Request denied by security system");
        }

        const pantryResponse = await fetch(
            `${STRAPI_URL}/api/pantry-items?filters[users_permissions_user][id][$eq]=${user.id}`,
            {
                headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
                cache: "no-store",
            }
        );

        if (!pantryResponse.ok) {
            const errorText = await pantryResponse.text();
            console.error("Strapi Error:", pantryResponse.status, errorText);
            throw new Error(`Failed to fetch pantry items: ${pantryResponse.status}`);
        }

        const pantryData = await pantryResponse.json();

        if (!pantryData.data || pantryData.data.length === 0) {
            return {
                success: false,
                message: "Your pantry is empty, Add ingredients first!",
            };
        }

        const ingredients = pantryData.data.map((item) => item.name).join(", ");

        const prompt = `
You are a professional chef. Given these available ingredients: ${ingredients}

Suggest 5 recipes that can be made primarily with these ingredients. It's okay if the recipes need 1-2 common pantry staples (salt, pepper, oil, etc.) that aren't listed.

Return ONLY a valid JSON array (no markdown, no explanations):
[
  {
    "title": "Recipe name",
    "description": "Brief 1-2 sentence description",
    "matchPercentage": 85,
    "missingIngredients": ["ingredient1", "ingredient2"],
    "category": "breakfast|lunch|dinner|snack|dessert",
    "cuisine": "italian|chinese|mexican|etc",
    "prepTime": 20,
    "cookTime": 30,
    "servings": 4
  }
]

Rules:
- matchPercentage should be 70-100% (how many listed ingredients are used)
- missingIngredients should be common items or optional additions
- Sort by matchPercentage descending
- Make recipes realistic and delicious
`;

const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "system",
      content: "Return ONLY valid JSON. No markdown. No explanations.",
    },
    {
      role: "user",
      content: prompt,
    },
  ],
  temperature: 0.3,
});
const text = completion.choices[0].message.content;

        let recipeSuggestions;
        try {
            const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            recipeSuggestions = JSON.parse(cleanText);
        } catch (parseError) {
            console.error("Failed to parse Groq response: ", text);
            throw new Error("Failed to generate recipe suggestions. Please try again.");
        }

        return {
            success: true,
            recipes: recipeSuggestions,
            ingredientsUsed: ingredients,
            recommendationsLimit: isPro ? "unlimited" : 5,
            message: `Found ${recipeSuggestions.length} recipes you can make!`,
        };
    } catch (error) {
        console.error("Error in getRecipesByPantryIngredients", error);
        throw new Error(error.message || "Failed to get recipe suggestions");
    }
}

function normalizeTitle(title) {
    return title
        .trim()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

async function fetchRecipeImage(recipeName) {
    try {
        if (!UNSPLASH_ACCESS_KEY) {
            console.warn("UNSPLASH_ACCESS_KEY not set, skipping image fetch");
            return "";
        }

        const response = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(recipeName)}&per_page=1&orientation=landscape`,
            {
                headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
            }
        );

        if (!response.ok) {
            console.error("Unsplash API error:", response.statusText);
            return "";
        }

        const data = await response.json();
        console.log("Unsplash response results count:", data.results?.length);

        if (data.results && data.results.length > 0) {
            const photo = data.results[0];
            console.log("Found Unsplash Image:", photo.urls.regular);
            return photo.urls.regular;
        }

        return "";
    } catch (error) {
        console.error("Error fetching Unsplash image: ", error);
        return "";
    }
}

export async function getOrGenerateRecipe(formData) {
    try {
        const user = await checkUser();
        if (!user) throw new Error("User not authenticated");

        const recipeName = formData.get("recipeName");
        if (!recipeName) throw new Error("Recipe name is required");

        const normalizedTitle = normalizeTitle(recipeName);
        const isPro = user.subscriptionTier === "pro";

        // Step 1 — check DB first
        const searchResponse = await fetch(
            `${STRAPI_URL}/api/recipes?filters[title][$eqi]=${encodeURIComponent(normalizedTitle)}&populate=*`,
            {
                headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
                cache: "no-store",
            }
        );

        if (searchResponse.ok) {
            const searchData = await searchResponse.json();

            if (searchData.data && searchData.data.length > 0) {
                const existingRecipe = searchData.data[0];

                // Backfill missing image
                if (!existingRecipe.imageUrl) {
                    const imageUrl = await fetchRecipeImage(normalizedTitle);
                    if (imageUrl) {
                        await fetch(`${STRAPI_URL}/api/recipes/${existingRecipe.id}`, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
                            },
                            body: JSON.stringify({ data: { imageUrl } }),
                        });
                        existingRecipe.imageUrl = imageUrl;
                    }
                }

                const savedRecipeResponse = await fetch(
                    `${STRAPI_URL}/api/saved-recipes?filters[user][id][$eq]=${user.id}&filters[recipe][id][$eq]=${existingRecipe.id}`,
                    {
                        headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
                        cache: "no-store",
                    }
                );

                let isSaved = false;
                if (savedRecipeResponse.ok) {
                    const savedData = await savedRecipeResponse.json();
                    isSaved = savedData.data && savedData.data.length > 0;
                }

                return {
                    success: true,
                    recipe: existingRecipe,
                    recipeId: existingRecipe.id,
                    isSaved,
                    formDatabase: true,
                    message: "Recipe loaded from database",
                };
            }
        }

        // Step 2 — generate with Gemini
        const prompt = `You are a professional chef and recipe expert. Generate a detailed recipe for: "${normalizedTitle}"

CRITICAL: The "title" field MUST be EXACTLY: "${normalizedTitle}" (no changes, no additions like "Classic" or "Easy")

Return ONLY a valid JSON object with this exact structure (no markdown, no explanations):
{
  "title": "${normalizedTitle}",
  "description": "Brief 2-3 sentence description of the dish",
  "category": "Must be ONE of these EXACT values: breakfast, lunch, dinner, snack, dessert",
  "cuisine": "Must be ONE of these EXACT values: italian, chinese, mexican, indian, american, thai, japanese, mediterranean, french, korean, vietnamese, spanish, greek, turkish, moroccan, brazilian, caribbean, middle-eastern, british, german, portuguese, other",
  "prepTime": "Time in minutes (number only)",
  "cookTime": "Time in minutes (number only)",
  "servings": "Number of servings (number only)",
  "ingredients": [
    {
      "item": "ingredient name",
      "amount": "quantity with unit",
      "category": "Protein|Vegetable|Spice|Dairy|Grain|Other"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "title": "Brief step title",
      "instruction": "Detailed step instruction",
      "tip": "Optional cooking tip for this step"
    }
  ],
  "nutrition": {
    "calories": "calories per serving",
    "protein": "grams",
    "carbs": "grams",
    "fat": "grams"
  },
  "tips": [
    "General cooking tip 1",
    "General cooking tip 2",
    "General cooking tip 3"
  ],
  "substitutions": [
    {
      "original": "ingredient name",
      "alternatives": ["substitute 1", "substitute 2"]
    }
  ]
}

IMPORTANT RULES FOR CATEGORY:
- Breakfast items (pancakes, eggs, cereal, etc.) → "breakfast"
- Main meals for midday (sandwiches, salads, pasta, etc.) → "lunch"
- Main meals for evening (heavier dishes, roasts, etc.) → "dinner"
- Light items between meals (chips, crackers, fruit, etc.) → "snack"
- Sweet treats (cakes, cookies, ice cream, etc.) → "dessert"

IMPORTANT RULES FOR CUISINE:
- Use lowercase only
- Pick the closest match from the allowed values
- If uncertain, use "other"

Guidelines:
- Make ingredients realistic and commonly available
- Instructions should be clear and beginner-friendly
- Include 6-10 detailed steps
- Provide practical cooking tips
- Estimate realistic cooking times
- Keep total instructions under 12 steps
`;

const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "system",
      content: "Return ONLY valid JSON. No markdown. No explanations.",
    },
    {
      role: "user",
      content: prompt,
    },
  ],
  temperature: 0.3,
});

const text = completion.choices[0].message.content;

        let recipeData;
        try {
            const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            recipeData = JSON.parse(cleanText);
        } catch (parseError) {
            console.error("Failed to parse groq response:", text);
            throw new Error("Failed to generate recipe. Please try again.");
        }

        recipeData.title = normalizedTitle;
        const category = recipeData.category.toLowerCase();
        const cuisine = recipeData.cuisine.toLowerCase();

        // Step 3 — fetch image
        const imageUrl = await fetchRecipeImage(normalizedTitle);
        console.log("Image Url:", imageUrl);

        // Step 4 — save to Strapi
        const strapiRecipeData = {
            data: {
                title: normalizedTitle,
                description: recipeData.description,
                cuisine,
                category,
                ingredients: recipeData.ingredients,
                instructions: recipeData.instructions,
                prepTime: Number(recipeData.prepTime),
                cookTime: Number(recipeData.cookTime),
                servings: Number(recipeData.servings),
                nutrition: recipeData.nutrition,
                tips: recipeData.tips,
                substitution: recipeData.substitutions,
                imageUrl: imageUrl || "",
                isPublic: true,
                users_permissions_user: user.id,
            },
        };

        const createRecipeResponse = await fetch(`${STRAPI_URL}/api/recipes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: JSON.stringify(strapiRecipeData),
        });

        if (!createRecipeResponse.ok) {
            const errorText = await createRecipeResponse.text();
            console.error("Failed to save recipe:", errorText);
            throw new Error("Failed to save Recipe to database");
        }

        const createdRecipe = await createRecipeResponse.json();

        return {
            success: true,
            recipe: {
                ...recipeData,
                title: normalizedTitle,
                category,
                cuisine,
                imageUrl: imageUrl || "",
            },
            recipeId: createdRecipe.data.id,
            isSaved: false,
            formDatabase: false,
            recommendationsLimit: isPro ? "unlimited" : 5,
            message: "Recipe generated and saved successfully",
        };
    } catch (error) {
        console.error("Error in getOrGenerateRecipe: ", error);
        throw new Error(error.message || "Failed to load recipe");
    }
}

export async function saveRecipeToCollection(formData) {
    try {
        const user = await checkUser();
        if (!user) throw new Error("User not authenticated");

        const recipeId = formData.get("recipeId");
        if (!recipeId) throw new Error("Recipe ID is required");

        const existingResponse = await fetch(
            `${STRAPI_URL}/api/saved-recipes?filters[user][id][$eq]=${user.id}&filters[recipe][id][$eq]=${recipeId}`,
            {
                headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
                cache: "no-store",
            }
        );

        if (existingResponse.ok) {
            const existingData = await existingResponse.json();
            if (existingData.data && existingData.data.length > 0) {
                return {
                    success: true,
                    alreadySaved: true,
                    message: "Recipe is already in your collection",
                };
            }
        }

        const saveResponse = await fetch(`${STRAPI_URL}/api/saved-recipes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: JSON.stringify({
                data: {
                    user: user.id,
                    recipe: recipeId,
                    savedAs: new Date().toISOString(),
                },
            }),
        });

        if (!saveResponse.ok) {
            const errorText = await saveResponse.text();
            console.error("Failed to save Recipe: ", errorText);
            throw new Error("Failed to save recipe to collection");
        }

        const savedRecipe = await saveResponse.json();

        return {
            success: true,
            alreadySaved: false,
            savedRecipe: savedRecipe.data,
            message: "Recipe saved to your collection!",
        };
    } catch (error) {
        console.error("Error saving recipe to collection:", error);
        throw new Error(error.message || "Failed to save recipe");
    }
}

export async function removeRecipeFromCollection(formData) {
    try {
        const user = await checkUser();
        if (!user) throw new Error("User not authenticated");

        const recipeId = formData.get("recipeId");
        if (!recipeId) throw new Error("Recipe ID is required");

        const searchResponse = await fetch(
            `${STRAPI_URL}/api/saved-recipes?filters[user][id][$eq]=${user.id}&filters[recipe][id][$eq]=${recipeId}`,
            {
                headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
                cache: "no-store",
            }
        );

        if (!searchResponse.ok) throw new Error("Failed to find saved recipe");

        const searchData = await searchResponse.json();

        if (!searchData.data || searchData.data.length === 0) {
            return { success: true, message: "Recipe was not in your collection" };
        }

        const savedRecipeId = searchData.data[0].id;
        const deleteResponse = await fetch(
            `${STRAPI_URL}/api/saved-recipes/${savedRecipeId}`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
            }
        );

        if (!deleteResponse.ok) throw new Error("Failed to remove recipe from collection");

        return { success: true, message: "Recipe removed from your collection" };
    } catch (error) {
        console.error("Error removing recipe from collection: ", error);
        throw new Error(error.message || "Failed to remove recipe");
    }
}

export async function getSavedRecipes() {
    try {
        const user = await checkUser();
        if (!user) throw new Error("User not authenticated");

        const response = await fetch(
            `${STRAPI_URL}/api/saved-recipes?filters[user][id][$eq]=${user.id}&populate[recipe][populate]=*&sort=savedAs:desc`,
            {
                headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
                cache: "no-store",
            }
        );

        if (!response.ok) throw new Error("Failed to fetch saved recipes");

        const data = await response.json();
        const recipes = data.data.map((savedRecipe) => savedRecipe.recipe).filter(Boolean);

        return {
            success: true,
            recipes,
            count: recipes.length,
        };
    } catch (error) {
        console.error("Error fetching saved recipes: ", error);
        throw new Error(error.message || "Failed to load saved recipes");
    }
}