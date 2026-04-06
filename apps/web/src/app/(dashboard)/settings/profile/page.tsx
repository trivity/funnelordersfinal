'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Bell, Mail, Slack } from 'lucide-react';
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

const notifSchema = z.object({
  notifyOnFailure: z.boolean(),
  alertEmail: z.string().email().or(z.literal('')).optional(),
  slackWebhookUrl: z.string().url().or(z.literal('')).optional(),
});
type NotifForm = z.infer<typeof notifSchema>;

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  const { register: regPw, handleSubmit: handlePwSubmit, reset: resetPw, formState: { errors: pwErrors } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  });

  const { register: regNotif, handleSubmit: handleNotifSubmit, reset: resetNotif, watch: watchNotif, formState: { errors: notifErrors } } = useForm<NotifForm>({
    resolver: zodResolver(notifSchema),
    defaultValues: { notifyOnFailure: true, alertEmail: '', slackWebhookUrl: '' },
  });

  const notifyOnFailure = watchNotif('notifyOnFailure');

  useEffect(() => {
    if (user) {
      reset({ firstName: user.firstName, lastName: user.lastName, email: user.email });
      resetNotif({
        notifyOnFailure: user.notifyOnFailure,
        alertEmail: user.alertEmail ?? '',
        slackWebhookUrl: user.slackWebhookUrl ?? '',
      });
    }
  }, [user, reset, resetNotif]);

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

  const onNotifications = async (data: NotifForm) => {
    setSavingNotif(true);
    try {
      await api.patch('/user/notifications', {
        notifyOnFailure: data.notifyOnFailure,
        alertEmail: data.alertEmail || null,
        slackWebhookUrl: data.slackWebhookUrl || null,
      });
      await fetchMe();
      toast.success('Notification settings saved');
    } catch {
      toast.error('Failed to save notification settings');
    } finally {
      setSavingNotif(false);
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

      <form onSubmit={handlePwSubmit(onPassword)} className="bg-white border border-border rounded-lg p-6 space-y-4 mb-6">
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

      <form onSubmit={handleNotifSubmit(onNotifications)} className="bg-white border border-border rounded-lg p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Routing Failure Alerts</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Get notified when an order fails to route after all retry attempts are exhausted.
        </p>

        {/* Toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only" {...regNotif('notifyOnFailure')} />
            <div className={`w-10 h-6 rounded-full transition-colors ${notifyOnFailure ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifyOnFailure ? 'translate-x-4' : ''}`} />
            </div>
          </div>
          <span className="text-sm font-medium">Enable failure alerts</span>
        </label>

        {notifyOnFailure && (
          <>
            {/* Alert email */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Alert email
                <span className="text-xs font-normal text-muted-foreground">(leave blank to use your account email)</span>
              </label>
              <input
                {...regNotif('alertEmail')}
                type="email"
                placeholder={user?.email ?? 'your@email.com'}
                className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {notifErrors.alertEmail && <p className="text-destructive text-xs mt-1">{notifErrors.alertEmail.message}</p>}
            </div>

            {/* Slack webhook */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
                <Slack className="w-3.5 h-3.5 text-muted-foreground" />
                Slack webhook URL
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                {...regNotif('slackWebhookUrl')}
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              {notifErrors.slackWebhookUrl && <p className="text-destructive text-xs mt-1">{notifErrors.slackWebhookUrl.message}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Create an incoming webhook at{' '}
                <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  api.slack.com/apps
                </a>
              </p>
            </div>
          </>
        )}

        <button type="submit" disabled={savingNotif} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
          {savingNotif ? 'Saving...' : 'Save notification settings'}
        </button>
      </form>
    </div>
  );
}
