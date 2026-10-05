import { mkdir, readFile, writeFile } from 'node:fs/promises';

// These pages are generated from a shared template. Edit the content here.
const services = [
  {
    slug: 'ai-agents', name: 'AI agents & automation',
    title: 'Give repetitive work a better home.',
    description: 'AI agents for small teams that need help sorting requests, drafting responses, and moving routine work forward—with people in control of the decisions that matter.',
    useCase: 'From support request to a useful draft.',
    example: 'An incoming request is classified, given relevant context, and turned into a draft reply. Ambiguous requests go to a human for approval in Slack.',
    boundary: 'We agree what the agent can read, draft, and act on before building. Approval rules and exception handling are part of the scope.',
    cards: [
      ['A defined workflow', 'Map the inputs, outputs, exception cases, and success criteria for a focused first release.'],
      ['Connected tools', 'Integrate the agreed inbox, knowledge sources, and approval channel. Scope permissions around the task.'],
      ['A reviewable handover', 'Deliver the custom code, setup notes, and a walkthrough of the workflow and its human checkpoints.'],
    ],
    questions: [
      ['Will the agent send messages automatically?', 'That depends on the agreed workflow. We can start with drafting and human approval, then assess whether particular actions should be automated.'],
      ['What if a request is ambiguous?', 'We define an escalation path and approval rules rather than leaving the agent to guess. The first release is reviewed against agreed examples and acceptance criteria.'],
      ['Can we use our existing AI provider?', 'We assess your provider, model access, and data requirements during discovery. Provider usage and service costs are identified in the proposal.'],
    ],
  },
  {
    slug: 'mcp-integrations', name: 'MCP integrations',
    title: 'Your business data. A clearer conversation.',
    description: 'Connect AI tools to the systems your team already uses through Model Context Protocol (MCP), with scoped permissions and clear boundaries around data access.',
    useCase: 'Ask an operational question. Get a grounded answer.',
    example: 'A team asks which leases renew this month. A permissioned MCP server checks access and queries the relevant PostgreSQL records, so the answer comes from current business data.',
    boundary: 'MCP provides the connection. Access rules, allowed tools, and the data exposed through that connection are designed around your workflow.',
    cards: [
      ['An integration plan', 'Identify the AI client, data sources, allowed queries, and access model before building.'],
      ['A scoped MCP server', 'Expose the agreed tools and data sources with permissions appropriate to the task.'],
      ['Documentation & setup', 'Deliver the custom integration code, configuration guidance, and a walkthrough for your team.'],
    ],
    questions: [
      ['What is MCP in plain language?', 'It is a way for an AI application to use tools and access contextual information from connected systems. We build the connection for the data and actions your team needs.'],
      ['Does the AI get unrestricted database access?', 'Access is scoped during discovery. We agree what the integration can query or change and include permission checks in the implementation.'],
      ['Can the integration be read-only?', 'Yes. A first release can focus on retrieving information. Any write actions require explicit scoping and an agreed approval model.'],
    ],
  },
  {
    slug: 'cybersecurity', name: 'Cybersecurity',
    title: 'Build confidence into your systems.',
    description: 'Practical cloud reviews, access controls, and security hardening for small teams preparing to grow or respond to a customer’s security requirements.',
    useCase: 'Prepare for a customer’s security review.',
    example: 'Review the agreed cloud accounts, improve access controls, rotate exposed secrets where needed, and document the relevant policies and remaining actions.',
    boundary: 'We define the systems and review criteria at the start. This is scoped engineering work; customer acceptance and formal certifications depend on their own requirements.',
    cards: [
      ['A scoped review', 'Agree which cloud accounts, identities, and customer requirements are included.'],
      ['Prioritized hardening', 'Work through agreed access-control, secret-management, and configuration changes, with review before consequential actions.'],
      ['A clear action record', 'Document completed changes, remaining findings, and recommendations your team can take forward.'],
    ],
    questions: [
      ['Can you help with a vendor security questionnaire?', 'We can review the technical requirements and help document the scoped systems and improvements. Share the questionnaire during discovery so we can assess what is involved.'],
      ['Will this provide a security certification?', 'A cloud review or hardening project does not itself provide certification. If you need a formal audit or certification, we identify that requirement during scoping.'],
      ['How is access to our cloud accounts handled?', 'We agree the required permissions and review process before work starts, using scoped access for the systems included in the project.'],
    ],
  },
  {
    slug: 'internal-tools', name: 'Internal tools & web development',
    title: 'Useful software, built around your workflow.',
    description: 'Custom Slack apps, internal tools, and websites for small teams. Start with one clear problem and leave with software your team can own and understand.',
    useCase: 'Bring a scattered workflow into one place.',
    example: 'A focused tool can gather the information a team needs, connect the agreed systems, and provide a clear interface for the next action.',
    boundary: 'The first release is defined around your users, existing stack, and acceptance criteria. Further features can be scoped after your team has tried it.',
    cards: [
      ['A focused specification', 'Define the users, essential screens, integrations, and acceptance criteria.'],
      ['A working first release', 'Build the agreed tool or website, connect the required services, and review the core user flows.'],
      ['Code & documentation', 'Hand over custom source code, setup instructions, and a walkthrough. Agree hosting and maintenance responsibilities in the proposal.'],
    ],
    questions: [
      ['Can you extend a tool we already use?', 'We first assess its code, APIs, access model, and constraints. That helps us decide whether extending it or building a focused companion tool is the better fit.'],
      ['Do you build public websites as well?', 'Yes. We can scope a public website alongside or separately from internal tools, with the pages, content, and user flows agreed before implementation.'],
      ['Who handles hosting and maintenance?', 'We identify hosting, service subscriptions, and maintenance responsibilities in the proposal. Ongoing support can be scoped separately from the initial build.'],
    ],
  },
];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const home = await readFile('index.html', 'utf8');
const header = home.match(/<header class="header">[\s\S]*?<\/header>/)[0]
  .replaceAll('href="#', 'href="/#');
const footer = home.match(/<footer class="footer">[\s\S]*?<\/footer>/)[0]
  .replaceAll('href="#', 'href="/#');
const booking = `<a class="button button-lime booking-link" href="https://calendly.com/imeanhashir88/30min" target="_blank" rel="noopener">Book a 30-minute discovery call <img src="/assets/icons/phosphor/arrow-up-right.svg" width="20" height="20" alt=""></a>`;
function page({ title, description, path, body, schema }) {
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101010"><title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="https://aiquor.github.io${path}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="Aiquor">
  <meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="https://aiquor.github.io${path}">
  <meta property="og:image" content="https://aiquor.github.io/assets/social/aiquor-og.png">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Aiquor — AI agents and internal tools for small teams">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="https://aiquor.github.io/assets/social/aiquor-og.png">
  <link rel="icon" href="/assets/social/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/styles/improvements.css">
  <script type="module" src="/js/app.js"></script>
  ${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ''}
  <noscript><style>.header nav{display:flex;position:static;background:transparent;padding:0;border:0}.menu-toggle{display:none}@media(max-width:760px){.header nav{grid-column:1/-1;flex-wrap:wrap;font-size:12px}.header .nav-booking{grid-row:auto}}</style></noscript>
</head><body class="service-page"><a class="skip-link" href="#main">Skip to content</a>${header}
<main id="main">${body}</main>${footer}</body></html>\n`;
}
for (const service of services) {
  const path = `/services/${service.slug}/`;
  const body = `<section class="service-hero shell" id="top">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${escape(service.name)}</span></nav>
    <h1>${escape(service.title)}</h1><p class="service-description">${escape(service.description)}</p>
    <div class="hero-actions">${booking}<a class="text-link" href="/#work">View our work</a></div>
    <p class="booking-note">Leave with a clearer first use case, a view of feasibility, and a practical next step.</p>
  </section>
  <section class="service-content shell">
    <div class="service-use-case"><h2>${escape(service.useCase)}</h2><p>${escape(service.example)}</p><p>${escape(service.boundary)}</p></div>
    <div class="section-heading"><h2>What a first release includes.</h2></div>
    <div class="delivery-grid">${service.cards.map(([heading, text], index) => `<article class="delivery-step"><span class="step-number">0${index + 1} / DELIVERABLE</span><h3>${escape(heading)}</h3><p>${escape(text)}</p></article>`).join('')}</div>
    <div class="timeline-note"><h3>A focused scope. An agreed timeline.</h3><p>A focused pilot may take 2–6 weeks as a planning guide. The proposal confirms deliverables, dependencies, costs, and schedule. You keep the custom code and documentation; any ongoing support is scoped separately.</p></div>
    <div class="section-heading" style="margin-top:60px"><h2>Questions about ${escape(service.name.toLowerCase())}.</h2></div>
    <div class="faq-list">${service.questions.map(([question, answer]) => `<details><summary>${escape(question)}</summary><p>${escape(answer)}</p></details>`).join('')}</div>
    <div class="service-cta"><h2>Start with the task that costs you time.</h2><p>Tell us about your workflow and existing systems. We’ll discuss a useful first release and what is needed to scope it.</p><div class="hero-actions">${booking}<a class="text-link" href="/#contact">Send an enquiry</a></div></div>
  </section>`;
  await mkdir(`services/${service.slug}`, { recursive: true });
  await writeFile(`services/${service.slug}/index.html`, page({
    title: `${service.name} for small teams | Aiquor`, description: service.description, path, body,
    schema: { '@context': 'https://schema.org', '@type': 'Service', name: service.name, description: service.description,
      url: `https://aiquor.github.io${path}`, provider: { '@type': 'Organization', name: 'Aiquor', url: 'https://aiquor.github.io/' } },
  }));
}
await mkdir('privacy', { recursive: true });
await writeFile('privacy/index.html', page({ title: 'Privacy & enquiries | Aiquor', description: 'How Aiquor handles website enquiries, external booking links, and optional site analytics.', path: '/privacy/', body: `
  <section class="service-hero shell" id="top"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Privacy</span></nav><h1>Your enquiry. Your information.</h1><p class="service-description">How information is handled when you use this website.</p></section>
  <section class="service-content shell privacy-content">
    <h2>When you send an enquiry</h2><p>The form asks for your name, email address, optional company name, service interest, and message. We use those details to respond to your enquiry and discuss potential work. Please include only the information needed to describe the task.</p>
    <h2>Services involved</h2><p>The site is hosted on GitHub Pages. Form submissions are processed by <a href="https://formsubmit.co/privacy.pdf" target="_blank" rel="noopener">FormSubmit</a> and delivered to our contact inbox. Meeting links open Calendly; WhatsApp and email links open their respective services. Those services handle information under their own policies. Fonts are loaded from Google Fonts.</p>
    <h2>Analytics</h2><p>__ANALYTICS_PRIVACY__</p>
    <h2>Questions about your information</h2><p>Contact <a href="mailto:imeanhashir88@gmail.com">imeanhashir88@gmail.com</a> to ask about an enquiry or request removal of the information you sent. External services may retain records under their own policies.</p>
    <p><a href="/">Return to Aiquor</a></p>
  </section>` }));
console.log('Generated four service pages and the privacy page.');
