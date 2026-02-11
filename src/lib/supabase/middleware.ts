import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

async function getClientSlug(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: userData } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", userId)
    .single();

  if (!userData?.client_id) return null;

  const { data: clientData } = await supabase
    .from("clients")
    .select("slug")
    .eq("id", userData.client_id)
    .single();

  return clientData?.slug ?? null;
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
  const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/pricing", "/auth/callback"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // If not authenticated and not on a public route, redirect to login
  if (!user && !isPublicRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated, get user role from metadata or DB
  if (user) {
    const userRole = user.user_metadata?.role as string | undefined;
    const isClientUser = userRole === "client_admin" || userRole === "client_member";

    // Redirect authenticated users away from login / public routes / root
    if (isPublicRoute || pathname === "/") {
      const url = request.nextUrl.clone();
      if (isClientUser) {
        const slug = await getClientSlug(supabase, user.id);
        url.pathname = slug ? `/${slug}/portal` : "/login";
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
    }
  }

  return supabaseResponse;
}
