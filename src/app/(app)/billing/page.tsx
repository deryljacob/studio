
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Star, Loader2 } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useDocumentData } from "react-firebase-hooks/firestore";
import { auth, db } from "@/lib/firebase";
import { doc } from "firebase/firestore";
import { fromUnixTime } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import { DodoPayments } from "dodopayments-checkout";
import { useSearchParams } from "next/navigation";


function PlanCard({ user, userData }: { user: any, userData: any }) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [isPortalLoading, setIsPortalLoading] = React.useState(false);
    const priceId = process.env.NEXT_PUBLIC_DODO_PROFESSIONAL_PRICE_ID;

    React.useEffect(() => {
        if (!user) return;
        
        DodoPayments.Initialize({
            mode: "test",
            linkType: "static",
            displayType: "overlay",
            onEvent: (event) => {
                console.log("Checkout event:", event);
                if (event.event_type === "checkout.opened") {
                    setIsLoading(false);
                }
                if (event.event_type === 'checkout.closed') {
                     setIsLoading(false);
                }
                if (event.event_type === 'checkout.error') {
                    // You can add a toast here if you want to notify the user.
                    setIsLoading(false);
                }
            },
        });
    }, [user]);


    const handleSubscribe = async () => {
        if (!priceId) {
            console.error("Dodo Price ID is not configured.");
            return;
        }
        setIsLoading(true);
        try {
            await DodoPayments.Checkout.open({
                products: [{ productId: priceId, quantity: 1 }],
                redirectUrl: `${window.location.origin}/billing`,
                customer: {
                    email: user.email,
                    metadata: {
                        userId: user.uid, // Pass the userId for webhook processing
                    }
                }
            });
        } catch (error) {
            console.error("Failed to open checkout:", error);
            setIsLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setIsPortalLoading(true);
        try {
            const customerId = userData?.dodoCustomerId;
            if (!customerId) throw new Error("Billing account not found. Please contact support.");
            
            const portalUrl = new URL('https://test.dodopayments.com/billing_portal');
            portalUrl.searchParams.append('customer', customerId);
            portalUrl.searchParams.append('return_url', window.location.href);
            
            window.location.href = portalUrl.toString();

        } catch (error: any) {
             console.error("Error managing billing:", error);
             setIsPortalLoading(false);
        }
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle>Free Plan</CardTitle>
                    <CardDescription>Basic features, perfect for getting started.</CardDescription>
                    <div className="pt-4">
                        <span className="text-4xl font-bold">$0</span>
                        <span className="text-sm text-muted-foreground"> / month</span>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                    <ul className="space-y-2">
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span>Up to 2 calendar connections</span></li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span>Basic anomaly detection</span></li>
                    </ul>
                </CardContent>
                <CardFooter>
                    <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                </CardFooter>
            </Card>

            <Card className="border-2 border-primary flex flex-col relative">
                <div className="absolute top-0 -translate-y-1/2 w-full flex justify-center">
                    <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">Most Popular</div>
                </div>
                <CardHeader>
                    <CardTitle>Professional</CardTitle>
                    <CardDescription>For property managers and hosts who need reliability.</CardDescription>
                    <div className="pt-4">
                        <span className="text-4xl font-bold">$29</span>
                        <span className="text-sm text-muted-foreground"> / month</span>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                    <ul className="space-y-2">
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span>Unlimited calendar connections</span></li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span>Advanced anomaly detection</span></li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span>Daily health checks</span></li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span>Weekly summary reports</span></li>
                    </ul>
                </CardContent>
                <CardFooter>
                    {userData?.planStatus === 'active' || userData?.planStatus === 'trialing' ? (
                         <Button className="w-full" onClick={handleManageBilling} disabled={isPortalLoading}>
                            {isPortalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Manage Billing
                        </Button>
                    ) : (
                        <Button className="w-full" onClick={handleSubscribe} disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Star className="mr-2 h-4 w-4" />
                            Subscribe to Professional
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}

function BillingPageContent() {
  const [authUser, authLoading] = useAuthState(auth);
  const userDocRef = authUser ? doc(db, 'users', authUser.uid) : null;
  const [user, userLoading, userError] = useDocumentData(userDocRef);
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = React.useState(false);

  React.useEffect(() => {
      // The webhook will update the data, and the real-time listener will catch it.
      // This logic is to show a friendly "verifying" message if the user just returned.
      // We can use a different query param that Dodo doesn't use, e.g., 'from_checkout'
      if (searchParams.has('dodo_checkout_id') && !user?.planStatus) {
          setIsVerifying(true);
          // The webhook will update the data, and the real-time listener will catch it.
          // We can set a timeout to stop the verifying state if the webhook is delayed.
          const timer = setTimeout(() => setIsVerifying(false), 10000); // 10-second timeout
          return () => clearTimeout(timer);
      } else {
        setIsVerifying(false);
      }
  }, [searchParams, user]);

  const planEndsAt = user?.planEndsAt ? fromUnixTime(user.planEndsAt.seconds) : null;
  const now = new Date();
  const trialDaysTotal = 7;
  const trialDaysLeft = planEndsAt ? Math.max(0, Math.ceil((planEndsAt.getTime() - now.getTime()) / (1000 * 3600 * 24))) : 0;
  const trialProgress = planEndsAt ? Math.max(0, (trialDaysTotal - trialDaysLeft) / trialDaysTotal * 100) : 0;
  
  const loading = authLoading || userLoading;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and billing details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          {loading ? (
             <Skeleton className="h-5 w-48 mt-1" />
          ) : isVerifying ? (
             <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying payment status...</span>
             </div>
          ) : (
            <CardDescription>
                You are currently on the {user?.planStatus === 'active' ? <b>Professional Plan</b> : user?.planStatus === 'trialing' ? <b>Free Trial</b> : <b>Free Plan</b>}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
            {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-2 w-full" />
                </div>
            ) : user?.planStatus === 'trialing' && planEndsAt ? (
                 <div className="space-y-2">
                    <p className="text-sm font-medium">{trialDaysLeft} days left in your trial</p>
                    <Progress value={trialProgress} className="h-2" />
                 </div>
            ) : user?.planStatus === 'active' && planEndsAt ? (
                <p className="text-sm text-muted-foreground">
                    Your plan renews in {Math.round((planEndsAt.getTime() - now.getTime()) / (1000 * 3600 * 24))} days.
                </p>
            ) : userError ? (
                <p className="text-sm text-destructive">
                    Could not load your plan details.
                </p>
            ) : (
                 <p className="text-sm text-muted-foreground">
                    Upgrade to the Professional plan to access premium features.
                </p>
            )}
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Choose Your Plan</h2>
        {loading ? (
            <div className="grid gap-6 lg:grid-cols-2">
                 <Skeleton className="h-96 w-full" />
                 <Skeleton className="h-96 w-full" />
            </div>
        ) : (
             <PlanCard user={authUser} userData={user} />
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <BillingPageContent />
        </React.Suspense>
    )
}
