'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const { user, loading, facilityId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!facilityId) router.replace('/selecionar-unidade');
    else router.replace('/dashboard');
  }, [loading, user, facilityId, router]);

  return (
    <div className="content">
      <p>Abrindo painel…</p>
    </div>
  );
}
