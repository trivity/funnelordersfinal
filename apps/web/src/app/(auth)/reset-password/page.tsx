'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[a-z]/, 'Must include a lowercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      toast.error('Reset link is missing or invalid');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      setDone(true);
      toast.success('Password updated. You can log in now.');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to reset password';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">This reset link is invalid or incomplete.</p>
        <Link href="/forgot-password" className="text-primary hover:underline text-sm font-medium">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">Your password has been reset.</p>
        <Link href="/login" className="text-primary hover:underline text-sm font-medium">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">New password</label>
        <input
          {...register('password')}
          type="password"
          className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="••••••••"
        />
        {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Confirm password</label>
        <input
          {...register('confirmPassword')}
          type="password"
          className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="••••••••"
        />
        {errors.confirmPassword && (
          <p className="text-destructive text-xs mt-1">{errors.confirmPassword.message}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
      >
        {isLoading ? 'Updating...' : 'Reset password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white shadow-sm border border-border rounded-lg p-8">
          <h1 className="text-2xl font-bold mb-2">Set new password</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Choose a new password for your FunnelOrders account.
          </p>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
            <ResetPasswordForm />
          </Suspense>
          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
