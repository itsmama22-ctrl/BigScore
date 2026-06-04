import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/login", "/forgot-password", "/unauthorized"];
const protectedRoutes = [
  "/dashboard",
  "/matches",
  "/competitions",
  "/teams",
  "/news",
  "/packages",
  "/notifications",
  "/analytics",
  "/users",
  "/config",
  "/audit-logs",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("__session")?.value;

  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic && pathname === "/login" && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
