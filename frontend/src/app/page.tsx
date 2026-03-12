/**
 * app/page.tsx - Root page redirect.
 *
 * Redirects to /dashboard as the main entry point.
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}

