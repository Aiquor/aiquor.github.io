const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  navigation.classList.toggle('open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open navigation');
}));

const projects = [...document.querySelectorAll('.project')];
function activateProject(project) {
  projects.forEach(item => {
    const active = item === project;
    item.classList.toggle('active', active);
    item.querySelector('button').setAttribute('aria-expanded', String(active));
    item.querySelector('.project-body').inert = !active;
    item.querySelector('.project-plus').textContent = active ? '−' : '+';
  });
  if (window.ScrollTrigger) window.setTimeout(() => ScrollTrigger.refresh(), 700);
}
projects.forEach(project => {
  project.querySelector('button').addEventListener('click', () => activateProject(project));
  project.addEventListener('mouseenter', () => {
    if (window.matchMedia('(hover: hover) and (min-width: 761px)').matches) activateProject(project);
  });
  project.querySelector('button').addEventListener('focus', () => activateProject(project));
});

document.querySelectorAll('[data-interest]').forEach(link => link.addEventListener('click', () => {
  document.querySelector('#interest').value = link.dataset.interest;
}));
document.querySelector('#year').textContent = new Date().getFullYear();

const form = document.querySelector('#contact-form');
const status = document.querySelector('#form-status');
const submit = document.querySelector('#submit-btn');
form.addEventListener('submit', async event => {
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
    const response = await fetch('https://formsubmit.co/ajax/imeanhashir88@gmail.com', {
      method: 'POST', body: new FormData(form), signal: controller.signal, headers: { Accept: 'application/json' }
    });
    const data = await response.json();
    if (!response.ok || !(data.success === true || data.success === 'true')) throw new Error('Submission failed');
    status.textContent = 'Your message was submitted. We’ll get back to you within one business day.';
    form.reset();
  } catch (error) {
    status.classList.add('error');
    status.textContent = 'Your message could not be sent. Please try again or email imeanhashir88@gmail.com.';
  } finally {
    window.clearTimeout(timeout);
    submit.disabled = false;
    submit.innerHTML = 'Let’s make it happen <span aria-hidden="true">↗</span>';
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
      gsap.to(element, { opacity: .2, filter: 'brightness(.65)', ease: 'none', scrollTrigger: { trigger: element, start: 'bottom 20%', end: 'bottom top', scrub: 1 } });
    });
  });
  motion.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
    ScrollTrigger.create({ trigger: '.approach-grid', start: 'top 120px', end: () => `bottom ${120 + document.querySelector('.approach-title').offsetHeight}px`, pin: '.approach-title', pinSpacing: false });
    gsap.to('.orbital-light', { y: 80, opacity: .3, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
