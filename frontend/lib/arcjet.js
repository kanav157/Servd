import arcjet, { shield, tokenBucket, detectBot } from '@arcjet/next';

export const aj = arcjet({
    key: process.env.NEXT_PUBLIC_ARCJET_KEY,
    rules : [
        shield({
            mode: "LIVE"    ,
        }),

    detectBot({
      mode: "LIVE",
      // configured with a list of bots to allow from
      // https://arcjet.com/bot-list - all other detected bots will be blocked
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:PREVIEW",
        // Google has multiple crawlers, each with a different user-agent, so we
        // allow the entire Google category

        "CURL", // allows the default user-agent of the `curl` tool
        "DISCORD_CRAWLER", // allows Discordbot
      ],
    }),
    ],

});

// free tier pantry scans

export const freePantryScans = aj.withRule(
    tokenBucket({
        mode: "LIVE",
        characteristics: ["userId"],
        refillRate: 10,
        interval: "30d",
        capacity: 10,
    })
);


export const freeMealRecommendations = aj.withRule(
    tokenBucket({
        mode: "LIVE",
        characteristics: ["userId"],
        refillRate: 10,
        interval: "30d",
        capacity: 5,
    })
);


export const proTierLimit = aj.withRule(
    tokenBucket({
        mode: "LIVE",
        characteristics: ["userId"],
        refillRate: 1000,
        interval: "1d",
        capacity: 1000,
    })
);