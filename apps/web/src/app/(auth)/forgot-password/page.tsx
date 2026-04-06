'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await api.post('/auth/forgot-password', data).catch(() => {});
    setSent(true);
    toast.success('Reset link sent if email is registered.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white shadow-sm border border-border rounded-lg p-8">
          <h1 className="text-2xl font-bold mb-2">Reset password</h1>
          <p className="text-muted-foreground text-sm mb-6">Enter your email to receive a reset link.</p>

          {!sent ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
              </div>
              <button type="submit" className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium">
                Send reset link
              </button>
            </form>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Check your inbox for a reset link.
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href="/login" className="text-primary hover:underline">Back to login</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
