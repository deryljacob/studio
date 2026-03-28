
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, ShieldAlert, ShieldCheck, X, Info, ArrowUpDown, Loader2 } from "lucide-react";
import type { Alert } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { resolveAlert } from "@/lib/actions/resolve-alert";
import { runHealthCheck } from "@/lib/actions/run-health-check";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollection } from 'react-firebase-hooks/firestore';
import { auth, db } from '@/lib/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

const alertDescriptions: { [key: string]: { title: string; description: string; action: string; } } = {
  'double-booking': {
    title: 'Double Booking Detected',
    description: 'An overlapping booking has been found between two of your connected calendars for the same dates. This creates a risk of a double booking.',
    action: 'Go to your Calendars page to view the conflicting events. You will need to resolve the conflict by canceling one of the bookings on the respective platform.'
  },
  'stuck-blockage': {
    title: 'Stuck Blockage Detected',
    description: 'A calendar block is still present for dates that should have been cleared by a cancellation. This could lead to missed bookings.',
    action: 'A cancellation email was received, but the block on your calendar was not automatically removed after an hour. Please manually check the calendar source to ensure the dates are available.'
  },
  'revenue-leak': {
    title: 'Potential Revenue Leak',
    description: 'A new booking confirmation was received via email, but a corresponding block was not found on your synced calendars after 15 minutes.',
    action: 'This may indicate a sync delay or an issue with your iCal feed. Please go to the Calendars page and manually sync the calendar associated with the new booking to ensure your availability is correct.'
  },
  'sync-error': {
    title: 'Sync Error',
    description: 'A calendar failed to sync after multiple attempts. The iCal link may be broken, or the provider may be experiencing issues.',
    action: 'Please visit the Calendars page to verify the iCal URL and try a manual sync. If the problem persists, the link may need to be regenerated from the source (e.g., Airbnb, Vrbo).'
  },
  'suspicious-block': {
    title: 'Suspicious Manual Block',
    description: 'An event was found with a title like "Blocked" or "Unavailable." These are often created manually and might be forgotten.',
    action: 'Please review the event on your calendar. If you intended to block these dates, you can ignore this alert. If it was an accident, removing the block will open up your availability.'
  },
  'long-stay-block': {
    title: 'Unusually Long Booking Block',
    description: 'A booking from a platform like Airbnb or Vrbo is blocking your calendar for more than 30 days. This is uncommon and could be an error.',
    action: 'Verify if this is a legitimate long-term booking. If not, you may have accidentally blocked a whole month. Please check the source calendar to confirm.'
  },
  'recurring-event': {
    title: 'Recurring Event Detected',
    description: 'An event on your calendar is set to repeat. These are typically personal events (e.g., "Weekly Meeting") and not guest bookings.',
    action: 'Please check the event on its source calendar. If this event should not block your availability for guests, consider moving it to a separate, non-synced calendar.'
  },
   'health-check': {
    title: 'Calendar Health Issue',
    description: 'The automated health check found an issue with one of your calendars, such as a sync error or a stale iCal link.',
    action: 'Please go to the Calendars page and review the status of the affected calendar. You may need to refresh the connection or update the iCal link.'
  }
};


const sourceLogos: { [key in Alert['source']]: React.ReactNode } = {
  Airbnb: <img src="https://placehold.co/32x32/FF5A5F/FFFFFF.png?text=A" alt="Airbnb" className="h-5 w-5 rounded-sm" data-ai-hint="airbnb logo" />,
  'Booking.com': <img src="https://placehold.co/32x32/003580/FFFFFF.png?text=B" alt="Booking.com" className="h-5 w-5 rounded-sm" data-ai-hint="booking logo" />,
  Vrbo: <img src="https://placehold.co/32x32/0067DB/FFFFFF.png?text=V" alt="Vrbo" className="h-5 w-5 rounded-sm" data-ai-hint="vrbo logo" />,
  'Google Calendar': <img src="https://placehold.co/32x32/4285F4/FFFFFF.png?text=G" alt="Google Calendar" className="h-5 w-5 rounded-sm" data-ai-hint="google calendar logo" />,
  System: <ShieldAlert className="h-5 w-5 text-muted-foreground" />,
};

type SortableColumn = keyof Alert | null;
const ALERTS_PER_PAGE = 5;

const TableSkeleton = () => (
    <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: ALERTS_PER_PAGE }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
        ))}
    </div>
);

export default function DashboardPage() {
  const [user, authLoading] = useAuthState(auth);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [sortColumn, setSortColumn] = React.useState<SortableColumn>('createdAt');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false);
  const { toast } = useToast();

  const alertsRef = collection(db, "alerts");
  const userAlertsQuery = user ? query(alertsRef, where("userId", "==", user.uid)) : null;
  const [alertsSnapshot, alertsLoading, alertsError] = useCollection(userAlertsQuery);

  const alerts: Alert[] = React.useMemo(() => {
    if (!alertsSnapshot) return [];
    const unsortedAlerts = alertsSnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt?.toDate(), // Convert Firestore Timestamp to JS Date
        resolvedAt: data.resolvedAt?.toDate(),
      } as Alert;
    });

    // Sort by creation date descending
    return unsortedAlerts.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.getTime() - a.createdAt.getTime()
    });

  }, [alertsSnapshot]);

  const handleResolve = async (id: string) => {
    if (!user) return;
    setResolvingId(id);
    try {
      const idToken = await user.getIdToken();
      const result = await resolveAlert({ alertId: id, idToken });
      
      if (result.status === 'resolved') {
        toast({
          title: "Alert Resolved",
          description: "The issue has been successfully resolved and the alert is now closed.",
        });
      } else if (result.status === 'persistent') {
         toast({
          variant: "default",
          title: "Issue Still Present",
          description: result.message,
        });
      } else { // status === 'error'
          toast({
          variant: "destructive",
          title: "Resolution Failed",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while resolving the alert.",
      });
      console.error("Resolution error:", error);
    } finally {
      setResolvingId(null);
    }
  };

  const handleRunHealthCheck = async () => {
    if (!user) return;
    setIsCheckingHealth(true);
    try {
        const idToken = await user.getIdToken();
        const result = await runHealthCheck({ idToken });

        if (result.status === 'success') {
            toast({
                title: "Health Check Complete",
                description: result.message,
            });
        } else {
             toast({
                variant: "destructive",
                title: "Health Check Failed",
                description: result.message,
            });
        }
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "An unexpected error occurred while running the health check.",
        });
    } finally {
        setIsCheckingHealth(false);
    }
  };
  
  const clearFilters = () => {
    setStatusFilter("all");
    setSourceFilter("all");
    setCurrentPage(1);
  };

  const pendingAlerts = alerts.filter(a => a.status === 'pending').length;
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved').length;
  
  const uniqueSources = ["all", ...Array.from(new Set(alerts.map(a => a.source)))];

  const filteredAlerts = alerts.filter(alert => {
    const statusMatch = statusFilter === 'all' || alert.status === statusFilter;
    const sourceMatch = sourceFilter === 'all' || alert.source === sourceFilter;
    return statusMatch && sourceMatch;
  });

  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedAlerts = React.useMemo(() => {
    if (!sortColumn) return filteredAlerts;

    return [...filteredAlerts].sort((a, b) => {
      const aValue = a[sortColumn as keyof Alert];
      const bValue = b[sortColumn as keyof Alert];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (sortColumn === 'createdAt' || sortColumn === 'resolvedAt') {
        const aDate = new Date(aValue as any).getTime();
        const bDate = new Date(bValue as any).getTime();
        if (aDate < bDate) return sortDirection === 'asc' ? -1 : 1;
        if (aDate > bDate) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      // Default string comparison
      if (String(aValue) < String(bValue)) return sortDirection === 'asc' ? -1 : 1;
      if (String(aValue) > String(bValue)) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredAlerts, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedAlerts.length / ALERTS_PER_PAGE);
  const indexOfLastAlert = currentPage * ALERTS_PER_PAGE;
  const indexOfFirstAlert = indexOfLastAlert - ALERTS_PER_PAGE;
  const currentAlerts = sortedAlerts.slice(indexOfFirstAlert, indexOfLastAlert);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };
  
  const loading = authLoading || alertsLoading;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Here's an overview of your calendar health.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Alerts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{pendingAlerts}</div>}
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Alerts</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{resolvedAlerts}</div>}
            <p className="text-xs text-muted-foreground">
              In the last 7 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calendar Health</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">Excellent</div>}
             <p className="text-xs text-muted-foreground">
              Last check: 2 mins ago
            </p>
          </CardContent>
           <CardFooter>
                <Button variant="outline" size="sm" className="w-full" onClick={handleRunHealthCheck} disabled={isCheckingHealth}>
                    {isCheckingHealth ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldAlert className="mr-2 h-4 w-4" />}
                    {isCheckingHealth ? 'Running Check...' : 'Run Health Check'}
                </Button>
            </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Alerts History</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(value) => { setSourceFilter(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>
                    {source === "all" ? "All Sources" : source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
             {(statusFilter !== 'all' || sourceFilter !== 'all') && (
              <Button variant="ghost" onClick={clearFilters} className="w-full sm:w-auto">
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
            {loading ? <TableSkeleton /> : (
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('source')} className="px-0">
                        Source
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                    </TableHead>
                    <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('event')} className="px-0">
                        Event
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                    </TableHead>
                    <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('createdAt')} className="px-0">
                        Timestamp
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                    </TableHead>
                    <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('status')} className="px-0">
                        Status
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                    </TableHead>
                    <TableHead className="text-right">Action</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {alertsError && (
                    <TableRow><TableCell colSpan={5} className="text-center text-destructive">Error: {alertsError.message}</TableCell></TableRow>
                )}
                {!alertsError && currentAlerts.length > 0 ? (
                    currentAlerts.map((alert) => (
                    <TableRow key={alert.id}>
                        <TableCell>
                        <div className="flex items-center gap-2">
                            {sourceLogos[alert.source as keyof typeof sourceLogos] || <ShieldAlert className="h-5 w-5 text-muted-foreground" />}
                            <span className="font-medium">{alert.source}</span>
                        </div>
                        </TableCell>
                        <TableCell>
                        <div className="flex items-center gap-2">
                            <span>{alert.event}</span>
                            <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                <DialogTitle>{alertDescriptions[alert.type]?.title || alert.event}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        {alert.details?.message || alertDescriptions[alert.type]?.description}
                                    </p>
                                     {alert.details && Object.keys(alert.details).length > 0 && !alert.details.message && (
                                        <div>
                                            <h4 className="font-medium text-sm">Details</h4>
                                            <ul className="text-sm text-muted-foreground list-disc pl-5">
                                                {Object.entries(alert.details).map(([key, value]) => <li key={key}><strong>{key}:</strong> {String(value)}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-medium text-sm">Recommended Action</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {alertDescriptions[alert.type]?.action}
                                        </p>
                                    </div>
                                </div>
                            </DialogContent>
                            </Dialog>
                        </div>
                        </TableCell>
                        <TableCell>{alert.createdAt ? formatDistanceToNow(alert.createdAt, { addSuffix: true }) : 'N/A'}</TableCell>
                        <TableCell>
                        <Badge variant={alert.status === 'pending' ? 'destructive' : 'secondary'}>
                            {alert.status}
                        </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                        {alert.status === 'pending' && (
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolve(alert.id)}
                            disabled={resolvingId === alert.id}
                            >
                            {resolvingId === alert.id ? (
                                <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Resolving...
                                </>
                            ) : (
                                "Resolve"
                            )}
                            </Button>
                        )}
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    !alertsError && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                No alerts found. Your calendars are looking healthy!
                            </TableCell>
                        </TableRow>
                    )
                )}
                </TableBody>
            </Table>
            )}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min(indexOfFirstAlert + 1, sortedAlerts.length)} to {Math.min(indexOfLastAlert, sortedAlerts.length)} of {sortedAlerts.length} alerts.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
