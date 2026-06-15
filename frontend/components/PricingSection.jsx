import react from "react";
import { PricingTable } from "@clerk/nextjs";

const PricingSection = () => {
    return (
       <div>
        <div className = "mb-16">
            <h2 className = "text-5xl md:text-6xl font-bold text-center">Simple Pricing</h2>
            <p className = "text-center text-lg text-gray-600 mt-4">Choose the plan that’s right for you and start cooking up a storm!</p>
        </div>

        <div className = "mx-auto">
             <PricingTable checkoutProps={{
                            appearance: {
                              elements: {
                                drawerRoot: {
                                  zIndex: 2000,
                                }
                              }
                            }
                          }}/>
        </div>
        </div>

    );
}

export default PricingSection;