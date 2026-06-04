"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Trophy } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .min(8, "Password must be at least 8 characters."),
});

type LoginFormData = z.infer<typeof loginSchema>;

function mapFirebaseError(code: string): string {
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Invalid email or password. Please try again.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled. Contact a super admin.",
    "auth/user-not-found": "No account found with this email address.",
    "auth/wrong-password": "Invalid email or password. Please try again.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
  };

  return messages[code] || "An unexpected error occurred. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<LoginFormData>>({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      const redirect = searchParams.get("redirect") || "/dashboard";
      router.replace(redirect);
    }
  }, [user, authLoading, router, searchParams]);

  if (!authLoading && user) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");

    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      const errors: Partial<LoginFormData> = {};
      parsed.error.errors.forEach((issue) => {
        const field = issue.path[0] as keyof LoginFormData;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, parsed.data.email, parsed.data.password);
      const redirect = searchParams.get("redirect") || "/dashboard";
      router.replace(redirect);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code
          : "";
      setFormError(mapFirebaseError(code));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <Trophy className="h-10 w-10 animate-pulse text-accent-gold" />
          <p className="text-body text-text-tertiary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-[400px] rounded-xl border border-border-default bg-bg-secondary p-12 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Trophy className="h-10 w-10 text-accent-gold" />
          <h1 className="text-h2 text-accent-gold">BigScore Admin</h1>
          <p className="text-body text-text-tertiary">Sign in to manage your app</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <Input
            label="Email Address"
            type="email"
            placeholder="admin@bigscore.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            autoComplete="email"
            autoFocus
            error={fieldErrors.email}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password)
                setFieldErrors((p) => ({ ...p, password: undefined }));
            }}
            autoComplete="current-password"
            error={fieldErrors.password || formError}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={authLoading}
            className="mt-2 w-full"
          >
            Sign In
          </Button>

          <p className="text-center text-caption text-text-disabled">
            <a href="/forgot-password" className="text-accent-blue hover:underline">
              Forgot password?
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
