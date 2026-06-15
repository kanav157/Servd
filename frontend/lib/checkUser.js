import { currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export const checkUser = async () => {
  try {

    const user = await currentUser();
    console.log("Current user from Clerk:", user);
    if (!user) {
      console.log("User is not signed in");
      return null;
    }

    if (!STRAPI_API_TOKEN) {
      console.error("STRAPI_API_TOKEN is missing");
      return null;
    }

    // Clerk subscription
    const subscriptionTier = "pro"; // Placeholder - replace with actual subscription logic

    // =========================
    // CHECK EXISTING USERS
    // =========================

    const existingUserResponse = await fetch(
      `${STRAPI_URL}/api/users`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!existingUserResponse.ok) {
      const errorText = await existingUserResponse.text();

      console.error(
        "Error checking existing user:",
        errorText
      );

      return null;
    }

    const existingUserData =
      await existingUserResponse.json();

const existingUser = existingUserData.find(
  (u) =>
    u.clerkId === user.id ||
    u.email === user.emailAddresses?.[0]?.emailAddress
);

    // =========================
    // USER EXISTS
    // =========================

    if (existingUser) {

      // Update subscription if changed
      if (
        existingUser.subscriptionTier !==
        subscriptionTier
      ) {

        const updateResponse = await fetch(
          `${STRAPI_URL}/api/users/${existingUser.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: JSON.stringify({
              subscriptionTier,
            }),
          }
        );

        if (!updateResponse.ok) {
          const errorText =
            await updateResponse.text();

          console.error(
            "Error updating subscription:",
            errorText
          );
        }
      }

      return {
        ...existingUser,
        subscriptionTier,
      };
    }

    // =========================
    // GET AUTH ROLE
    // =========================

    const roleResponse = await fetch(
      `${STRAPI_URL}/api/users-permissions/roles`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
      }
    );

    if (!roleResponse.ok) {
      console.error("Failed to fetch roles");
      return null;
    }

    const rolesData = await roleResponse.json();

    const authenticatedRole =
      rolesData.roles?.find(
        (role) => role.type === "authenticated"
      );

    if (!authenticatedRole) {
      console.error(
        "Authenticated role not found"
      );

      return null;
    }

    // =========================
    // CREATE USER
    // =========================

    const UserData = {
      username:
        user.username ||
        user.emailAddresses?.[0]?.emailAddress?.split("@")[0],

      email:
        user.emailAddresses?.[0]?.emailAddress,

      password: `clerk_managed_${user.id}_${Date.now()}`,

      confirmed: true,

      blocked: false,

      role: authenticatedRole.id,

      clerkId: user.id,

      firstName: user.firstName || "",

      lastName: user.lastName || "",

      imageUrl: user.imageUrl || "",

      subscriptionTier,
    };

    const newUserResponse = await fetch(
      `${STRAPI_URL}/api/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        body: JSON.stringify(UserData),
      }
    );

    if (!newUserResponse.ok) {

      const errorText =
        await newUserResponse.text();

      console.error(
        "Create user error:",
        errorText
      );

      return null;
    }

    const newUser = await newUserResponse.json();

    return newUser;

  } catch (error) {

    console.error(
      "Error in CheckUser:",
      error
    );

    return null;
  }
};