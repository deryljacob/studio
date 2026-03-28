
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="container mx-auto flex flex-col gap-8 py-12 md:py-24">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Choose the plan that's right for you. Get started for free, no credit card required.
        </p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2 max-w-4xl mx-auto w-full">
        <Card className="flex flex-col">
          <CardHeader>
              <CardTitle>Free Trial</CardTitle>
              <CardDescription>A 7-day preview of our Professional plan.</CardDescription>
              <div className="pt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-sm text-muted-foreground"> for 7 days</span>
              </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
              <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Up to 5 calendar connections</span>
                  </li>
                  <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Anomaly detection</span>
                  </li>
                  <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Email alerts</span>
                  </li>
              </ul>
          </CardContent>
          <CardFooter>
              <Button asChild className="w-full">
                  <Link href="/sign-up">Start Free Trial</Link>
              </Button>
          </CardFooter>
        </Card>

        <Card className="border-2 border-primary flex flex-col relative">
          <div className="absolute top-0 -translate-y-1/2 w-full flex justify-center">
              <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
              </div>
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
                  <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Unlimited calendar connections</span>
                  </li>
                  <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Advanced anomaly detection</span>
                  </li>
                  <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Daily health checks</span>
                  </li>
                   <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Weekly summary reports</span>
                  </li>
              </ul>
          </CardContent>
          <CardFooter>
              <Button className="w-full" asChild>
                  <Link href="/sign-up">
                      <Star className="mr-2 h-4 w-4" />
                      Subscribe to Professional
                  </Link>
              </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
