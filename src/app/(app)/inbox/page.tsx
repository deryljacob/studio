
"use client";

import * as React from "react";
import { format, formatDistanceToNow, fromUnixTime } from "date-fns";
import {
  Mail,
  Copy,
  MailQuestion,
  Loader2,
  Calendar as CalendarIcon,
  User,
  Hash,
  BadgeDollarSign,
  Info,
  Beaker,
  ClipboardCopy,
  ExternalLink
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Email } from "@/lib/types";
import { useAuthState } from "react-firebase-hooks/auth";
import { useCollection } from "react-firebase-hooks/firestore";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as FirebaseUser } from 'firebase/auth';
import { receiveEmail, InboundEmailPayload } from "@/lib/actions/receive-email";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";

const ForwardingInstructions = () => (
    <Accordion type="multiple" className="w-full max-w-2xl text-left mt-6">
        <AccordionItem value="gmail">
            <AccordionTrigger>How to Set Up Forwarding in Gmail</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 text-sm text-muted-foreground">
                    <p>Follow these steps to automatically forward booking emails from a platform like Airbnb to your Calendar Sentinel inbox.</p>
                    <ol className="list-decimal list-inside space-y-3 pl-2">
                        <li>In the card above, click the copy button to copy your unique forwarding address.</li>
                        <li>
                        Open Gmail and go to{" "}
                        <Button variant="link" asChild className="p-0 h-auto">
                            <Link href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank">
                                Settings &gt; Forwarding and POP/IMAP <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>.
                        </li>
                        <li>Click on **"Add a forwarding address"** and paste your unique address into the popup.</li>
                        <li>Gmail will send a confirmation email to your Calendar Sentinel inbox. It will appear here on this page within a minute. Open that email and click the confirmation link.</li>
                        <li>
                            Back in Gmail settings, you now need to create a **filter** to only forward specific emails. Click the **"create a filter"** link.
                        </li>
                            <li>In the **"From"** field, enter the email address of your booking provider (e.g., `automated@airbnb.com`, `reservations@booking.com`).</li>
                            <li>Click **"Create filter"**.</li>
                            <li>Check the box for **"Forward it to:"** and select your unique Calendar Sentinel address from the dropdown.</li>
                            <li>Click **"Create filter"** again. You're all set!</li>
                    </ol>
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="outlook">
            <AccordionTrigger>How to Set Up Forwarding in Outlook.com</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 text-sm text-muted-foreground">
                    <p>Follow these steps for Outlook.com, Hotmail, or Live.com accounts.</p>
                    <ol className="list-decimal list-inside space-y-3 pl-2">
                        <li>In the card above, click the copy button to copy your unique forwarding address.</li>
                        <li>
                        Open Outlook and go to{" "}
                        <Button variant="link" asChild className="p-0 h-auto">
                            <Link href="https://outlook.live.com/mail/0/options/mail/rules" target="_blank">
                                Settings &gt; Mail &gt; Rules <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>.
                        </li>
                        <li>Click on **"+ Add new rule"**.</li>
                        <li>Give your rule a name, like "Booking Forwarding".</li>
                        <li>Under **"Add a condition"**, select **"From"** and enter the email address of your booking provider (e.g., `automated@airbnb.com`).</li>
                        <li>Under **"Add an action"**, select **"Forward to"**.</li>
                            <li>Paste your unique Calendar Sentinel address in the box.</li>
                            <li>Ensure **"Stop processing more rules"** is checked, then click **"Save"**. You're all set!</li>
                    </ol>
                </div>
            </AccordionContent>
        </AccordionItem>
            <AccordionItem value="yahoo">
            <AccordionTrigger>How to Set Up Forwarding in Yahoo Mail</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 text-sm text-muted-foreground">
                    <p>Yahoo Mail requires a paid subscription to enable automatic forwarding. If you have Yahoo Mail Plus, follow these steps.</p>
                    <ol className="list-decimal list-inside space-y-3 pl-2">
                        <li>In the card above, click the copy button to copy your unique forwarding address.</li>
                        <li>
                        Open Yahoo Mail and go to{" "}
                        <Button variant="link" asChild className="p-0 h-auto">
                            <Link href="https://mail.yahoo.com/d/settings/1" target="_blank">
                                Settings &gt; Mailboxes &gt; (Your Mailbox) <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>.
                        </li>
                        <li>In the **Forwarding** section, enter your unique Calendar Sentinel address and click **"Verify"**.</li>
                        <li>Yahoo will send a confirmation email to your Calendar Sentinel inbox. It will appear here on this page within a minute. Open that email and follow the instructions.</li>
                        <li>
                            Unlike other providers, Yahoo forwards *all* emails. You cannot filter by sender. We will automatically filter and display only relevant booking emails here.
                        </li>
                    </ol>
                </div>
            </AccordionContent>
            </AccordionItem>
            <AccordionItem value="icloud">
            <AccordionTrigger>How to Set Up Forwarding in Apple iCloud Mail</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 text-sm text-muted-foreground">
                        <p>Follow these steps to set up forwarding from your iCloud.com email address.</p>
                    <ol className="list-decimal list-inside space-y-3 pl-2">
                        <li>In the card above, click the copy button to copy your unique forwarding address.</li>
                        <li>
                        Log in to{" "}
                        <Button variant="link" asChild className="p-0 h-auto">
                            <Link href="https://www.icloud.com/mail" target="_blank">
                                iCloud.com <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                        </Button> and click the Settings (gear) icon at the top of the mailbox list.
                        </li>
                        <li>Choose **"Rules"** and then **"+ Add Rule"**.</li>
                        <li>For the condition, choose **"is from"** and enter the email address of your booking provider (e.g., `automated@airbnb.com`).</li>
                        <li>For the action, choose **"Forward to"** and paste your unique Calendar Sentinel address.</li>
                        <li>Click **"Done"**. You may be asked to verify the forwarding address. A confirmation email will appear here in your Sentinel Inbox.</li>
                    </ol>
                </div>
            </AccordionContent>
            </AccordionItem>
            <AccordionItem value="aol">
            <AccordionTrigger>How to Set Up Forwarding in AOL Mail</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 text-sm text-muted-foreground">
                        <p>Follow these steps to set up forwarding from your AOL email address.</p>
                    <ol className="list-decimal list-inside space-y-3 pl-2">
                        <li>In the card above, click the copy button to copy your unique forwarding address.</li>
                        <li>
                        Open AOL Mail and go to{" "}
                        <Button variant="link" asChild className="p-0 h-auto">
                            <Link href="https://mail.aol.com/webmail-std/en-us/options/general" target="_blank">
                                Options &gt; Mail Settings &gt; Forwarding <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>.
                        </li>
                        <li>Select **"Start Forwarding"** and paste your unique Calendar Sentinel address into the text box. Click **"Save"**.</li>
                        <li>AOL will send a confirmation email to your Calendar Sentinel inbox. It will appear here within a minute. Open it and click the confirmation link.</li>
                        <li>Like Yahoo, AOL forwards *all* emails. You cannot create a filter. We will automatically handle and display only relevant booking emails here.</li>
                    </ol>
                </div>
            </AccordionContent>
            </AccordionItem>
    </Accordion>
);


const ForwardingAddressCard = ({ user, isCollapsible = false }: { user: FirebaseUser | null | undefined, isCollapsible?: boolean }) => {
    const { toast } = useToast();
    const forwardingDomain = "in.calendarsentinel.com";
    const uniqueForwardingAddress = user ? `inbox-${user.uid}@${forwardingDomain}` : "";

    const copyToClipboard = () => {
        if (!uniqueForwardingAddress) return;
        navigator.clipboard.writeText(uniqueForwardingAddress);
        toast({
            title: "Copied to Clipboard",
            description: "The forwarding email address has been copied.",
        });
    };
    
    const CardContentSection = (
      <>
        <CardDescription>
            Set up forwarding in your email client (e.g., Gmail, Outlook) to send booking confirmations to the address below. They will then appear in this inbox.
        </CardDescription>
        <div className="flex w-full items-center space-x-2 pt-4">
            {uniqueForwardingAddress ? (
            <div id="forwarding-address" className="flex-grow rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground break-all">
                {uniqueForwardingAddress}
            </div>
            ) : (
            <Skeleton className="h-10 w-full" />
            )}
            <Button variant="outline" size="icon" onClick={copyToClipboard} disabled={!uniqueForwardingAddress} aria-label="Copy forwarding address">
                <ClipboardCopy className="h-4 w-4" />
            </Button>
        </div>
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="link" className="p-0 h-auto mt-2 text-sm">View forwarding instructions</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>How to Set Up Email Forwarding</DialogTitle>
                    <DialogDescription>
                        Follow the guide for your email provider to automatically send booking emails to your Calendar Sentinel inbox.
                    </DialogDescription>
                </DialogHeader>
                <ForwardingInstructions />
            </DialogContent>
        </Dialog>
      </>
    );

    if (isCollapsible) {
        return (
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="forwarding-address" className="border-b-0">
                     <Card>
                        <AccordionTrigger className="p-6">
                            <CardTitle>Your Unique Forwarding Address</CardTitle>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                            {CardContentSection}
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            </Accordion>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your Unique Forwarding Address</CardTitle>
            </CardHeader>
            <CardContent>
                {CardContentSection}
            </CardContent>
        </Card>
    );
};

const EmptyInbox = () => {
    return (
         <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <MailQuestion className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold">Your Inbox is Empty</h2>
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
                To get started, set up email forwarding from your booking provider. This will automatically send new booking emails to your Calendar Sentinel inbox.
            </p>
            <ForwardingInstructions />
        </div>
    )
}

const BookingDetailsDisplay = ({ email }: { email: Email }) => {
    if (!email.bookingDetails || email.bookingDetails.source === 'none') {
        return null;
    }
    const { platform, confirmationCode, checkinDate, checkoutDate, guestName, totalPrice, source } = email.bookingDetails;
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            // Check if the date string is already in ISO format or needs parsing
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                 // Fallback for formats like "August 1, 2024"
                 return format(new Date(dateString), 'MMM d, yyyy');
            }
            return format(date, 'MMM d, yyyy');
        } catch {
            return dateString; // Return original string if parsing fails
        }
    }

    return (
        <div className="border rounded-lg p-4 mt-4 bg-muted/50">
            <h3 className="font-semibold mb-3 text-base">Booking Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {platform && <div className="flex items-center gap-2"><Info className="h-4 w-4 text-muted-foreground" /><div><span className="font-medium">Platform: </span>{platform}</div></div>}
                {confirmationCode && <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" /><div><span className="font-medium">Confirmation: </span>{confirmationCode}</div></div>}
                {checkinDate && <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /><div><span className="font-medium">Check-in: </span>{formatDate(checkinDate)}</div></div>}
                {checkoutDate && <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /><div><span className="font-medium">Check-out: </span>{formatDate(checkoutDate)}</div></div>}
                {guestName && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><div><span className="font-medium">Guest: </span>{guestName}</div></div>}
                {totalPrice && <div className="flex items-center gap-2"><BadgeDollarSign className="h-4 w-4 text-muted-foreground" /><div><span className="font-medium">Total Price: </span>{totalPrice}</div></div>}
            </div>
            <div className="text-xs text-muted-foreground mt-3">
                (Data extracted via {source} parsing)
            </div>
        </div>
    )
}


export default function InboxPage() {
  const [user, authLoading] = useAuthState(auth);
  const [selectedEmail, setSelectedEmail] = React.useState<Email | null>(null);
  const hasSetInitialEmail = React.useRef(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const { toast } = useToast();

  const emailsRef = collection(db, "emails");
  const userEmailsQuery = user ? query(emailsRef, where("userId", "==", user.uid), orderBy("receivedAt", "desc")) : null;
  const [emailsSnapshot, emailsLoading, emailsError] = useCollection(userEmailsQuery);
  
  const emails = React.useMemo(() => {
    if (!emailsSnapshot) return [];
    return emailsSnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        receivedAt: data.receivedAt ? fromUnixTime(data.receivedAt.seconds) : new Date(),
      } as Email;
    });
  }, [emailsSnapshot]);

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    if (!email.isRead) {
      const emailDocRef = doc(db, "emails", email.id);
      try {
        await updateDoc(emailDocRef, { isRead: true });
      } catch (error) {
        console.error("Error marking email as read:", error);
      }
    }
  };
  
  React.useEffect(() => {
    if (!hasSetInitialEmail.current && emails.length > 0) {
      const firstUnread = emails.find(e => !e.isRead);
      const emailToSelect = firstUnread || emails[0];
      
      if(emailToSelect.id !== selectedEmail?.id) {
          handleSelectEmail(emailToSelect);
          hasSetInitialEmail.current = true;
      }
    }
  }, [emails, selectedEmail]);

  const runTest = async () => {
    if (!user) return;
    setIsTesting(true);

    // This sample payload simulates an email from Airbnb with embedded JSON-LD.
    const testPayload: InboundEmailPayload = {
      to: `inbox-${user.uid}@in.calendarsentinel.com`,
      from: 'Your Test Runner <test@example.com>',
      subject: 'Test: Airbnb Reservation Confirmed',
      html: `
        <html><body>
        <p>This is a test email to verify parsing.</p>
        <script type="application/ld+json">
        {
            "@context": "http://schema.org",
            "@type": "LodgingReservation",
            "reservationId": "TEST_HMJ3P2Y1Z0",
            "reservationStatus": "http://schema.org/ReservationConfirmed",
            "provider": { "@type": "Organization", "name": "Airbnb" },
            "checkinTime": "2024-12-20T16:00:00-05:00",
            "checkoutTime": "2024-12-24T11:00:00-05:00",
            "underName": { "@type": "Person", "name": "John Tester" },
            "totalPrice": "450.00",
            "priceCurrency": "USD"
        }
        </script>
        <p>Some more body text.</p>
        </body></html>
      `,
      text: 'This is the plain text version of the test email.'
    };

    try {
        const result = await receiveEmail(testPayload);
        if (result.status === 'success') {
            toast({
                title: "Test Successful",
                description: "A new test email has been added to your inbox.",
            });
            // The useCollection hook will automatically update the UI.
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Test Failed",
            description: error.message || "Could not process the test email.",
        });
    } finally {
        setIsTesting(false);
    }
  };

  const loading = authLoading || emailsLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
       <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
            <p className="text-muted-foreground">
                A read-only log of your forwarded booking emails.
            </p>
          </div>
          <Button onClick={runTest} disabled={isTesting}>
            <Beaker className="mr-2 h-4 w-4" />
            {isTesting ? 'Running...' : 'Run Parser Test'}
          </Button>
        </div>

      
      {loading && (
        <div className="flex-grow flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !emailsError && emails.length === 0 && (
         <div className="flex-grow">
            <ForwardingAddressCard user={user} />
            <EmptyInbox />
         </div>
      )}

      {!loading && !emailsError && emails.length > 0 && (
          <>
          <div className="flex-shrink-0">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1" className="border-b-0">
                  <ForwardingAddressCard user={user} isCollapsible={true} />
                </AccordionItem>
              </Accordion>
          </div>
          <ResizablePanelGroup
            direction="horizontal"
            className="flex-grow rounded-lg border"
          >
            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="flex h-full flex-col">
                <div className="p-4">
                  <h2 className="text-xl font-semibold">All Emails ({emails.length})</h2>
                </div>
                <Separator />
                <div className="flex-grow overflow-auto p-2 space-y-2">
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all w-full ${
                        selectedEmail?.id === email.id
                          ? "bg-muted"
                          : "hover:bg-accent"
                      } ${!email.isRead ? "border-primary/50" : ""}`}
                      onClick={() => handleSelectEmail(email)}
                    >
                      <div className="flex w-full flex-col gap-1">
                        <div className="flex items-center">
                          <div className="flex items-center gap-2">
                            <div className={`font-semibold ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{email.from}</div>
                          </div>
                          <div
                            className={`ml-auto text-xs ${
                              selectedEmail?.id === email.id
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatDistanceToNow(new Date(email.receivedAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>
                        <div className={`text-xs font-medium ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{email.subject}</div>
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        <div dangerouslySetInnerHTML={{ __html: email.body.substring(0, 300) }} />
                      </div>
                      {email.bookingDetails?.source !== 'none' && (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              email.label === "booking"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {email.label}
                          </Badge>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
              {selectedEmail ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-start p-4">
                      <div className="grid gap-1.5 flex-1">
                        <h2 className="font-semibold text-lg">{selectedEmail.subject}</h2>
                        <p className="text-sm text-muted-foreground">From: {selectedEmail.from}</p>
                      </div>
                      <div className="ml-auto text-sm text-muted-foreground">
                        {new Date(selectedEmail.receivedAt).toLocaleString()}
                      </div>
                  </div>
                  <Separator />
                  <div className="flex-1 overflow-auto p-4">
                      <BookingDetailsDisplay email={selectedEmail} />
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none mt-6"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                      />
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Mail className="h-16 w-16 text-muted-foreground" />
                    <p className="text-lg font-medium">No email selected</p>
                    <p className="text-sm text-muted-foreground">
                      Select an email from the list to view its contents.
                    </p>
                  </div>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
          </>
        )}

      {emailsError && (
          <div className="flex-grow flex items-center justify-center text-destructive">
            <p>Error loading emails: {emailsError.message}</p>
          </div>
      )}
    </div>
  );
}
