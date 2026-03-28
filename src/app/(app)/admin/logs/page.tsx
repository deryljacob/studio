
"use client";

import * as React from "react";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { formatDistanceToNow } from "date-fns";
import { Loader2, Bug } from "lucide-react";

export default function WebhookLogsPage() {
  const logsRef = collection(db, "webhook_logs");
  const logsQuery = query(logsRef, orderBy("timestamp", "desc"), limit(50));
  const [snapshot, loading, error] = useCollection(logsQuery);

  const logs = React.useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    }));
  }, [snapshot]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhook Debugger</h1>
          <p className="text-muted-foreground">
            Monitor incoming Dodo Payments webhook events in real-time.
          </p>
        </div>
        <Bug className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>
            The last 50 events received from Dodo Payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading logs: {error.message}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No webhook events logged yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "success"
                              ? "default"
                              : log.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.timestamp ? formatDistanceToNow(log.timestamp, { addSuffix: true }) : "N/A"}
                      </TableCell>
                      <TableCell>
                        <pre className="text-[10px] bg-muted p-2 rounded max-w-xs overflow-auto max-h-24">
                          {JSON.stringify(log.payload || log.error, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
