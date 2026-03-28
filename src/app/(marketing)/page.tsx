
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Shield, AlertTriangle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-20 md:py-32 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">
              Never Miss a Booking Anomaly Again
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-primary-foreground/80 mb-8">
              Calendar Sentinel syncs with your Airbnb, Vrbo, and other calendars to detect and alert you of any issues, so you can rest easy.
            </p>
            <Link href="/sign-up">
              <Button size="lg">Start Your 7-Day Free Trial</Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-12 md:py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Why You'll Love Calendar Sentinel
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-col items-center text-center">
                  <div className="p-3 rounded-full bg-primary/10 mb-4">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Seamless Calendar Sync</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground">
                    Connect your iCal URLs from Airbnb, Vrbo, Booking.com, or your Google Calendar in seconds. We keep everything in one place.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-col items-center text-center">
                  <div className="p-3 rounded-full bg-primary/10 mb-4">
                    <AlertTriangle className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Instant Anomaly Alerts</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground">
                    Get immediate email notifications for double bookings, suspicious blocks, and sync errors before they become problems.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-col items-center text-center">
                   <div className="p-3 rounded-full bg-primary/10 mb-4">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Daily Health Checks</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground">
                    Our automated daily scans check for stale links, recurring personal blocks, and token expirations to keep your calendars healthy.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section className="w-full py-12 md:py-24 bg-muted">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Trusted by Hosts and Property Managers
            </h2>
            <div className="grid gap-8 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <blockquote className="text-lg">
                    "Calendar Sentinel saved me from a double booking nightmare during peak season. The instant alert was a lifesaver. I can't imagine managing my properties without it."
                  </blockquote>
                </CardContent>
                 <CardHeader>
                    <div className="flex items-center gap-4">
                        <img src="https://placehold.co/40x40.png" className="h-10 w-10 rounded-full" data-ai-hint="female person" />
                        <div>
                            <p className="font-semibold">Sarah K.</p>
                            <p className="text-sm text-muted-foreground">Property Manager</p>
                        </div>
                    </div>
                </CardHeader>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <blockquote className="text-lg">
                    "The daily health checks give me so much peace of mind. I used to manually check my calendar links every week. Now, I just let Calendar Sentinel do the work."
                  </blockquote>
                </CardContent>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <img src="https://placehold.co/40x40.png" className="h-10 w-10 rounded-full" data-ai-hint="male person" />
                        <div>
                            <p className="font-semibold">David L.</p>
                            <p className="text-sm text-muted-foreground">Airbnb Superhost</p>
                        </div>
                    </div>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-20 md:py-32">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Ready to Protect Your Bookings?
            </h2>
            <p className="max-w-xl mx-auto text-lg text-muted-foreground mb-8">
              Sign up today for a 7-day free trial and experience the peace of mind that comes with automated calendar monitoring.
            </p>
            <Link href="/sign-up">
              <Button size="lg">Get Started for Free</Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
