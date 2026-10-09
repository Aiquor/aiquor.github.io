import envelopeIcon from '../assets/icons/phosphor/envelope-simple.svg';
import robotIcon from '../assets/icons/phosphor/robot.svg';
import slackIcon from '../assets/icons/phosphor/slack-logo.svg';
import sendIcon from '../assets/icons/phosphor/paper-plane-right.svg';

const DURATION = 15;
const stages = [
  {
    start: 0, label: '01 / CUSTOMER INBOX', title: '“Where is my order?”',
    content: `<div class="message"><div class="message-header"><span class="avatar">JL</span><div><strong>Jamie Lee</strong><small>Customer · sample message</small></div><span class="tag">New request</span></div><p class="subject">An update on order MS-1042</p><p>Hi, my order was due yesterday. Where is MS-1042? Thanks, Jamie.</p></div><div class="review-note"><img src="${envelopeIcon}" alt="" width="16" height="16">Classified as an order-status request.</div>`,
    captions: [[0, 'A customer asks: where is my order?']],
  },
  {
    start: 3, label: '02 / AI DRAFT', title: 'A useful draft, grounded in context.',
    content: `<div class="context"><span>Order MS-1042 · in transit</span><span>Carrier estimate · Friday</span><span>Sample carrier data</span></div><div class="message draft"><div class="message-header"><span class="avatar"><img src="${robotIcon}" alt="" width="21" height="21"></span><div><strong>Aiquor support agent</strong><small>Draft · not sent</small></div><span class="tag">Needs approval</span></div><p>Hi Jamie, sorry for the delay. MS-1042 is in transit. The carrier estimates Friday delivery. If it hasn’t arrived then, reply here and we’ll follow up.</p></div>`,
    captions: [[3, 'AI checks the order and drafts a helpful reply.']],
  },
  {
    start: 7, label: '03 / HUMAN REVIEW', title: 'Your team has the final say.',
    content: `<div class="message draft"><div class="message-header"><span class="avatar"><img src="${slackIcon}" alt="" width="20" height="20"></span><div><strong>#support-approvals</strong><small>Illustrative Slack review</small></div><span class="tag" id="approval-status">Awaiting review</span></div><p class="subject">Review reply for Jamie · MS-1042</p><p>Hi Jamie, sorry for the delay. MS-1042 is in transit. The carrier estimates Friday delivery. If it hasn’t arrived then, reply here and we’ll follow up.</p></div><div class="receipt"><span class="avatar">MC</span><span id="reviewer-note">Maya Chen checks the facts and tone.</span><span class="approval-stamp" id="approval-stamp" hidden>Approved · demo</span></div>`,
    captions: [[7, 'Your team reviews before anything is sent.'], [9, 'Maya approves the reply · simulated approval.']],
  },
  {
    start: 11, label: '04 / APPROVED REPLY', title: 'A clear answer. A recorded approval.',
    content: `<div class="message"><div class="message-header"><span class="avatar">MS</span><div><strong>Meadow Supply support</strong><small>To Jamie Lee · simulated reply</small></div><span class="tag">Sent · demo</span></div><p>Hi Jamie, sorry for the delay. MS-1042 is in transit. The carrier estimates Friday delivery. If it hasn’t arrived then, reply here and we’ll follow up.</p></div><div class="receipt"><img src="${sendIcon}" alt="" width="16" height="16">Drafted by AI. Approved by Maya. Shown as sent in this demo.</div>`,
    captions: [[11, 'Reply delivered · demo. AI drafts. Your team decides.']],
  },
];

const play = document.querySelector('#play');
const replay = document.querySelector('#replay');
const slider = document.querySelector('#timeline');
const chapters = [...document.querySelectorAll('[data-chapter]')];
const content = document.querySelector('#scene-content');
const caption = document.querySelector('#caption');
let elapsed = 0;
let playing = false;
let frame = 0;
let lastTime = 0;
let currentStage = -1;
let currentCaption = '';

function render() {
  const index = stages.findLastIndex(stage => elapsed >= stage.start);
  const stage = stages[index];
  if (index !== currentStage) {
    currentStage = index;
    document.querySelector('#scene-label').textContent = stage.label;
    content.innerHTML = `<h2>${stage.title}</h2>${stage.content}`;
    content.classList.remove('scene-enter');
    // Restart the entrance only when a chapter changes, never on each frame.
    void content.offsetWidth;
    content.classList.add('scene-enter');
    chapters.forEach((button, chapter) => {
      if (chapter === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.dataset.complete = String(chapter < index);
    });
  }
  if (index === 2) {
    const approved = elapsed >= 9;
    document.querySelector('#approval-status').textContent = approved ? 'Approved · demo' : 'Awaiting review';
    document.querySelector('#approval-stamp').hidden = !approved;
    document.querySelector('#reviewer-note').textContent = approved ? 'Maya Chen approved this sample reply.' : 'Maya Chen checks the facts and tone.';
  }
  const text = elapsed >= DURATION ? 'Demo complete. AI drafts. Your team decides. Discuss your support workflow with Aiquor.' : stage.captions.findLast(([start]) => elapsed >= start)[1];
  if (text !== currentCaption) { caption.textContent = text; currentCaption = text; }
  const seconds = Math.floor(elapsed);
  document.querySelector('#time').textContent = `00:${String(seconds).padStart(2, '0')} / 00:15`;
  slider.value = String(elapsed);
  slider.setAttribute('aria-valuetext', `${seconds} seconds of ${DURATION}`);
  document.querySelector('#play-label').textContent = playing ? 'Pause' : elapsed >= DURATION ? 'Replay demo' : elapsed > 0 ? 'Resume' : 'Play demo';
  play.setAttribute('aria-label', playing ? 'Pause demo' : elapsed >= DURATION ? 'Replay 15-second demo' : elapsed > 0 ? 'Resume demo' : 'Play 15-second demo');
  document.querySelector('#run-status').textContent = elapsed >= DURATION ? 'Demo complete' : playing ? 'Playing · sample data' : elapsed > 0 ? 'Paused' : 'Ready to play';
}

function tick(now) {
  if (!playing) return;
  if (lastTime) elapsed = Math.min(DURATION, elapsed + (now - lastTime) / 1000);
  lastTime = now;
  if (elapsed >= DURATION) { playing = false; lastTime = 0; }
  render();
  if (playing) frame = requestAnimationFrame(tick);
}

function pause() {
  playing = false;
  cancelAnimationFrame(frame);
  lastTime = 0;
  render();
}
function start() {
  if (elapsed >= DURATION) elapsed = 0;
  playing = true;
  lastTime = 0;
  render();
  frame = requestAnimationFrame(tick);
}
play.addEventListener('click', () => playing ? pause() : start());
replay.addEventListener('click', () => { pause(); elapsed = 0; start(); });
slider.addEventListener('input', () => { const value = Number(slider.value); pause(); elapsed = value; render(); });
chapters.forEach((button, index) => button.addEventListener('click', () => { pause(); elapsed = stages[index].start; render(); }));
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
render();
