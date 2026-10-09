import * as React from 'react';
import { createRoot } from 'react-dom/client';
import FluidFieldBackground from '@/components/ui/fluid-field';
import WorkflowOrbit from '@/components/ui/workflow-orbit';

const mount = document.getElementById('background-root');
if (mount) {
  createRoot(mount).render(<React.StrictMode><FluidFieldBackground className="h-full w-full" brightness={0.78} /></React.StrictMode>);
}

const workflowMount = document.getElementById('workflow-orbit-root');
const workflowHost = workflowMount?.closest<HTMLElement>('.workflow-art');
if (workflowMount && workflowHost) {
  createRoot(workflowMount).render(<React.StrictMode><WorkflowOrbit host={workflowHost} /></React.StrictMode>);
}
