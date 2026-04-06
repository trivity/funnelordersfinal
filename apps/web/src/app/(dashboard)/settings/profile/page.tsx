'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const pwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
type PwForm = z.infer<typeof pwSchema>;

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  const { register: regPw, handleSubmit: handlePwSubmit, reset: resetPw, formState: { errors: pwErrors } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  });

  useEffect(() => {
    if (user) reset({ firstName: user.firstName, lastName: user.lastName, email: user.email });
  }, [user, reset]);

  const onProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      await api.patch('/user/profile', data);
      await fetchMe();
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const onPassword = async (data: PwForm) => {
    setSavingPw(true);
    try {
      await api.patch('/user/password', data);
      resetPw();
      toast.success('Password changed');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to change password';
      toast.error(msg);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <form onSubmit={handleSubmit(onProfile)} className="bg-white border border-border rounded-lg p-6 space-y-4 mb-6">
        <h2 className="font-semibold">Personal Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First name</label>
            <input {...register('firstName')} className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.firstName && <p className="text-destructive text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last name</label>
            <input {...register('lastName')} className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input {...register('email')} type="email" className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
        </div>
        <button type="submit" disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      <form onSubmit={handlePwSubmit(onPassword)} className="bg-white border border-border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold">Change Password</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Current password</label>
          <input {...regPw('currentPassword')} type="password" className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {pwErrors.currentPassword && <p className="text-destructive text-xs mt-1">{pwErrors.currentPassword.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New password</label>
          <input {...regPw('newPassword')} type="password" className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {pwErrors.newPassword && <p className="text-destructive text-xs mt-1">{pwErrors.newPassword.message}</p>}
        </div>
        <button type="submit" disabled={savingPw} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
          {savingPw ? 'Changing...' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
