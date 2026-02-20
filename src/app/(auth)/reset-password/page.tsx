"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const strengthLabels = ["", "Weak", "Fair", "Strong", "Very Strong"];
const strengthColors = ["", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const strength = getPasswordStrength(password);
  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(password) },
  ];

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // User arrived via reset link
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (strength < 3) {
      setError("Please choose a stronger password");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0c4a6e]" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Set New Password</h1>
            <p className="text-white/60 text-sm mt-1">Choose a strong password for your account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80 text-sm">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength indicator */}
              {password && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          level <= strength ? strengthColors[strength] : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${strength <= 1 ? "text-red-400" : strength === 2 ? "text-yellow-400" : strength === 3 ? "text-blue-400" : "text-green-400"}`}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}

              {/* Requirements checklist */}
              <div className="space-y-1 mt-2">
                {requirements.map((req) => (
                  <div key={req.label} className="flex items-center gap-2 text-xs">
                    {req.met ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <X className="w-3 h-3 text-white/30" />
                    )}
                    <span className={req.met ? "text-green-400" : "text-white/40"}>{req.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-white/80 text-sm">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || strength < 3 || password !== confirmPassword}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
