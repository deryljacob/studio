
"use client";

import { AppShell } from "@/components/app-shell";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen">
             <div className="flex flex-col space-y-3">
                <Skeleton className="h-[125px] w-[250px] rounded-xl" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        </div>
    );
  }

  if (error) {
    // Handle error state, maybe show an error message
    router.push('/sign-in');
    return null;
  }
  
  if (!user) {
    // User is not authenticated, AppLayout's children won't be rendered.
    // The useEffect above will handle the redirect.
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
