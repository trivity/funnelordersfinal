'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Zap,
  CheckCircle2,
  ArrowDownToLine,
  GitBranch,
  RefreshCw,
  Archive,
  BarChart3,
  LinkIcon,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Fade-up variant factory used throughout
───────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut', delay },
  },
});

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

/* ─────────────────────────────────────────────
   Mock Orders Table (hero mockup)
───────────────────────────────────────────── */
const mockOrders = [
  {
    source: 'CLICKFUNNELS',
    sourceBg: 'bg-blue-100 text-blue-700',
    customer: 'John Smith',
    total: '$97.00',
    status: 'ROUTED',
    statusBg: 'bg-emerald-100 text-emerald-700',
  },
  {
    source: 'GHL',
    sourceBg: 'bg-purple-100 text-purple-700',
    customer: 'Sarah Johnson',
    total: '$47.00',
    status: 'ROUTED',
    statusBg: 'bg-emerald-100 text-emerald-700',
  },
  {
    source: 'KARTRA',
    sourceBg: 'bg-orange-100 text-orange-700',
    customer: 'Mike Davis',
    total: '$197.00',
    status: 'PROCESSING',
    statusBg: 'bg-yellow-100 text-yellow-700',
  },
];

function MockOrderTable() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-800/60 shadow-2xl backdrop-blur">
      {/* Browser chrome bar */}
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-slate-900/80 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
        <span className="h-3 w-3 rounded-full bg-green-400/80" />
        <div className="ml-3 flex-1 rounded bg-slate-700/60 px-3 py-1 text-xs text-slate-400">
          app.funnelorders.com/orders
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-4 border-b border-white/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span>Source</span>
        <span>Customer</span>
        <span>Total</span>
        <span>Status</span>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-white/5">
        {mockOrders.map((order, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.15, duration: 0.4 }}
            className="grid grid-cols-4 items-center px-5 py-3 text-sm text-slate-200 hover:bg-white/5"
          >
            <span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${order.sourceBg}`}>
                {order.source}
              </span>
            </span>
            <span className="text-slate-300">{order.customer}</span>
            <span className="font-medium text-white">{order.total}</span>
            <span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${order.statusBg}`}>
                {order.status}
              </span>
            </span>
          </motion.div>
        ))}
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/40 px-5 py-2.5 text-xs text-slate-500">
        <span>3 orders shown</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live routing active
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Navbar
───────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-slate-200/60 bg-white/90 backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold text-blue-600">FunnelOrders</span>
        </Link>

        {/* Nav actions */}
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className={`text-sm font-medium transition-colors ${
              scrolled ? 'text-slate-700 hover:text-slate-900' : 'text-white/80 hover:text-white'
            }`}
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────
   Hero Section
───────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 px-6 pb-24 pt-32 text-center">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300"
        >
          <Zap className="h-3.5 w-3.5" />
          Order Routing Automation
        </motion.div>

        {/* H1 */}
        <motion.h1
          variants={fadeUp(0.1)}
          initial="hidden"
          animate="visible"
          className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          Connect Your Funnels to{' '}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Your Store
          </span>{' '}
          — Automatically
        </motion.h1>

        {/* Subheading */}
        <motion.p
          variants={fadeUp(0.2)}
          initial="hidden"
          animate="visible"
          className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-400"
        >
          FunnelOrders routes every purchase from ClickFunnels, GoHighLevel, and Kartra directly
          into your WooCommerce or Shopify store. No manual exports. No missed orders.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp(0.3)}
          initial="hidden"
          animate="visible"
          className="mb-8 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/register"
            className="rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Start Free Trial
          </Link>
          <a
            href="#features"
            className="rounded-xl border border-white/20 px-8 py-3.5 text-base font-semibold text-white/80 transition-all hover:border-white/40 hover:text-white hover:bg-white/5"
          >
            See How It Works
          </a>
        </motion.div>

        {/* Social proof */}
        <motion.p
          variants={fadeUp(0.4)}
          initial="hidden"
          animate="visible"
          className="mb-16 text-sm text-slate-500"
        >
          Trusted by store owners routing{' '}
          <span className="font-semibold text-slate-300">10,000+ orders/month</span>
        </motion.p>

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
          className="mx-auto max-w-2xl"
        >
          <MockOrderTable />
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   How It Works Section
───────────────────────────────────────────── */
const steps = [
  {
    Icon: ArrowDownToLine,
    title: 'Connect Your Funnel',
    description:
      'Link ClickFunnels, GHL, or Kartra in one click. We handle the webhooks.',
  },
  {
    Icon: Zap,
    title: 'Orders Route Automatically',
    description:
      'Every purchase triggers your Workflow rules and gets pushed to the right store instantly.',
  },
  {
    Icon: CheckCircle2,
    title: 'Fulfilled in Your Store',
    description:
      'Orders land in WooCommerce or Shopify ready to fulfill — with customer details and line items intact.',
  },
];

function HowItWorksSection() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          variants={fadeUp()}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Three steps to automated order routing
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-8 sm:grid-cols-3"
        >
          {steps.map(({ Icon, title, description }, i) => (
            <motion.div
              key={i}
              variants={fadeUp(i * 0.15)}
              className="relative flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Step number */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-md">
                {i + 1}
              </div>
              <div className="mb-5 mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <Icon className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="mb-3 text-lg font-bold text-slate-900">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Features Section
───────────────────────────────────────────── */
const features = [
  {
    Icon: Zap,
    title: 'Live Order Routing',
    description: 'Workflows fire the moment an order arrives. No polling, no delays.',
  },
  {
    Icon: LinkIcon,
    title: 'Multi-Platform',
    description:
      'Connect ClickFunnels, GoHighLevel, Kartra, WooCommerce, and Shopify.',
  },
  {
    Icon: GitBranch,
    title: 'Workflow Builder',
    description:
      'Build routing rules by source, total, product name, or customer tag.',
  },
  {
    Icon: BarChart3,
    title: 'Real-time Status',
    description:
      'Track every order from received to routed with live status badges.',
  },
  {
    Icon: RefreshCw,
    title: 'Retry Engine',
    description:
      'Failed pushes auto-retry with exponential backoff. Manual retry in one click.',
  },
  {
    Icon: Archive,
    title: 'Order Archives',
    description:
      'Archive fulfilled orders out of your main view. Restore anytime.',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          variants={fadeUp()}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Everything you need to automate order flow
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map(({ Icon, title, description }, i) => (
            <motion.div
              key={i}
              variants={fadeUp(i * 0.1)}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="mb-2 text-base font-bold text-slate-900">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Pricing Section
───────────────────────────────────────────── */
const plans = [
  {
    name: 'Starter',
    price: '$29.99',
    highlight: false,
    badge: null,
    features: [
      '1 store environment',
      '1 funnel source (ClickFunnels, GHL, or Kartra)',
      '1 fulfillment destination (WooCommerce or Shopify)',
      'Unlimited workflows',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    price: '$49.99',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Up to 5 store environments',
      'Unlimited funnel sources per store',
      'Unlimited fulfillment destinations',
      'Unlimited workflows',
      'Priority support',
    ],
  },
  {
    name: 'Agency',
    price: '$97.99',
    highlight: false,
    badge: null,
    features: [
      'Unlimited store environments',
      'Unlimited funnel sources',
      'Unlimited fulfillment destinations',
      'Unlimited workflows',
      'White-glove onboarding',
      'Dedicated support',
    ],
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          variants={fadeUp()}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-4 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
        </motion.div>
        <motion.p
          variants={fadeUp(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-16 text-center text-slate-500"
        >
          Every plan includes unlimited workflows and automated routing.
        </motion.p>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-8 sm:grid-cols-3"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              variants={fadeUp(i * 0.15)}
              className={`relative flex flex-col rounded-2xl border p-8 transition-shadow ${
                plan.highlight
                  ? 'scale-[1.03] border-blue-500 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500'
                  : 'border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white shadow-sm">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="mb-1 text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                  <span className="mb-1 text-sm text-slate-400">/mo</span>
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feat, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`block rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                  plan.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/30'
                    : 'border border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600'
                }`}
              >
                Get Started
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CTA Banner
───────────────────────────────────────────── */
function CTABanner() {
  return (
    <section className="bg-blue-600 px-6 py-20">
      <motion.div
        variants={fadeUp()}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="mx-auto max-w-3xl text-center"
      >
        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
          Ready to stop manually exporting orders?
        </h2>
        <p className="mb-10 text-lg text-blue-100">
          Set up in 5 minutes. Your first order routes automatically.
        </p>
        <Link
          href="/register"
          className="inline-block rounded-xl bg-white px-8 py-3.5 text-base font-bold text-blue-600 shadow-lg transition-all hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-xl"
        >
          Start Free Trial
        </Link>
      </motion.div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Footer
───────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-slate-900 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-400" />
          <span className="font-bold text-white">FunnelOrders</span>
        </div>

        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
          <Link href="/login" className="transition-colors hover:text-white">
            Login
          </Link>
          <a href="#pricing" className="transition-colors hover:text-white">
            Pricing
          </a>
          <a
            href="mailto:support@funnelorders.com"
            className="transition-colors hover:text-white"
          >
            Contact
          </a>
        </nav>

        {/* Copyright */}
        <p className="text-sm text-slate-500">
          &copy; 2026 FunnelOrders. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
