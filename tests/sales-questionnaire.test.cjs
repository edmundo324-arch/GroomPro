require('./load-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSalesAnswers, personalizedTour, questionError, emptySalesAnswers, goalChoices,
} = require('../src/lib/sales-questionnaire.ts');

const solo = {
  business: ['mobile'], team: 'solo', records: ['paper'], software: '',
  bookings: ['phone'], services: ['grooming'], goals: ['booking'],
};
const ids = (answers, mode = 'sales') => personalizedTour(answers, mode).map(topic => topic.id);

test('solo mobile and mixed-service teams receive relevant, distinct outlines', () => {
  const team = {...solo, business: ['salon', 'selfService'], team: 'small',
    services: ['grooming', 'selfService', 'retail', 'prepaid', 'vip']};
  assert.ok(!ids(solo).includes('team'));
  for (const id of ['team', 'packages', 'inventory', 'prepaid', 'vip']) assert.ok(ids(team).includes(id));
  assert.match(personalizedTour(solo, 'sales').find(topic => topic.id === 'messages').reason, /phone or message/);
  const mobile = personalizedTour({...solo, goals: ['notes']}, 'sales');
  assert.match(mobile.find(topic => topic.id === 'booking').reason, /mobile business/);
  assert.ok(!ids(solo).includes('routing'));
});

test('sales priorities follow the chosen order while training follows the grooming-day sequence', () => {
  const answers = {...solo, team: 'small', bookings: ['text', 'checkout'], goals: ['reports', 'checkout', 'notes']};
  assert.deepEqual(ids(answers).slice(0, 3), ['reports', 'checkout', 'notes']);
  assert.deepEqual(ids(answers, 'training'), ['booking', 'notes', 'packages', 'team', 'messages', 'checkout', 'returns', 'reports']);
});

test('editing answers removes obsolete lessons and preserves an explicitly selected priority', () => {
  const original = {...solo, team: 'large', services: ['retail', 'prepaid', 'vip'], goals: ['reports']};
  const edited = {...original, team: 'solo', services: ['wash'], bookings: ['online'], goals: ['inventory']};
  for (const id of ['team', 'prepaid', 'vip', 'reports', 'messages']) {
    assert.ok(ids(original).includes(id));
    assert.ok(!ids(edited).includes(id));
  }
  assert.ok(ids(edited).includes('inventory'));
});

test('corrupted saved answers normalize without unknown choices or duplicate selections', () => {
  for (const value of [null, undefined, 42, 'invalid']) assert.deepEqual(normalizeSalesAnswers(value), emptySalesAnswers);
  const restored = normalizeSalesAnswers({
    business: ['mobile', 'mobile', 'unknown', null], team: 'unrecognized',
    records: {software: true}, bookings: ['text', 12, 'text'],
    services: false, goals: ['notes', 'notes', 'unknown'], software: {name: 'App'},
  });
  assert.deepEqual(restored, {business: ['mobile'], team: '', records: [], software: '', bookings: ['text'], services: [], goals: ['notes']});
});

test('at most three unique priorities are retained and raw invalid submissions are rejected', () => {
  const goals = ['reports', 'reports', 'notes', 'team', 'booking'];
  assert.deepEqual(normalizeSalesAnswers({...solo, goals}).goals, ['reports', 'notes', 'team']);
  assert.ok(questionError({...solo, goals: []}, 3));
  assert.ok(questionError({...solo, goals: ['reports', 'notes', 'team', 'booking']}, 3));
  assert.equal(questionError({...solo, goals: ['reports', 'notes', 'team']}, 3), '');
});

test('software names remain bounded plain context and do not invent comparisons or imports', () => {
  const software = '  <script>Competitor exports everything</script>  ';
  const restored = normalizeSalesAnswers({...solo, software});
  assert.equal(restored.software, software.trim());
  assert.equal(normalizeSalesAnswers({...solo, software: 'x'.repeat(200)}).software.length, 100);
  assert.deepEqual(personalizedTour(restored, 'sales'), personalizedTour(solo, 'sales'));
  assert.deepEqual(personalizedTour(restored, 'training'), personalizedTour(solo, 'training'));
});

test('every goal has a usable topic and overlapping answers never duplicate lessons', () => {
  for (const [id] of goalChoices) {
    const tour = personalizedTour({...solo, goals: [id]}, 'sales');
    assert.equal(tour[0].id, id);
    assert.ok(tour[0].title && tour[0].sales && tour[0].reason && tour[0].training.length);
  }
  const overlap = {...solo, business: ['salon', 'mobile', 'selfService'], team: 'medium',
    services: ['grooming', 'wash', 'selfService', 'addons', 'retail', 'prepaid', 'vip'],
    bookings: ['phone', 'text', 'online', 'checkout'], goals: ['inventory', 'team', 'messages']};
  for (const mode of ['sales', 'training']) {
    const selected = ids(overlap, mode);
    assert.equal(selected.length, new Set(selected).size);
  }
  assert.deepEqual([...ids(overlap)].sort(), [...ids(overlap, 'training')].sort());
});

test('each question group requires enough information before continuing', () => {
  for (let step = 0; step < 4; step++) {
    assert.ok(questionError(emptySalesAnswers, step));
    assert.equal(questionError(solo, step), '');
  }
});
