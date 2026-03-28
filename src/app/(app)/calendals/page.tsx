
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarPlus, Link, CheckCircle2, AlertCircle, XCircle, Loader2, Trash2, RefreshCw } from "lucide-react";
import type { Calendar as CalendarType, Event as EventType } from "@/lib/types";
import { isSameDay, fromUnixTime, getDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, linkWithPopup } from "firebase/auth";
import { fetchIcal } from "@/lib/actions/fetch-ical";
import { useAuthState } from "react-firebase-hooks/auth";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp, writeBatch, getDocs, Timestamp } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { v5 as uuidv5 } from 'uuid';

const ICAL_NAMESPACE = 'a8f6a2c0-f823-4e4b-87d5-2f847b7c2a79';

const platformLogos: { [key in CalendarType['platform']]: React.ReactNode } = {
  Airbnb: <img src="https://placehold.co/32x32/FF5A5F/FFFFFF.png?text=A" alt="Airbnb" className="h-8 w-8 rounded-md" data-ai-hint="airbnb logo"/>,
  'Booking.com': <img src="https://placehold.co/32x32/003580/FFFFFF.png?text=B" alt="Booking.com" className="h-8 w-8 rounded-md" data-ai-hint="booking logo"/>,
  Vrbo: <img src="https://placehold.co/32x32/0067DB/FFFFFF.png?text=V" alt="Vrbo" className="h-8 w-8 rounded-md" data-ai-hint="vrbo logo"/>,
  'Google Calendar': <img src="https://placehold.co/32x32/4285F4/FFFFFF.png?text=G" alt="Google Calendar" className="h-8 w-8 rounded-md" data-ai-hint="google calendar logo"/>,
  iCal: <Link className="h-8 w-8 text-muted-foreground" />,
};

const statusInfo: { [key in CalendarType['status']]: { icon: React.ReactNode, color: string, text: string } } = {
    active: { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-500", text: "Active" },
    error: { icon: <AlertCircle className="h-4 w-4" />, color: "text-red-500", text: "Sync Error" },
    expired: { icon: <XCircle className="h-4 w-4" />, color: "text-gray-500", text: "Expired" },
    never: { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-500", text: "Ready to Sync" },
};

function simpleIcsParser(icalData: string, calendarId: string, userId: string): EventType[] {
    const events: EventType[] = [];
    const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
    let match;

    while ((match = eventRegex.exec(icalData)) !== null) {
        const eventBlock = match[1];
        
        const uidMatch = /UID:(.*)/.exec(eventBlock);
        const dtstartMatch = /DTSTART(?:;[^:]+)?:(.*)/.exec(eventBlock);
        const dtendMatch = /DTEND(?:;[^:]+)?:(.*)/.exec(eventBlock);
        const summaryMatch = /SUMMARY:(.*)/.exec(eventBlock);

        if (uidMatch && dtstartMatch && dtendMatch) {
            const uid = uidMatch[1].trim();
            const startDateStr = dtstartMatch[1].trim();
            const endDateStr = dtendMatch[1].trim();
            const summary = (summaryMatch ? summaryMatch[1].trim() : 'No Title');
            
            const parseDate = (dateStr: string) => {
                const year = parseInt(dateStr.substring(0, 4), 10);
                const month = parseInt(dateStr.substring(4, 6), 10) - 1;
                const day = parseInt(dateStr.substring(6, 8), 10);

                if (dateStr.length > 8 && dateStr.includes('T')) { // Contains time
                    const hour = parseInt(dateStr.substring(9, 11), 10);
                    const minute = parseInt(dateStr.substring(11, 13), 10);
                    const second = parseInt(dateStr.substring(13, 15), 10);
                    return new Date(Date.UTC(year, month, day, hour, minute, second));
                } else { // Date only
                    return new Date(Date.UTC(year, month, day));
                }
            };

            const start = parseDate(startDateStr);
            let end = parseDate(endDateStr);

            // For all-day events, the end date is often exclusive. Let's make it inclusive.
            if (endDateStr.length === 8 && startDateStr.length === 8 && start < end) {
                end.setDate(end.getDate() - 1);
            }
            
            const eventId = uuidv5(`${calendarId}-${uid}`, ICAL_NAMESPACE);

            events.push({
                id: eventId,
                eventId: uid,
                calendarId: calendarId,
                userId: userId,
                start: start,
                end: end,
                summary: summary,
                rawData: eventBlock
            });
        }
    }
    return events;
}

export default function CalendarsPage() {
  const [user, authLoading] = useAuthState(auth);
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [visibleSources, setVisibleSources] = React.useState<string[]>([]);
  const [icalUrl, setIcalUrl] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSyncingAll, setIsSyncingAll] = React.useState(isSyncingAll);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [isAddingIcal, setIsAddingIcal] = React.useState(false);
  const { toast } = useToast();

  // Calendar Sources Collection
  const calendarsRef = collection(db, "calendars");
  const userCalendarsQuery = user ? query(calendarsRef, where("userId", "==", user.uid)) : null;
  const [calendarSourcesSnapshot, calendarsLoading, calendarsError] = useCollection(userCalendarsQuery);

  const calendarSources = React.useMemo(() => {
    if (!calendarSourcesSnapshot) return [];
    return calendarSourcesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarType));
  }, [calendarSourcesSnapshot]);

  // Events Collection
  const eventsRef = collection(db, "events");
  const userEventsQuery = user ? query(eventsRef, where("userId", "==", user.uid)) : null;
  const [eventsSnapshot, eventsLoading, eventsError] = useCollection(userEventsQuery);
  
  const events = React.useMemo(() => {
    if (!eventsSnapshot) return [];
    return eventsSnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        // Convert Firebase Timestamps to JS Dates
        start: data.start ? fromUnixTime(data.start.seconds) : new Date(),
        end: data.end ? fromUnixTime(data.end.seconds) : new Date(),
      } as EventType;
    });
  }, [eventsSnapshot]);


  React.useEffect(() => {
    if (calendarSources.length > 0 && visibleSources.length === 0) {
      setVisibleSources(calendarSources.map(c => c.id));
    }
  }, [calendarSources, visibleSources.length]);

  const googleCalendarExists = React.useMemo(() => {
    return calendarSources.some(source => source.platform === 'Google Calendar');
  }, [calendarSources]);
  
  const toggleSource = (id: string) => {
    setVisibleSources(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };

  const getPlatformName = (url: string): CalendarType['platform'] => {
    try {
      const hostname = new URL(url).hostname;
      if (hostname.includes('airbnb')) return 'Airbnb';
      if (hostname.includes('vrbo') || hostname.includes('homeaway')) return 'Vrbo';
      if (hostname.includes('booking.com')) return 'Booking.com';
      if (hostname.includes('google.com')) return 'Google Calendar';
      
      const domain = hostname.replace('www.', '').split('.')[0];
      return (domain.charAt(0).toUpperCase() + domain.slice(1)) as CalendarType['platform'];
    } catch (error) {
      return 'iCal'; // fallback
    }
  }

  const handleConnectIcal = async () => {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to add a calendar." });
        return;
    }
    if (!icalUrl.trim()) {
        toast({ variant: "destructive", title: "Error", description: "Please enter a valid iCal URL." });
        return;
    }
    let urlForParsing = icalUrl;
    if (urlForParsing.startsWith('webcal://')) {
        urlForParsing = urlForParsing.replace('webcal://', 'https://');
    }
    try {
        new URL(urlForParsing);
    } catch (error) {
        toast({ variant: "destructive", title: "Invalid URL", description: "The provided iCal URL is not valid." });
        return;
    }
    if (calendarSources.some(source => source.feedUrl === icalUrl)) {
        toast({ variant: "destructive", title: "Duplicate URL", description: "This iCal URL has already been added." });
        return;
    }
    setIsAddingIcal(true);
    try {
      const platformName = getPlatformName(icalUrl);
      const newSource = {
          userId: user.uid,
          type: 'ical' as const,
          feedUrl: icalUrl,
          platform: platformName,
          status: 'never' as const,
          lastSync: 'never',
          color: `hsl(var(--chart-${(calendarSources.length % 5) + 1}))`,
          createdAt: serverTimestamp(),
      };
      await addDoc(calendarsRef, newSource);

      toast({ title: "Calendar Connected", description: `The ${platformName} calendar has been added successfully.` });
      setIcalUrl("");
      setIsDialogOpen(false);

    } catch (error) {
      console.error("Error adding iCal source:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save calendar source. Please try again." });
    } finally {
      setIsAddingIcal(false);
    }
};

  const handleConnectGoogleCalendar = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to add a calendar.",
      });
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly');

    try {
      const result = await linkWithPopup(user, provider);
      const credentialUser = result.user;

      if (credentialUser.email) {
        const newSource = {
          userId: user.uid,
          type: 'google' as const,
          feedUrl: credentialUser.email, 
          platform: 'Google Calendar' as const,
          status: 'active' as const,
          lastSync: 'just now',
          color: `hsl(var(--chart-${(calendarSources.length % 5) + 1}))`,
          createdAt: serverTimestamp(),
        };

        await addDoc(calendarsRef, newSource);
        setIsDialogOpen(false);
        toast({
          title: "Google Calendar Connected",
          description: `Successfully connected ${credentialUser.email}.`,
        });
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return; 
      }
      if (error.code === 'auth/credential-already-in-use') {
         toast({
          variant: "destructive",
          title: "Account Already Linked",
          description:
            "This Google account is already linked to another user.",
        });
        return;
      }
      console.error("Error linking with Google: ", error);
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description:
          "Could not connect to Google Calendar. Please try again.",
      });
    }
  };
  
  const handleSyncAll = async () => {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to sync." });
        return;
    }
    setIsSyncingAll(true);
    let successCount = 0;
    let errorCount = 0;
    const icalSources = calendarSources.filter(s => s.type === 'ical');
    
    await Promise.all(icalSources.map(async (source) => {
        const success = await handleSyncSingle(source.id, source.feedUrl, { silent: true });
        if (success) {
            successCount++;
        } else {
            errorCount++;
        }
    }));

    if (errorCount > 0) {
      const message = `Completed with ${successCount} successful sync(s) and ${errorCount} error(s).`;
      if (errorCount === icalSources.length) {
           const fullMessage = `Sync failed for all ${errorCount} calendar(s). Check connection details and try again.`;
           toast({ variant: "destructive", title: "Sync Failed", description: fullMessage });
      } else {
          toast({ variant: "default", title: "Partial Sync", description: message });
      }
    } else if (icalSources.length > 0) {
        toast({ title: "Sync Successful", description: `Successfully synced all ${icalSources.length} iCal sources.` });
    } else {
        toast({ title: "No Calendars to Sync", description: `There are no iCal sources to sync.` });
    }
    setIsSyncingAll(false);
  };
  
  const handleSyncSingle = async (calendarId: string, feedUrl: string, options: { silent?: boolean } = {}) => {
    if (!user) {
        if (!options.silent) toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to sync." });
        return false;
    }
    setSyncingId(calendarId);

    const calendarDocRef = doc(db, "calendars", calendarId);

    try {
        // 1. Fetch iCal data via server action proxy
        const result = await fetchIcal({ url: feedUrl });
        
        if (result.status === 'error') {
            let errorTitle = "Sync Error";
            let errorMessage = `Sync Failed: ${result.message}`;

            if (result.message.includes("HTTP status 500")) {
                errorTitle = "Provider Error";
                errorMessage = "The calendar provider has a temporary issue. Please wait a few minutes and try again.";
            }

            if (!options.silent) {
                toast({ variant: "destructive", title: errorTitle, description: errorMessage });
            }
            await updateDoc(calendarDocRef, { status: 'error', lastSync: new Date().toISOString(), lastError: result.message });
            setSyncingId(null);
            return false;
        }

        const icalData = result.data;
        if (!icalData) {
            if (!options.silent) {
                toast({ variant: "destructive", title: "Sync Error", description: "No calendar data was returned from the provider." });
            }
            return false;
        }

        // 2. Parse and Write to DB
        const newEvents = simpleIcsParser(icalData, calendarId, user.uid);
        
        const userEventsRef = collection(db, "events");
        const q = query(userEventsRef, where("userId", "==", user.uid), where("calendarId", "==", calendarId));
        const existingEventsSnapshot = await getDocs(q);
        const existingEventIds = new Set(existingEventsSnapshot.docs.map(doc => doc.id));
        const newEventIds = new Set(newEvents.map(e => e.id));
        
        const batch = writeBatch(db);

        // Add/update new events
        newEvents.forEach(event => {
            const eventRef = doc(db, 'events', event.id);
            batch.set(eventRef, {
                 ...event,
                 start: Timestamp.fromDate(event.start),
                 end: Timestamp.fromDate(event.end),
                 syncedAt: serverTimestamp()
            }, { merge: true });
        });

        // Delete old events no longer in the feed
        existingEventIds.forEach(id => {
            if (!newEventIds.has(id)) {
                batch.delete(doc(db, 'events', id));
            }
        });

        // Update calendar status to active
        batch.update(calendarDocRef, { status: 'active', lastSync: new Date().toISOString(), lastError: null });

        await batch.commit();
        
        const successMessage = `Successfully synced ${newEvents.length} events.`;
        if (!options.silent) toast({ title: "Sync Successful", description: successMessage });
        
        return true;

    } catch (error: any) {
        console.error(`Error syncing calendar ${calendarId}:`, error);
        if (!options.silent) {
            toast({ variant: "destructive", title: "Unexpected Error", description: "An unexpected error occurred during sync." });
        }
        try {
            await updateDoc(calendarDocRef, { status: 'error', lastSync: new Date().toISOString(), lastError: "An unexpected error occurred." });
        } catch (updateError) {
            console.error(`Failed to update calendar status to error for ${calendarId}:`, updateError);
        }
        return false;
    } finally {
        setSyncingId(null);
    }
  };


  const handleRemove = async (id: string) => {
    if (!user) return;
    setRemovingId(id);
    try {
      await deleteDoc(doc(db, "calendars", id));
      // Note: Associated events are not deleted here, but will no longer be visible.
      // A cleanup function would be needed for a production app.
      toast({
        title: "Calendar Removed",
        description: "The calendar source has been removed.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not remove the calendar source.",
      });
    } finally {
      setRemovingId(null);
    }
  };


  const monthEvents = events.filter(e => visibleSources.includes(e.calendarId));

  const getEventsForDate = (d: Date) => {
    return monthEvents.filter(e => {
        const start = e.start;
        start.setUTCHours(0, 0, 0, 0);
        const end = e.end;
        end.setUTCHours(23, 59, 59, 999);
        const day = new Date(d);
        day.setUTCHours(0, 0, 0, 0);

        return day >= start && day <= end;
    }).sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  const loading = authLoading || calendarsLoading || eventsLoading;
  const error = calendarsError || eventsError;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Calendars</h1>
          <p className="text-muted-foreground">
            View and manage your synced calendars.
          </p>
        </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSyncAll} disabled={isSyncingAll || !!syncingId}>
                 {isSyncingAll ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                Sync All Calendars
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                <CalendarPlus className="mr-2 h-4 w-4" />
                Add Calendar
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                <DialogTitle>Add New Calendar</DialogTitle>
                <DialogDescription>
                    Choose a method to connect your calendar.
                </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="ical">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="ical">iCal URL</TabsTrigger>
                    <TabsTrigger value="google">Google Calendar</TabsTrigger>
                </TabsList>
                <TabsContent value="ical" className="pt-4">
                    <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Paste your iCal URL from Airbnb, Vrbo, Booking.com, etc.
                    </p>
                    <div className="space-y-2">
                        <Label htmlFor="ical-url">iCal URL</Label>
                        <Input 
                        id="ical-url" 
                        placeholder="https://www.airbnb.com/calendar/ical/..."
                        value={icalUrl}
                        onChange={(e) => setIcalUrl(e.target.value)}
                        disabled={isAddingIcal}
                        />
                    </div>
                    <Button className="w-full" onClick={handleConnectIcal} disabled={isAddingIcal}>
                        {isAddingIcal ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                        </>
                        ) : (
                        <>
                            <Link className="mr-2 h-4 w-4" />
                            Connect via iCal
                        </>
                        )}
                    </Button>
                    </div>
                </TabsContent>
                <TabsContent value="google" className="pt-4">
                    <div className="space-y-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            {googleCalendarExists
                            ? "You have already connected a Google Calendar account."
                            : "Connect your Google Calendar account directly for real-time sync."
                            }
                        </p>
                        <Button variant="outline" className="w-full" onClick={handleConnectGoogleCalendar} disabled={googleCalendarExists}>
                            <img src="https://placehold.co/20x20/4285F4/FFFFFF.png?text=G" alt="Google" className="mr-2 h-5 w-5 rounded-sm" data-ai-hint="google logo" />
                            Connect with Google
                        </Button>
                    </div>
                </TabsContent>
                </Tabs>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="p-0"
            classNames={{
              months: "flex flex-col sm:flex-row",
              month: 'space-y-4 p-3 w-full',
              caption: "flex justify-center pt-1 relative items-center",
              table: "w-full border-collapse",
              head_row: 'flex w-full',
              head_cell: 'text-muted-foreground rounded-md w-[14.28%] font-normal text-[0.8rem] text-center',
              row: "flex w-full mt-2",
              cell: 'h-24 w-[14.28%] text-center text-sm p-0 relative',
              day: 'h-full w-full p-1 font-normal aria-selected:opacity-100 flex flex-col items-start',
              day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
              day_today: 'bg-accent text-accent-foreground',
              day_outside: 'text-muted-foreground opacity-50',
              day_disabled: 'text-muted-foreground opacity-50',
              day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
              day_hidden: 'invisible',
            }}
            components={{
              DayContent: ({ date }) => {
                const dayEvents = getEventsForDate(date);
                const dateNumber = date.getDate();
                return (
                  <div className="relative h-full w-full">
                    <div className="absolute top-1 left-1">{dateNumber}</div>
                    <div className="absolute top-7 w-full space-y-0.5 px-px">
                      {dayEvents.slice(0, 3).map(event => {
                        const source = calendarSources.find(s => s.id === event.calendarId);
                        const isStart = isSameDay(event.start, date);
                        const isEnd = isSameDay(event.end, date);
                        const isSingleDay = isSameDay(event.start, event.end);

                        // For multi-day events, check if it's the start or end of a week
                        const dayOfWeek = getDay(date); // Sunday = 0, Saturday = 6
                        const isWeekStart = dayOfWeek === 0;
                        const isWeekEnd = dayOfWeek === 6;

                        const isEventStartOfWeek = isStart || isWeekStart;
                        const isEventEndOfWeek = isEnd || isWeekEnd;

                        return (
                          <div
                            key={event.id}
                            className={`text-white text-xs px-1 truncate w-full
                              ${isSingleDay ? 'rounded-sm' : ''}
                              ${!isSingleDay && isEventStartOfWeek ? 'rounded-l-sm' : ''}
                              ${!isSingleDay && isEventEndOfWeek ? 'rounded-r-sm' : ''}
                            `}
                            style={{backgroundColor: source?.color}}
                          >
                            {isStart ? event.summary : <span>&nbsp;</span>}
                          </div>
                        )
                      })}
                      {dayEvents.length > 3 && <div className="text-xs text-muted-foreground">+ {dayEvents.length - 3} more</div>}
                    </div>
                  </div>
                )
              }
            }}
          />
        </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Calendar Sources</h2>
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />) }
            {!loading && calendarSources.map(source => {
                 const isSyncingThis = syncingId === source.id;
                 const status = statusInfo[source.status] || statusInfo.error;
                 const lastSyncDate = source.lastSync !== 'never' && !isNaN(new Date(source.lastSync).getTime()) ? new Date(source.lastSync) : null;
                 const lastSyncFormatted = lastSyncDate ? `${lastSyncDate.toLocaleDateString()} ${lastSyncDate.toLocaleTimeString()}` : 'never';
                 return (
                    <Card key={source.id} className="flex flex-col">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                {platformLogos[source.platform as keyof typeof platformLogos] || <Link className="h-8 w-8 text-muted-foreground" />}
                                <div className="flex-1 overflow-hidden">
                                    <CardTitle className="text-lg">{source.platform}</CardTitle>
                                    <CardDescription className="truncate">{source.feedUrl}</CardDescription>
                                </div>
                                <Checkbox 
                                    id={`check-${source.id}`}
                                    checked={visibleSources.includes(source.id)}
                                    onCheckedChange={() => toggleSource(source.id)}
                                    style={{'--source-color': source.color} as React.CSSProperties}
                                    className="data-[state=checked]:bg-[var(--source-color)] border-[var(--source-color)]"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                             <div className={`flex items-center gap-2 text-sm ${status.color}`}>
                                {status.icon}
                                <span className="capitalize">{status.text}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Last sync: {lastSyncFormatted}
                            </p>
                             {source.status === 'error' && source.lastError && (
                                <p className="text-xs text-destructive mt-2 break-words">
                                    Error: {source.lastError}
                                </p>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={removingId === source.id}>
                                    {removingId === source.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This will permanently remove the connection for <span className="font-semibold">{source.platform} - {source.feedUrl}</span>. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemove(source.id)} className="bg-destructive hover:bg-destructive/90">
                                    Yes, remove
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                             <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleSyncSingle(source.id, source.feedUrl)}
                              disabled={isSyncingAll || !!syncingId || source.type !== 'ical'}
                            >
                              {isSyncingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              {isSyncingThis ? 'Syncing...' : 'Sync Now'}
                            </Button>
                        </CardFooter>
                    </Card>
                 )
            })}
             {!loading && calendarSources.length === 0 && (
              <p className="text-muted-foreground col-span-full">No calendar sources connected yet. Add one to get started!</p>
            )}
            {error && <p className="text-destructive col-span-full">Error loading data: {error.message}</p>}
        </div>
      </div>
    </div>
  );
}
