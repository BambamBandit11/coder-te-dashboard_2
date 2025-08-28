import { useState, useEffect } from 'react';
import Head from 'next/head';
import { TEDashboard } from '../components/TEDashboard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Head>
        <title>Coder T&E Dashboard</title>
        <meta name="description" content="Travel & Entertainment Dashboard for Coder Finance" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <ErrorBoundary>
        <TEDashboard />
      </ErrorBoundary>
    </>
  );
}
