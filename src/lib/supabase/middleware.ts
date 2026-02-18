import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ClientInfo {
  slug: string | null;
  clientId: string | null;
  onboardingStatus: string | null;
}

async function getClientInfo(supabase: SupabaseClient, userId: string): Promise<ClientInfo> {
  const { data: userData } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", userId)
    .single();

  if (!userData?.client_id) return { slug: null, clientId: null, onboardingStatus: null };

  // Fetch client slug and onboarding status in parallel
  const [clientResult, onboardingResult] = await Promise.all([
    supabase.from("clients").select("slug").eq("id", userData.client_id).single(),
    supabase.from("client_onboarding").select("status").eq("client_id", userData.client_id).maybeSingle(),
  ]);

  return {
    slug: clientResult.data?.slug ?? null,
    clientId: userData.client_id,
    onboardingStatus: onboardingResult.data?.status ?? null,
  };
}

// Backwards-compatible wrapper
async function getClientSlug(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const info = await getClientInfo(supabase, userId);
  return info.slug;
}

// Check if a pathname is a slug-based portal route: /<slug>/portal/...
function isSlugPortalPath(pathname: string): boolean {
  // Matches /<something>/portal or /<something>/portal/...
  return /^\/[^/]+\/portal(\/|$)/.test(pathname);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes
  const publicRoutes = [
    "/login", "/forgot-password", "/reset-password", "/auth/callback",
    "/pricing", "/features", "/about", "/contact", "/industries",
  ];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // API routes handle their own auth — don't redirect them
  const isApiRoute = pathname.startsWith("/api/");

  // If not authenticated and not on a public route, redirect to login
  if (!user && !isPublicRoute && !isApiRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated, get user role from metadata or DB
  if (user) {
    const userRole = user.user_metadata?.role as string | undefined;
    const isClientUser = userRole === "client_admin" || userRole === "client_member";

    // Marketing routes should be accessible to everyone (auth and unauth)
    const marketingRoutes = ["/pricing", "/features", "/about", "/contact", "/industries"];
    const isMarketingRoute = pathname === "/" || marketingRoutes.some((p) => pathname.startsWith(p));

    // Redirect authenticated users away from login / auth routes (but NOT marketing pages)
    if ((isPublicRoute || pathname === "/") && !isMarketingRoute) {
      const url = request.nextUrl.clone();
      if (isClientUser) {
        const clientInfo = await getClientInfo(supabase, user.id);
        if (clientInfo.slug) {
          // If onboarding is incomplete, go straight to wizard
          const needsOnboarding = clientInfo.onboardingStatus &&
            clientInfo.onboardingStatus !== "completed" &&
            clientInfo.onboardingStatus !== "skipped";
          url.pathname = needsOnboarding
            ? `/${clientInfo.slug}/portal/onboarding`
            : `/${clientInfo.slug}/portal`;
        } else {
          url.pathname = "/login";
        }
      } else {
        url.pathname = "/dashboard";
      }
      return NextResponse.redirect(url);
    }

    // Handle old /portal paths — redirect client users to slug-based URL
    if (pathname === "/portal" || pathname.startsWith("/portal/")) {
      if (isClientUser) {
        const slug = await getClientSlug(supabase, user.id);
        if (slug) {
          const url = request.nextUrl.clone();
          // Rewrite /portal/... to /<slug>/portal/...
          url.pathname = `/${slug}${pathname}`;
          return NextResponse.redirect(url);
        }
      }
      // Startup users trying to access /portal → redirect to /dashboard
      if (userRole === "startup_admin" || userRole === "startup_member") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // Role-based access control
    if (pathname.startsWith("/dashboard")) {
      if (isClientUser) {
        const slug = await getClientSlug(supabase, user.id);
        const url = request.nextUrl.clone();
        url.pathname = slug ? `/${slug}/portal` : "/login";
        return NextResponse.redirect(url);
      }
    }

    // Slug-based portal paths: /<slug>/portal/...
    if (isSlugPortalPath(pathname)) {
      if (userRole === "startup_admin" || userRole === "startup_member") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      // Validate that the slug in the URL matches the client user's actual slug
      if (isClientUser) {
        const clientInfo = await getClientInfo(supabase, user.id);
        const urlSlug = pathname.split("/")[1];
        if (clientInfo.slug && urlSlug !== clientInfo.slug) {
          const url = request.nextUrl.clone();
          url.pathname = `/${clientInfo.slug}/portal`;
          return NextResponse.redirect(url);
        }

        // NOTE: We no longer force-redirect portal root → onboarding.
        // The portal dashboard page shows an onboarding banner instead,
        // letting users freely navigate the sidebar during onboarding.
      }
    }
  }

  return supabaseResponse;
}
