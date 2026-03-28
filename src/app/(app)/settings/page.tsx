
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import 'react-phone-number-input/style.css';
import { Skeleton } from "@/components/ui/skeleton";


const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const notificationsFormSchema = z.object({
  emailAlerts: z.boolean().default(false),
  smsAlerts: z.boolean().default(false),
  phone: z.string().optional(),
}).refine(data => {
    if (data.smsAlerts && (!data.phone || !isValidPhoneNumber(data.phone))) {
        return false;
    }
    return true;
}, {
    message: "A valid phone number is required for SMS alerts.",
    path: ["phone"],
});


type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;


export default function SettingsPage() {
  const [user, authLoading] = useAuthState(auth);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isFetchingSettings, setIsFetchingSettings] = useState(true);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
    },
    mode: "onChange",
  });
  
  const notificationsForm = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      emailAlerts: true,
      smsAlerts: false,
      phone: "",
    },
    mode: "onChange",
  });

  const smsAlertsEnabled = notificationsForm.watch("smsAlerts");

  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.displayName || "",
        email: user.email || "",
      });

      const fetchSettings = async () => {
        setIsFetchingSettings(true);
        const userDocRef = doc(db, "users", user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
              const data = userDoc.data();
              notificationsForm.reset({
                  emailAlerts: data.emailAlerts,
                  smsAlerts: data.smsAlerts,
                  phone: data.phone || "",
              });
          } else {
               const defaultSettings = {
                  userId: user.uid,
                  emailAlerts: true,
                  smsAlerts: false,
                  phone: "",
              };
               await setDoc(userDocRef, defaultSettings);
               notificationsForm.reset(defaultSettings);
          }
        } catch (error) {
          console.error("Error fetching user settings:", error);
           notificationsForm.reset({
              emailAlerts: true,
              smsAlerts: false,
              phone: "",
          });
        } finally {
          setIsFetchingSettings(false);
        }
      };

      fetchSettings();
    }
  }, [user, profileForm, notificationsForm]);

  async function onProfileSubmit(data: ProfileFormValues) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to update your profile.",
      });
      return;
    }
    setIsSavingProfile(true);
    try {
      await updateProfile(user, {
        displayName: data.name,
      });
      toast({
        title: "Profile Updated",
        description: "Your name has been successfully updated.",
      });
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Error",
        description: "Could not update your profile. Please try again.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onNotificationsSubmit(data: NotificationsFormValues) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to update your settings.",
      });
      return;
    }
    setIsSavingNotifications(true);
    try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { userId: user.uid, ...data }, { merge: true });
        toast({
            title: "Notification Settings Updated",
            description: "Your notification preferences have been saved.",
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not save your settings. Please try again.",
        });
    } finally {
        setIsSavingNotifications(false);
    }
  }
  
  const getInitials = (name?: string | null) => {
    if (!name) return "";
    const nameParts = name.split(" ");
    if (nameParts.length > 1) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  if (authLoading) {
    return (
        <div className="space-y-8">
            <Skeleton className="h-[250px] w-full" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and notification settings.
        </p>
      </div>
      
      <Form {...profileForm}>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                This is how others will see you on the site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={user?.photoURL || "https://placehold.co/100x100.png"} alt="@user" data-ai-hint="user avatar" />
                    <AvatarFallback>{getInitials(user?.displayName) || getInitials(user?.email)}</AvatarFallback>
                </Avatar>
                <Button variant="outline" type="button">Change Photo</Button>
              </div>
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} disabled={isSavingProfile}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" {...field} disabled />
                    </FormControl>
                     <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
             <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={isSavingProfile || authLoading}>
                 {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
      
      <Form {...notificationsForm}>
        <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)} className="space-y-8">
           <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Configure how you receive alerts and notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
              control={notificationsForm.control}
              name="emailAlerts"
              render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                      <FormLabel className="text-base">Email Alerts</FormLabel>
                      <FormDescription>
                      Receive an email for critical alerts at {user?.email}
                      </FormDescription>
                  </div>
                  <FormControl>
                      <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSavingNotifications || isFetchingSettings}
                      />
                  </FormControl>
                  </FormItem>
              )}
              />
              <FormField
              control={notificationsForm.control}
              name="smsAlerts"
              render={({ field }) => (
                  <FormItem className="flex flex-col justify-between rounded-lg border p-4">
                  <div className="flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                      <FormLabel className="text-base">SMS Alerts</FormLabel>
                      <FormDescription>
                          Receive a text message for critical alerts.
                      </FormDescription>
                      </div>
                      <FormControl>
                      <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSavingNotifications || isFetchingSettings}
                      />
                      </FormControl>
                  </div>
                  {smsAlertsEnabled && (
                      <div className="pt-4">
                          <FormField
                          control={notificationsForm.control}
                          name="phone"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Mobile Number</FormLabel>
                              <FormControl>
                                  <Controller
                                      control={notificationsForm.control}
                                      name="phone"
                                      render={({ field: { onChange, value } }) => (
                                      <PhoneInput
                                          value={value}
                                          onChange={onChange}
                                          defaultCountry="US"
                                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                          disabled={isSavingNotifications || isFetchingSettings}
                                      />
                                      )}
                                  />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                          />
                      </div>
                  )}
                  </FormItem>
              )}
              />
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={isSavingNotifications || isFetchingSettings}>
                {(isSavingNotifications || isFetchingSettings) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
