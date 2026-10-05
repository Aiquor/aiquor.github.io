import * as React from 'react';
import { createRoot } from 'react-dom/client';
import FluidFieldBackground from '@/components/ui/fluid-field';

const mount = document.getElementById('background-root');
if (mount) {
  createRoot(mount).render(<React.StrictMode><FluidFieldBackground className="h-full w-full" brightness={0.78} /></React.StrictMode>);
}
