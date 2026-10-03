import { auth } from "@/server/auth-edge";

/**
 * Route guard (Next 16 `proxy` convention). Edge-safe: session JWT only, no DB.
 * Authenticated users are kept out of /login and /register.
 */
export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const loggedIn = !!req.auth?.user?.email;

  const PROTECTED = [
    "/dashboard",
    "/settings",
    "/products",
    "/stores",
    "/ads",
    "/advertisers",
    "/search",
    "/trends",
    "/watchlists",
    "/analyst",
    "/competitors",
    "/analyses",
    "/customer-intelligence",
    "/opportunities",
    "/reports",
  ];
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !loggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return Response.redirect(url);
  }

  if (loggedIn && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/products/:path*",
    "/stores/:path*",
    "/ads/:path*",
    "/advertisers/:path*",
    "/search",
    "/trends",
    "/watchlists",
    "/analyst",
    "/competitors",
    "/analyses/:path*",
    "/customer-intelligence",
    "/opportunities",
    "/reports/:path*",
    "/login",
    "/register",
  ],
};
