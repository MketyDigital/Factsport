'use client';

import { useState } from 'react';

type Props = {
  matchId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
};

export default function PublicPredictionSubmit({ matchId, matchDate, homeTeam, awayTeam }: Props) {
  const [outcome, setOutcome] = useState<'home' | 'draw' | 'away' | ''>('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [emailRequired, setEmailRequired] = useState(true);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptRules, setAcceptRules] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  const matchIsPastByDisplayClock = Date.now() >= new Date(matchDate).getTime();

  async function openSubmitForm() {
    setFormOpen(true);
    setMessage('');
    try {
      const response = await fetch('/api/prediction/submit', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (!response.ok || data.ready !== true) {
        setMessage('Free predictions are temporarily unavailable. Please try again later.');
        return;
      }
      setEmailRequired(data.emailRequired === true);
    } catch {
      setMessage('Could not prepare your secure prediction session. Please try again.');
    }
  }

  async function submitPrediction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!outcome || homeScore === '' || awayScore === '') {
      setMessage('Choose an outcome and enter both teams’ predicted scores.');
      return;
    }
    if (matchIsPastByDisplayClock) {
      setMessage('The displayed kickoff time has passed. The database will make the final decision.');
      return;
    }
    if (!acceptRules) {
      setMessage('Please accept the free prediction rules and privacy notice.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/prediction/submit', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          matchId,
          outcome,
          homeScore: Number(homeScore),
          awayScore: Number(awayScore),
          ...(emailRequired ? { email } : {}),
          displayName: displayName.trim() || undefined,
          acceptRules,
          marketingOptIn,
        }),
      });
      const data = await response.json();
      if (response.status === 428 && data.error === 'email_required_for_new_visitor') {
        setEmailRequired(true);
        setMessage('Please enter your email to complete this first prediction on this browser.');
        return;
      }
      if (!response.ok) {
        const messages: Record<string, string> = {
          prediction_closed: 'Predictions for this match have closed.',
          rate_limited: 'Too many attempts. Please wait a minute and try again.',
          prediction_submission_unavailable: 'Predictions are temporarily unavailable. Please try again later.',
        };
        setMessage(messages[data.error] || 'Your prediction could not be submitted. Please check the details and try again.');
        return;
      }
      setComplete(true);
      setMessage(data.marketingConsentStatus === 'pending_confirmation'
        ? 'Prediction saved. Your optional email updates request is pending email confirmation.'
        : 'Your prediction has been saved.');
    } catch {
      setMessage('A network error occurred. Please try again. Your browser session will be reused.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        Make one free prediction for this match. You can browse without an account or email prompt.
      </p>
      {complete ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          {message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Predicted match outcome">
            <button type="button" onClick={() => setOutcome('home')} aria-pressed={outcome === 'home'}
              className={`rounded-md border p-2 text-xs font-bold ${outcome === 'home' ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
              {homeTeam}
            </button>
            <button type="button" onClick={() => setOutcome('draw')} aria-pressed={outcome === 'draw'}
              className={`rounded-md border p-2 text-xs font-bold ${outcome === 'draw' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
              Draw
            </button>
            <button type="button" onClick={() => setOutcome('away')} aria-pressed={outcome === 'away'}
              className={`rounded-md border p-2 text-xs font-bold ${outcome === 'away' ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
              {awayTeam}
            </button>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <label className="text-center text-xs font-semibold text-slate-600">
              {homeTeam}
              <input type="number" min="0" max="99" inputMode="numeric" value={homeScore}
                onChange={event => setHomeScore(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-center text-lg font-bold text-slate-900"
                aria-label={`${homeTeam} predicted score`} />
            </label>
            <span className="pt-5 text-sm font-black text-slate-400">VS</span>
            <label className="text-center text-xs font-semibold text-slate-600">
              {awayTeam}
              <input type="number" min="0" max="99" inputMode="numeric" value={awayScore}
                onChange={event => setAwayScore(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-center text-lg font-bold text-slate-900"
                aria-label={`${awayTeam} predicted score`} />
            </label>
          </div>

          {!formOpen ? (
            <button type="button" onClick={openSubmitForm}
              className="w-full rounded-md bg-[#0a1428] px-4 py-3 text-sm font-bold text-white">
              Submit Prediction
            </button>
          ) : (
            <form onSubmit={submitPrediction} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-sm font-bold text-slate-900">Complete your free prediction</h4>
              {emailRequired && (
                <label className="block text-xs font-semibold text-slate-700">
                  Email address
                  <input type="email" required maxLength={254} autoComplete="email" value={email}
                    onChange={event => setEmail(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm" />
                </label>
              )}
              <label className="block text-xs font-semibold text-slate-700">
                Display name (optional)
                <input type="text" maxLength={40} value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm" />
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" required checked={acceptRules}
                  onChange={event => setAcceptRules(event.target.checked)} className="mt-0.5" />
                <span>I accept the <a href="/how-to-play" target="_blank" rel="noreferrer" className="underline">free prediction rules</a> and <a href="/privacy-policy" target="_blank" rel="noreferrer" className="underline">privacy notice</a>.</span>
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={marketingOptIn}
                  onChange={event => setMarketingOptIn(event.target.checked)} className="mt-0.5" />
                <span>Yes, email me Factsport product updates and offers. I understand I can unsubscribe at any time. This is optional and does not affect my prediction.</span>
              </label>
              <button type="submit" disabled={loading}
                className="w-full rounded-md bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                {loading ? 'Submitting…' : 'Confirm Prediction'}
              </button>
            </form>
          )}
        </>
      )}
      {message && <p className="text-xs text-slate-700" role="status">{message}</p>}
    </div>
  );
}
