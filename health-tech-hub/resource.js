import firstAid from '../assets/icons/phosphor/first-aid-kit.svg?url';
import brain from '../assets/icons/phosphor/brain.svg?url';
import briefcase from '../assets/icons/phosphor/briefcase.svg?url';
import heartbeat from '../assets/icons/phosphor/heartbeat.svg?url';
import buildings from '../assets/icons/phosphor/buildings.svg?url';

const icons = { 'first-aid-kit.svg': firstAid, 'brain.svg': brain, 'briefcase.svg': briefcase, 'heartbeat.svg': heartbeat, 'buildings.svg': buildings };
const resources = {
  readiness: {
    category: 'TECHNOLOGY · TEAM ASSESSMENT',
    title: 'Clinical technology readiness',
    description: 'A guided starting point for teams preparing to evaluate a new digital tool in a healthcare setting.',
    long: 'Explore the people, practice, and system questions that can help a team prepare for a technology evaluation. This sample assessment is designed to prompt a structured conversation before a product or workflow is introduced.',
    icon: 'first-aid-kit.svg', related: 'AI in clinical practice', relatedId: 'clinical-ai', relatedDescription: 'Build a shared understanding of how AI is being used in healthcare and what to ask before adoption.',
  },
  'clinical-ai': {
    category: 'LEARNING · INTRODUCTORY',
    title: 'AI in clinical practice',
    description: 'Understand current uses, limitations, and the questions to ask before introducing AI into clinical workflows.',
    long: 'This sample learning pathway introduces key ideas in healthcare AI, including where tools may support a team, what their limitations can mean, and how to bring clinical, operational, and technical perspectives into an evaluation.',
    icon: 'brain.svg', related: 'Human factors & digital safety', relatedId: 'safety', relatedDescription: 'Consider how people, processes, and technology interact in care environments.',
  },
  informatics: {
    category: 'CAREER · PATHWAY',
    title: 'Clinical informatics',
    description: 'Explore a field that brings clinical knowledge, information systems, and care improvement together.',
    long: 'Clinical informatics connects care delivery with the systems that support it. This sample pathway introduces the kinds of collaboration, problem solving, and technology understanding that can be part of the field.',
    icon: 'briefcase.svg', related: 'Digital health implementation', relatedId: 'implementation', relatedDescription: 'Learn about work that helps healthcare teams adopt and use new technology.',
  },
  tools: {
    category: 'TECHNOLOGY · TOOLS & INNOVATION',
    title: 'Digital health tools',
    description: 'Discover a sample directory of technologies designed for healthcare settings.',
    long: 'A live directory could help teams compare tools with clear information about their purpose, intended users, implementation needs, and review status. This page uses illustrative content only and does not endorse a product.',
    icon: 'heartbeat.svg', related: 'Clinical technology readiness', relatedId: 'readiness', relatedDescription: 'Start with the team and workflow questions that shape a useful technology evaluation.',
  },
  safety: {
    category: 'LEARNING · TEAM SESSION',
    title: 'Human factors & digital safety',
    description: 'Consider how people, processes, and technology interact in real healthcare environments.',
    long: 'This sample team session invites people to look at the conditions around a digital tool: how it fits into existing work, how teams understand its output, and where additional review or support may be needed.',
    icon: 'first-aid-kit.svg', related: 'Clinical technology readiness', relatedId: 'readiness', relatedDescription: 'Explore a structured starting point for teams preparing to evaluate a digital tool.',
  },
  implementation: {
    category: 'CAREER · ROLE SPOTLIGHT',
    title: 'Digital health implementation',
    description: 'Learn about a role that helps healthcare teams plan for and adopt digital technology.',
    long: 'Implementation work can bring clinical, operational, and technical teams together around a new tool or service. This sample role spotlight describes the focus of the work without representing a specific job opening.',
    icon: 'buildings.svg', related: 'Clinical informatics', relatedId: 'informatics', relatedDescription: 'Explore a career pathway linking clinical knowledge with digital systems.',
  },
};

const id = new URLSearchParams(window.location.search).get('id') || 'clinical-ai';
const resource = resources[id] || resources['clinical-ai'];
document.title = `${resource.title} — HealthTech Hub`;
document.querySelector('#detail-title').textContent = resource.title;
document.querySelector('#detail-crumb').textContent = resource.title;
document.querySelector('#detail-category').textContent = resource.category;
document.querySelector('#detail-description').textContent = resource.description;
document.querySelector('#detail-long-description').textContent = resource.long;
document.querySelector('#detail-art .detail-art-center img').src = icons[resource.icon];
document.querySelector('#related-title').textContent = resource.related;
document.querySelector('#related-title').href = `/health-tech-hub/resource/?id=${resource.relatedId}`;
document.querySelector('#related-description').textContent = resource.relatedDescription;
document.querySelector('#related-link').href = `/health-tech-hub/resource/?id=${resource.relatedId}`;
document.querySelector('#related-title').closest('.related-resource').querySelector('h3').setAttribute('aria-label', resource.related);

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  navigation.classList.toggle('open', open);
});
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    navigation.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});
