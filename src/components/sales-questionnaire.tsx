"use client";
import {helpfulError} from '../lib/human-communication';
import {useEffect, useRef, useState} from 'react';
import {
  businessChoices, teamChoices, recordChoices, bookingChoices, serviceChoices, goalChoices,
  emptySalesAnswers, normalizeSalesAnswers, personalizedTour, questionError, questionnaireStorageKey,
  type SalesAnswers,
} from '../lib/sales-questionnaire';

const steps = ['Your Business', 'How You Work Today', 'Your Services', 'Your Priorities'];
type MultipleField = 'business' | 'records' | 'bookings' | 'services' | 'goals';

export function SalesQuestionnaire() {
  const [answers, setAnswers] = useState<SalesAnswers>({...emptySalesAnswers});
  const [step, setStep] = useState(0), [results, setResults] = useState(false);
  const [mode, setMode] = useState<'sales' | 'training'>('sales');
  const [loaded, setLoaded] = useState(false), [storageAvailable, setStorageAvailable] = useState(true);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null), errorMessage = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(questionnaireStorageKey) || 'null');
      if (saved?.version === 1) {
        const restored = normalizeSalesAnswers(saved.answers);
        setAnswers(restored);
        setStep(Number.isInteger(saved.step) && saved.step >= 0 && saved.step < steps.length ? saved.step : 0);
        setResults(saved.results === true && steps.every((_, index) => !questionError(restored, index)));
        setMode(saved.mode === 'training' ? 'training' : 'sales');
      }
    } catch { /* Invalid saved answers never prevent a fresh questionnaire. */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(questionnaireStorageKey, JSON.stringify({version: 1, answers, step, results, mode}));
      setStorageAvailable(true);
    } catch {setStorageAvailable(false);}
  }, [answers, step, results, mode, loaded]);

  function focusHeading() { requestAnimationFrame(() => heading.current?.focus()); }
  function toggle(field: MultipleField, id: string) {
    setError('');
    setAnswers(previous => {
      const values = previous[field];
      if (field === 'goals' && values.length >= 3 && !values.includes(id)) return previous;
      return {...previous, [field]: values.includes(id) ? values.filter(value => value !== id) : [...values, id]};
    });
  }
  function choices(field: MultipleField, options: readonly (readonly [string, string])[]) {
    return <div className="gp-tour-choices">{options.map(([id, label]) => <label key={id} className={answers[field].includes(id) ? 'is-selected' : ''}>
      <input type="checkbox" name={field} value={id} checked={answers[field].includes(id)}
        disabled={field === 'goals' && answers.goals.length >= 3 && !answers.goals.includes(id)}
        onChange={() => toggle(field, id)}/><span>{label}</span>
    </label>)}</div>;
  }
  function next() {
    const problem = questionError(answers, step);
    if (problem) {setError(problem); requestAnimationFrame(() => errorMessage.current?.focus()); return;}
    setError('');
    if (step < steps.length - 1) setStep(step + 1);
    else {
      const incomplete = steps.findIndex((_, index) => questionError(answers, index));
      if (incomplete >= 0) {setStep(incomplete); setError(questionError(answers, incomplete));}
      else {setAnswers(normalizeSalesAnswers(answers)); setResults(true);}
    }
    focusHeading();
  }
  function startOver() {
    setAnswers({...emptySalesAnswers}); setStep(0); setResults(false); setMode('sales'); setError(''); focusHeading();
  }
  const tour = personalizedTour(answers, mode);
  return <section id="your-groompro-tour" className="gp-tour" aria-labelledby="gp-tour-title">
    <p className="gp-tour-eyebrow">BUILT AROUND YOUR GROOMING DAY</p>
    <h2 id="gp-tour-title">Show Me How GroomPro Fits My Business</h2>
    <p>Tell us how you work and what you want to improve. We’ll organize a sales tour and training outline around your answers.</p>
    <p className="gp-tour-privacy">No customer details needed. {storageAvailable ? 'Answers stay in this browser tab and are not sent to GroomPro.' : 'This browser cannot save your answers. You can still continue, but refreshing will clear them.'}</p>
    {!loaded ? <p role="status">Opening Your Questionnaire…</p> : results ? <>
      <div className="gp-tour-results-heading">
        <h3 ref={heading} tabIndex={-1}>{mode === 'sales' ? 'Your Personalized Sales Tour' : 'Your Training Lessons'}</h3>
        <p>{mode === 'sales' ? 'Your priorities come first. Each topic explains why it was included.' : 'Follow the day from booking through checkout, then explore the other topics that fit your business.'}</p>
        {answers.software && <p>Your Current Software: <strong>{answers.software}</strong>. This outline follows the work you selected; it does not assume what your current software can do.</p>}
        <div className="gp-tour-video-note"><strong>Your Outline Is Ready</strong><p>The planned videos will show actual GroomPro screens with a friendly AI narrator. Videos have not been recorded yet. The topics below show what your tour and lessons will cover.</p></div>
      </div>
      <div className="gp-tour-actions" role="group" aria-label="Choose Your Guide">
        <button type="button" aria-pressed={mode === 'sales'} onClick={() => setMode('sales')}>Sales Tour</button>
        <button type="button" aria-pressed={mode === 'training'} onClick={() => setMode('training')}>Training Lessons</button>
        <button type="button" onClick={() => {setResults(false); setStep(0); setError(''); focusHeading();}}>Edit Answers</button>
        <button type="button" onClick={startOver}>Start Over</button>
      </div>
      <ol className="gp-tour-topics" aria-label={mode === 'sales' ? 'Sales Tour Topics' : 'Training Lesson Topics'}>
        {tour.map((topic, index) => <li key={topic.id} data-tour-topic={topic.id}>
          <span className="gp-tour-topic-number">{index + 1}</span><div><h4>{topic.title}</h4><p className="gp-tour-reason">{topic.reason}</p>
            {mode === 'sales' ? <p>{topic.sales}</p> : <ul>{topic.training.map(item => <li key={item}>{item}</li>)}</ul>}
          </div>
        </li>)}
      </ol>
      <p className="gp-tour-privacy">Feature availability depends on the selected plan and setup. This questionnaire does not change a subscription or enroll a business.</p>
    </> : <form noValidate onSubmit={event => {event.preventDefault(); next();}}>
      <ol className="gp-tour-progress" aria-label="Questionnaire Progress">{steps.map((name, index) => <li key={name} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{name}</li>)}</ol>
      <h3 ref={heading} tabIndex={-1}>Step {step + 1} of {steps.length}: {steps[step]}</h3>
      {step === 0 && <>
        <fieldset><legend>What Kind of Business Do You Run?</legend><p>Choose all that apply, including what you plan to offer.</p>{choices('business', businessChoices)}</fieldset>
        <fieldset><legend>How Many People Work in Your Business?</legend><div className="gp-tour-choices">{teamChoices.map(([id, label]) => <label key={id} className={answers.team === id ? 'is-selected' : ''}><input type="radio" name="team" value={id} checked={answers.team === id} onChange={() => {setAnswers({...answers, team: id}); setError('');}}/><span>{label}</span></label>)}</div></fieldset>
      </>}
      {step === 1 && <>
        <fieldset><legend>How Do You Keep Track of Work Today?</legend><p>Choose all that apply.</p>{choices('records', recordChoices)}
          <label className="gp-tour-software">Current Software Name <span>(Optional)</span><input name="software" autoComplete="off" maxLength={100} value={answers.software} onChange={event => setAnswers({...answers, software: event.target.value})} placeholder="Type the name you use"/></label>
        </fieldset>
        <fieldset><legend>How Do Customers Book?</legend><p>Choose all that apply, including methods you plan to use.</p>{choices('bookings', bookingChoices)}</fieldset>
      </>}
      {step === 2 && <fieldset><legend>Which Services Do You Offer?</legend><p>Choose all that apply, including services you plan to add.</p>{choices('services', serviceChoices)}</fieldset>}
      {step === 3 && <fieldset><legend>What Would You Most Like to Improve?</legend><p>Choose up to three. Select your biggest priority first.</p>{choices('goals', goalChoices)}<p role="status" className="gp-tour-selection-count">{answers.goals.length} of 3 Selected{answers.goals.length === 3 ? ' — uncheck a choice to select a different one.' : ''}</p></fieldset>}
      {error && <p ref={errorMessage} tabIndex={-1} role="alert" className="gp-tour-error">{helpfulError(error)}</p>}
      <div className="gp-tour-actions">
        {step > 0 && <button type="button" onClick={() => {setStep(step - 1); setError(''); focusHeading();}}>Back</button>}
        <button type="submit" className="gp-tour-primary">{step === steps.length - 1 ? 'Build My Tour & Lessons' : 'Next'}</button>
      </div>
    </form>}
  </section>;
}
