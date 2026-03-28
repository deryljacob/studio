
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  UserCredential
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';


const formSchema = z
  .object({
    email: z.string().email({ message: 'Please enter a valid email.' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters.' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  });

export default function SignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function handleSuccessfulSignUp(userCredential: UserCredential) {
    const user = userCredential.user;
    if (!user) return; // Should not happen

    // Create a user document in Firestore with default settings
    try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
            userId: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            emailAlerts: true,
            smsAlerts: false,
            phone: '',
        });

        toast({
            title: 'Account Created',
            description: "You've successfully created your account.",
        });
        router.push('/dashboard');

    } catch (error) {
        console.error("Error creating user document:", error);
        toast({
            variant: "destructive",
            title: "Sign Up Failed",
            description: "There was an issue setting up your profile. Please try again.",
        });
    }
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      await handleSuccessfulSignUp(userCredential);
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
        const userCredential = await signInWithPopup(auth, provider);
        await handleSuccessfulSignUp(userCredential);
    } catch (error: any) {
        handleAuthError(error, "Google");
    } finally {
        setIsGoogleLoading(false);
    }
  }

  function handleAuthError(error: any, provider?: string) {
    let description = "An unknown error occurred. Please try again.";
    if (error.code === 'auth/email-already-in-use') {
      description = 'An account with this email already exists. Please sign in instead.';
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      description = 'An account already exists with the same email address but different sign-in credentials. Try signing in with a different provider.';
    } else {
      description = `Could not sign up with ${provider || 'email'}. Please try again.`
    }

    toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: description,
    });
  }


  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-serif">Sign Up</CardTitle>
            <CardDescription>
              Already a member?{' '}
              <Link href="/sign-in" className="underline text-primary">
                Log In
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" style={{backgroundColor: '#4285F4', color: 'white'}} onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading}>
                  {isGoogleLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                       <img src="https://placehold.co/20x20/FFFFFF/4285F4.png?text=G" alt="Google" className="mr-2 h-5 w-5 bg-white rounded-sm p-0.5" data-ai-hint="google logo" />
                  )}
                  Sign up with Google
              </Button>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            {showEmailForm ? (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input
                                placeholder="name@example.com"
                                {...field}
                                disabled={isLoading}
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input
                                type="password"
                                placeholder="••••••••"
                                {...field}
                                disabled={isLoading}
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                                <Input
                                type="password"
                                placeholder="••••••••"
                                {...field}
                                disabled={isLoading}
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Sign up with email
                        </Button>
                    </form>
                </Form>
            ) : (
                <Button variant="outline" className="w-full" onClick={() => setShowEmailForm(true)}>
                    Sign up with email
                </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
