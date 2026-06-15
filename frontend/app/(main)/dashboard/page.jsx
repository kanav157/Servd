import React from "react";
import {
  getCategories,
  getRecipeofTheDay,
  getAreas,
} from "../../../actions/mealdb.actions";

import Image from "next/image";
import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { getCategoryEmoji } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {getCountryFlag} from "@/lib/data";
const DashboardPage = async () => {
  const recipeData = await getRecipeofTheDay();
  const categoriesData = await getCategories();
  const areasData = await getAreas();

  const recipeofTheDay = recipeData?.recipe;
  const categories = categoriesData?.categories || [];
  const areas = areasData?.areas || [];

  const uniqueAreas = [
    ...new Map(
        areas.map((area) => [area.strArea, area])
    ).values(),
  ];

  return (
    <div className="min-h-screen bg-stone-50 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-5xl md:text-7xl font-bold text-stone-900 mb-4 tracking-tight leading-tight">
            Fresh Recipes, Served Daily !!
          </h1>

          <p className="text-xl text-stone-600 font-light max-w-2xl">
            Discover thousands of recipes from around the world. Cook,
            create, and savor.
          </p>
        </div>

        {/* Recipe of the Day */}
        {recipeofTheDay && (
            <section className = "mb-24 relative">
                <div className="flex items-center gap-2 mb-6">
                    <Flame className = "w-6 h-6 text-orange-600" />
                    <h2 className="text-3xl font-serif font-bold text-stone-900">
                        Recipe of the Day
                    </h2>
                </div>

                <Link href = {`/recipe?cook=${encodeURIComponent(
                    recipeofTheDay.strMeal
                )}`}>
                    <div className = "relative bg-white border-2 border-stone-900 overflow-hidden hover:border-orange-600 hover:shadow-lg transition-all duration-300 group cursor-pointer">
                        <div className = "grid md:grid-cols-2 gap-0">
                            <div className="relative aspect-4/3 md:aspect-auto border-b-2 md:border-b-0 md:border-r-2 border-stone-900">
                            <Image 
                                src={recipeofTheDay.strMealThumb}
                                alt={recipeofTheDay.strMeal}
                                fill 
                                className = "object-cover"
                                />
                            </div>
                            <div className="p-8 md:pd-12 flex flex-col justify-center">
                                <div className = "flex flex-wrap gap-2 mb-6">
                                    <Badge variant = "outline" className = "border-2 border-orange-600 text-orange-700 bg-orange-50 font-bold">
                                        {recipeofTheDay.strCategory}
                                    </Badge>
                                    <Badge variant = "outline" className = "border-2 border-stone-900 text-stone-700 bg-stone-50 font-bold">
                                        <Globe className = "w-3 h-3 mr-1" />
                                        {recipeofTheDay.strArea}
                                    </Badge>
                                </div>
                                <h3 className="text-4xl md:text-5xl font-bold text-stone-900 mb-4 group-hover:text-orange-600 transition-colors leading-tight">
                                    {recipeofTheDay.strMeal}
                                </h3>

                                <p className="text-stone-600 mb-6 line-clamp-3 font-light text-lg">
                                    {recipeofTheDay.strInstructions?.substring(0, 200)}...
                                </p>

                                <Button variant = "primary" size="lg">
                                    Start Cooking <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </Link>
            </section>
        )}

        <section className = "mb-24">
            <div className="mb-8">
                <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-2">
                    Browse by Category
                </h2>
                <p className="text-stone-600 text-lg font-light">
                    Find Recipes That Match Your Mood
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {categories.map((category) => (
                    <Link 
                        key = {category.strCategory}
                        href = {`/recipes/category/${category.strCategory.toLowerCase()}`}>

                            <div className="bg-white p-6 border-2 border-stone-200 hover:border-orange-600 hover:shadow-lg transition-all text-center group cursor-pointer">
                                <div className="text-4xl mb-3">
                                    {getCategoryEmoji(category.strCategory)}
                                </div>
                                <h3 className="font-bold text-stone-900 group-hover:text-orange-600 transition-colors text-sm">
                                    {category.strCategory}
                                </h3>
                            </div>
                        </Link>
                ))}
            </div>

        </section>

        
        <section className = "mb-24">
            <div className="mb-8">
                <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-2">
                    Explore World Cuisines
                </h2>
                <p className="text-stone-600 text-lg font-light">
                    Travel the globe through food
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {uniqueAreas.map((area) => (
                    <Link 
                        key = {area.strArea}
                        href = {`/recipes/cuisine/${area.strArea.toLowerCase().replace(/\s+/g, "-")}`}>

                            <div className="bg-white p-6 border-2 border-stone-200 hover:border-orange-600 hover:shadow-lg transition-all text-center group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">
                                        {getCountryFlag(area.strArea)}

                                    </span>
                                    <span className="font-bold text-stone-900 group-hover:text-orange-600 transition-colors text-sm break-words text-center">
                                       {area.strArea}
                                    </span>
                                </div>
                                
                            </div>
                        </Link>
                ))}
            </div>

        </section>

      </div>
    </div>
  );
};

export default DashboardPage;