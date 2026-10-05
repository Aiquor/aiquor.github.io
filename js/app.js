import { trackEvent } from './analytics.js';

const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  navigation.classList.toggle('open', open);
});
navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open navigation');
}));

const projects = [...document.querySelectorAll('.project')];
projects.forEach(project => { project.querySelector('.project-body').inert = !project.classList.contains('active'); });
function activateProject(project) {
  projects.forEach(item => {
    const active = item === project;
    item.classList.toggle('active', active);
    item.querySelector('button').setAttribute('aria-expanded', String(active));
    item.querySelector('.project-body').inert = !active;
    item.querySelector('.project-plus').textContent = active ? '−' : '+';
  });
  if (window.ScrollTrigger) window.setTimeout(() => ScrollTrigger.refresh(), 350);
  trackEvent('case_study_open', { case_id: project.dataset.project });
}
projects.forEach(project => {
  project.querySelector('button').addEventListener('click', () => activateProject(project));

});

document.querySelectorAll('[data-interest]').forEach(link => link.addEventListener('click', () => {
  const interest = document.querySelector('#interest');
  if (interest) interest.value = link.dataset.interest;
}));
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

// Keep a complete duplicate beyond the viewport and scroll at the same gentle
// pixel speed on phones and desktops, regardless of the strip's width.
const logoMarquee = document.querySelector('.tools-strip .marquee');
const logoTrack = logoMarquee?.querySelector('.marquee-track');
if (logoTrack) {
  const sizeLogoLoop = () => {
    logoTrack.style.setProperty('--logo-strip-width', `${logoMarquee.clientWidth}px`);
    const loopWidth = logoTrack.firstElementChild.getBoundingClientRect().width;
    logoTrack.style.animationDuration = `${loopWidth / 14}s`;
  };
  sizeLogoLoop();
  new ResizeObserver(sizeLogoLoop).observe(logoMarquee);
}

const form = document.querySelector('#contact-form');
const status = document.querySelector('#form-status');
const submit = document.querySelector('#submit-btn');
form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (form.elements._honey.value) return;
  submit.disabled = true;
  submit.textContent = 'Sending…';
  status.classList.remove('error');
  status.textContent = '';
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
      method: 'POST', body: new FormData(form), signal: controller.signal, headers: { Accept: 'application/json' }
    });
    const data = await response.json();
    if (!response.ok || !(data.success === true || data.success === 'true')) throw new Error('Submission failed');
    status.textContent = 'Your message was submitted. We’ll get back to you within one business day.';
    trackEvent('generate_lead', { method: 'contact_form' });
    form.reset();
  } catch (error) {
    status.classList.add('error');
    const email = new URL(form.action).pathname.slice(1);
    status.textContent = `Your message could not be sent. Please try again or email ${email}.`;
  } finally {
    window.clearTimeout(timeout);
    submit.disabled = false;
    submit.innerHTML = 'Send your enquiry <svg width="20" height="20" viewBox="0 0 256 256" aria-hidden="true"><use href="#ph-arrow-up-right"/></svg>';
  }
});

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  const motion = gsap.matchMedia();
  motion.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.from('.hero-copy > *', { y: 24, opacity: 0, duration: .85, stagger: .1, ease: 'power3.out' });
    gsap.from('.hero-art', { opacity: 0, scale: .9, duration: 1.4, ease: 'power3.out' });
    gsap.from('.hero-bottom', { opacity: 0, duration: 1, delay: .7 });
    document.querySelectorAll('.section-heading, .team, .contact-copy').forEach(element => {
      gsap.from(element, { y: 35, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 90%', once: true } });
    });
    document.querySelectorAll('.service').forEach(element => {
      gsap.from(element, { y: 35, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 92%', once: true } });
    });
    // Closed accordion panels have no measurable bounds on mobile. Use the
    // shared accordion for their entrance so opening a panel cannot leave its
    // visual dimmed by a scroll trigger initialized at zero height.
    document.querySelectorAll('.project-visual').forEach(element => {
      gsap.fromTo(element, { scale: .8 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: element.closest('.project-accordion'), start: 'top bottom', end: 'top 55%', scrub: 1 } });
    });
    document.querySelectorAll('.inline-photo').forEach(element => {
      gsap.fromTo(element, { scale: .8 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: element, start: 'top bottom', end: 'top 55%', scrub: 1 } });
      // Keep case-study illustrations legible while their details are being read.
    });
  });
  motion.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
    if (document.querySelector('.approach-grid')) ScrollTrigger.create({ trigger: '.approach-grid', start: 'top 120px', end: () => `bottom ${120 + document.querySelector('.approach-title').offsetHeight}px`, pin: '.approach-title', pinSpacing: false });
    gsap.to('.orbital-light', { y: 80, opacity: .3, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
