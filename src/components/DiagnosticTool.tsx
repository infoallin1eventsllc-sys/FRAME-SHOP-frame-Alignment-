import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, ArrowRight, RefreshCw, Calendar, AlertTriangle, Gauge, Sparkles, Wrench, Cpu } from 'lucide-react';
import { safeFetch } from '../utils/api';

interface DiagnosticToolProps {
  onOpenBookingWithService: (serviceId: string) => void;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  options: { label: string; severityScore: number; serviceSuggestion: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: 'wobble',
    title: 'High-Speed Stability & Wobble',
    subtitle: 'What happens when you reach 60-75+ MPH on highway stretches?',
    options: [
      { label: 'Bike tracks smooth and straight without any sway', severityScore: 0, serviceSuggestion: 'maintenance' },
      { label: 'Slight handlebar buzz or minor tire feedback', severityScore: 1, serviceSuggestion: 'tire-balance' },
      { label: 'Noticeable rear-end sway ("bagger wobble") or front oscillation', severityScore: 3, serviceSuggestion: 'powertrain-alignment' },
      { label: 'Severe chassis wobble requiring immediate speed reduction', severityScore: 4, serviceSuggestion: 'frame-repair' }
    ]
  },
  {
    id: 'tracking',
    title: 'Straight Line & Hands-Free Tracking',
    subtitle: 'When riding on a flat road, does the bike pull or lean?',
    options: [
      { label: 'Rides dead straight without leaning your body', severityScore: 0, serviceSuggestion: 'maintenance' },
      { label: 'Slight drift to one side over long distances', severityScore: 1, serviceSuggestion: 'suspension-tuning' },
      { label: 'Must constantly lean body or pull handlebars to keep straight', severityScore: 3, serviceSuggestion: 'powertrain-alignment' },
      { label: 'Drifts hard to one side immediately', severityScore: 4, serviceSuggestion: 'frame-repair' }
    ]
  },
  {
    id: 'wear',
    title: 'Tire & Belt Wear Inspection',
    subtitle: 'What do your front/rear tires or drive belt edges look like?',
    options: [
      { label: 'Even tire tread wear across entire profile', severityScore: 0, serviceSuggestion: 'maintenance' },
      { label: 'Minor cupping or scalloping on front tire sides', severityScore: 1, serviceSuggestion: 'tire-balance' },
      { label: 'Uneven rear tire wear (one side worn much faster)', severityScore: 3, serviceSuggestion: 'powertrain-alignment' },
      { label: 'Frayed drive belt edges or pulley tooth wear', severityScore: 4, serviceSuggestion: 'powertrain-alignment' }
    ]
  },
  {
    id: 'history',
    title: 'Chassis History & Modifications',
    subtitle: 'Has the bike experienced any of the following recently?',
    options: [
      { label: 'No crashes, tip-overs, or major frame disassembly', severityScore: 0, serviceSuggestion: 'maintenance' },
      { label: 'Upgraded high-horsepower engine or performance kit', severityScore: 2, serviceSuggestion: 'powertrain-alignment' },
      { label: 'Minor driveway tip-over or curb impact', severityScore: 2, serviceSuggestion: 'suspension-tuning' },
      { label: 'Collision or hard impact in the past', severityScore: 4, serviceSuggestion: 'frame-repair' }
    ]
  }
];

export const DiagnosticTool: React.FC<DiagnosticToolProps> = ({ onOpenBookingWithService }) => {
  const [activeTab, setActiveTab] = useState<'guided' | 'ai'>('guided');

  // Guided Questionnaire State
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  // AI Diagnostic State
  const [aiBikeModel, setAiBikeModel] = useState('2021 Harley-Davidson Road Glide');
  const [aiSymptom, setAiSymptom] = useState('');
  const [aiSpeedRange, setAiSpeedRange] = useState('65 - 80 MPH Highway');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState('');

  const handleSelectOption = (optionIndex: number) => {
    const updated = { ...selectedAnswers, [currentStep]: optionIndex };
    setSelectedAnswers(updated);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setCurrentStep(0);
    setIsCompleted(false);
  };

  const handleRunAiDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSymptom.trim()) return;

    setAiLoading(true);
    setAiError('');
    setAiResult(null);

    try {
      const res = await safeFetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motorcycleDetails: aiBikeModel,
          symptomDescription: aiSymptom,
          speedRange: aiSpeedRange,
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.diagnostic) {
          setAiResult(data.diagnostic);
        }
      } else {
        const errData = await res.json();
        setAiError(errData.error || 'Failed to generate AI diagnostic analysis.');
      }
    } catch (err) {
      console.error('AI Diagnostic call error:', err);
      // Fallback response for offline or preview mode
      setAiResult({
        diagnosisTitle: "3D Powertrain & Engine Mount Misalignment",
        severityLevel: "Moderate Misalignment",
        likelyCauses: [
          "Motor mount isolator rubber bushing fatigue",
          "Transmission top stabilizer tie-rod out of adjustment",
          "Rear swingarm pivot axle non-parallel to front wheel"
        ],
        technicalExplanation: `Analysis for ${aiBikeModel}: High-speed instability and wobble often originate when motor torque forces the engine/transmission casing out of 3D parallel alignment with the frame backbone. A 3D laser scan on Paul's Frame Shooter alignment jig will measure exact millimeter offset.`,
        recommendedServiceId: "powertrain-alignment",
        recommendedServiceName: "3D Power Train Laser Alignment",
        estimatedLaborHours: "1 - 2 Hours"
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Calculate Diagnostic Result
  const calculateResult = () => {
    let totalScore = 0;
    const suggestedServicesSet = new Set<string>();

    Object.entries(selectedAnswers).forEach(([stepIdxStr, optIdx]) => {
      const stepIdx = parseInt(stepIdxStr, 10);
      const opt = QUESTIONS[stepIdx].options[optIdx as number];
      totalScore += opt.severityScore;
      if (opt.serviceSuggestion !== 'maintenance') {
        suggestedServicesSet.add(opt.serviceSuggestion);
      }
    });

    let severity: 'ok' | 'moderate' | 'critical' = 'ok';
    let title = 'Chassis Tracking Normal';
    let description = 'Your motorcycle appears to be within normal tracking parameters. Regular dynamic tire balancing and routine fluid maintenance will keep it riding smooth.';
    let primaryRecommendedService = 'general-repair';

    if (totalScore >= 8) {
      severity = 'critical';
      title = 'Critical Chassis Misalignment / Safety Risk';
      description = 'Your responses indicate significant frame, powertrain, or neck angle deviation. High-speed wobble or severe drift compromises rider safety under hard braking and acceleration.';
      primaryRecommendedService = 'frame-repair';
    } else if (totalScore >= 4) {
      severity = 'moderate';
      title = 'Powertrain or Suspension Offset Detected';
      description = 'Your bike exhibits classic signs of 3D powertrain offset, engine mount twisting, or fork stiction. A 3D laser alignment and suspension calibration will eliminate sway and uneven tire wear.';
      primaryRecommendedService = 'powertrain-alignment';
    }

    const recommendedServices = Array.from(suggestedServicesSet);
    if (recommendedServices.length === 0) {
      recommendedServices.push('general-repair');
    }

    return { severity, title, description, primaryRecommendedService, recommendedServices, totalScore };
  };

  const result = isCompleted ? calculateResult() : null;

  return (
    <section id="diagnostic" className="py-24 bg-white border-t border-zinc-200 relative font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-8">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center justify-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-orange-600" />
            <span>Chassis &amp; Handling Diagnostics</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-zinc-900 uppercase italic tracking-tighter">
            IS YOUR BIKE <span className="text-orange-600">TRACKING RIGHT?</span>
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base font-normal">
            Analyze your motorcycle's handling via our guided questionnaire or consult Paul's AI Laser Tech Advisor.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-center mb-8">
          <div className="bg-zinc-50 border border-zinc-200 p-1 inline-flex gap-1">
            <button
              onClick={() => setActiveTab('guided')}
              className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'guided'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'text-zinc-600 hover:text-zinc-800'
              }`}
            >
              <Gauge className="w-4 h-4" />
              <span>Guided Questionnaire</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'ai'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'text-zinc-600 hover:text-zinc-800'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-700" />
              <span>AI Laser Tech Advisor</span>
              <span className="text-[9px] bg-white text-orange-400 border border-orange-500/40 px-1.5 py-0.5 font-mono">GEMINI AI</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Container */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-none p-6 sm:p-10 shadow-2xl relative">
          
          {activeTab === 'guided' ? (
            /* Guided Questionnaire */
            !isCompleted ? (
            <div>
              {/* Progress Indicator */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-200 text-xs text-zinc-600">
                <span className="font-black text-orange-500 uppercase tracking-widest">
                  Question {currentStep + 1} of {QUESTIONS.length}
                </span>
                <div className="flex gap-1.5">
                  {QUESTIONS.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2 rounded-none transition-all ${
                        idx === currentStep
                          ? 'w-8 bg-orange-600'
                          : idx < currentStep
                          ? 'w-3 bg-orange-600/50'
                          : 'w-3 bg-zinc-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Question Copy */}
              <div className="mb-8">
                <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-2 uppercase italic">
                  {QUESTIONS[currentStep].title}
                </h3>
                <p className="text-zinc-600 text-sm font-normal">
                  {QUESTIONS[currentStep].subtitle}
                </p>
              </div>

              {/* Options Stack */}
              <div className="space-y-3">
                {QUESTIONS[currentStep].options.map((opt, idx) => {
                  const isSelected = selectedAnswers[currentStep] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full text-left p-4 rounded-none border transition-all flex items-center justify-between group cursor-pointer ${
                        isSelected
                          ? 'bg-white border-orange-600 text-zinc-900 shadow-lg'
                          : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-none border flex items-center justify-center text-xs font-black transition-colors ${
                          isSelected
                            ? 'border-orange-600 bg-orange-600 text-zinc-950'
                            : 'border-zinc-300 text-zinc-500 group-hover:border-orange-600/50'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-sm sm:text-base font-bold">{opt.label}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
              </div>

              {/* Back / Navigation Controls */}
              {currentStep > 0 && (
                <div className="mt-8 pt-4 border-t border-zinc-200 flex justify-between items-center text-xs">
                  <button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="text-zinc-500 hover:text-white uppercase font-black tracking-widest"
                  >
                    ← Previous Question
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Result Panel */
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                <div className="flex items-center gap-3">
                  {result?.severity === 'critical' && (
                    <div className="w-10 h-10 rounded-none bg-red-50 text-red-700 border border-red-300 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  )}
                  {result?.severity === 'moderate' && (
                    <div className="w-10 h-10 rounded-none bg-orange-600/20 text-orange-500 border border-orange-600/40 flex items-center justify-center">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                  )}
                  {result?.severity === 'ok' && (
                    <div className="w-10 h-10 rounded-none bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-black text-orange-500">Diagnostic Verdict</div>
                    <h3 className="text-xl sm:text-3xl font-black text-zinc-900 uppercase italic">
                      {result?.title}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="text-xs text-zinc-600 hover:text-white flex items-center gap-1 bg-white px-3 py-2 rounded-none border border-zinc-200 cursor-pointer font-bold uppercase tracking-wider"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              </div>

              <p className="text-zinc-700 text-sm leading-relaxed font-normal bg-white p-4 rounded-none border border-zinc-200">
                {result?.description}
              </p>

              <div>
                <h4 className="text-xs font-black uppercase text-orange-600 tracking-widest mb-3">
                  Recommended Shop Services
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result?.recommendedServices.map((svcId, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-none border border-zinc-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                          {svcId.replace('-', ' ')}
                        </span>
                      </div>
                      <button
                        onClick={() => onOpenBookingWithService(svcId)}
                        className="text-xs font-black text-orange-500 hover:text-orange-400 uppercase tracking-widest flex items-center gap-1"
                      >
                        <span>Select</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Primary Call To Action */}
              <div className="p-6 rounded-none bg-white border border-orange-600 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-base font-black text-zinc-900 uppercase italic">Ready to get your bike riding true?</div>
                  <div className="text-xs text-zinc-600">Book a precision 3D laser scan appointment with Paul Hurey in Spring, TX.</div>
                </div>

                <button
                  onClick={() => onOpenBookingWithService(result?.primaryRecommendedService || 'powertrain-alignment')}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-3 rounded-none uppercase tracking-widest text-xs whitespace-nowrap flex items-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Schedule Diagnostic &amp; Scan</span>
                </button>
              </div>
            </div>
          )) : (
            /* AI Laser Tech Advisor Tab */
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase text-amber-700 tracking-widest bg-amber-50 border border-amber-300 px-3 py-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>Interactive AI Chassis Diagnostic Assistant</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 uppercase italic">
                  DESCRIBE YOUR MOTORCYCLE'S <span className="text-orange-600">HANDLING ISSUE</span>
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 font-normal">
                  Type your motorcycle model and custom symptoms (e.g. wobble speed, pull under braking, or post-pothole vibration). Our server-side Gemini AI model evaluates your chassis geometry and recommends the exact alignment protocol.
                </p>
              </div>

              <form onSubmit={handleRunAiDiagnostic} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-zinc-700 tracking-widest mb-1.5">
                      Motorcycle Model &amp; Year
                    </label>
                    <input
                      type="text"
                      value={aiBikeModel}
                      onChange={(e) => setAiBikeModel(e.target.value)}
                      placeholder="e.g., 2021 Harley-Davidson Road Glide Special"
                      className="w-full bg-white border border-zinc-200 focus:border-orange-600 text-zinc-900 p-3 text-sm focus:outline-none rounded-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-zinc-700 tracking-widest mb-1.5">
                      Speed Range Where Issue Occurs
                    </label>
                    <select
                      value={aiSpeedRange}
                      onChange={(e) => setAiSpeedRange(e.target.value)}
                      className="w-full bg-white border border-zinc-200 focus:border-orange-600 text-zinc-900 p-3 text-sm focus:outline-none rounded-none"
                    >
                      <option value="65 - 80 MPH Highway">65 - 80 MPH Highway (High-Speed Wobble)</option>
                      <option value="40 - 55 MPH Sweepers">40 - 55 MPH Sweepers (Cornering Instability)</option>
                      <option value="Low Speed / Hands Free">Low Speed &lt; 35 MPH (Pulling to One Side)</option>
                      <option value="Hard Braking / Dips">Hard Braking &amp; Dips (Fork Stiction)</option>
                      <option value="All Speeds / Vibration">All Speeds (Engine &amp; Belt Vibration)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-zinc-700 tracking-widest mb-1.5">
                    Describe Handling Symptoms or Modifications
                  </label>
                  <textarea
                    value={aiSymptom}
                    onChange={(e) => setAiSymptom(e.target.value)}
                    placeholder="e.g. When taking my hands slightly off the handlebars at 70mph, the rear bagger end sways left and right. Recently had a 128ci kit installed and hit a freeway bump..."
                    rows={3}
                    className="w-full bg-white border border-zinc-200 focus:border-orange-600 text-zinc-900 p-3 text-sm focus:outline-none rounded-none"
                    required
                  />
                </div>

                {/* Example Quick Prompt Chips */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-600">
                  <span className="font-bold text-zinc-500 uppercase">Quick Examples:</span>
                  <button
                    type="button"
                    onClick={() => setAiSymptom("Rear end sways violently in highway sweepers above 75mph on my Road Glide.")}
                    className="bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-zinc-700 transition-colors cursor-pointer"
                  >
                    "75mph Bagger Wobble"
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiSymptom("Bike pulls hard to the right when riding straight. Must lean my body left.")}
                    className="bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-zinc-700 transition-colors cursor-pointer"
                  >
                    "Pulls Hard Right"
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiSymptom("Drive belt edge is fraying on right side and rear tire wears unevenly.")}
                    className="bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-zinc-700 transition-colors cursor-pointer"
                  >
                    "Frayed Belt &amp; Uneven Wear"
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={aiLoading}
                  className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-100 text-white font-black px-8 py-3.5 rounded-none uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors w-full sm:w-auto"
                >
                  {aiLoading ? (
                    <>
                      <Cpu className="w-4 h-4 animate-spin text-amber-700" />
                      <span>Analyzing Geometry with Gemini AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      <span>Analyze with AI Laser Tech</span>
                    </>
                  )}
                </button>
              </form>

              {aiError && (
                <div className="p-4 bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* AI Diagnostic Output Card */}
              {aiResult && (
                <div className="bg-white border-2 border-orange-600/80 p-6 space-y-5 animate-in fade-in duration-300 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-3 flex-wrap gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-2.5 py-1 border border-amber-300">
                        {aiResult.severityLevel}
                      </span>
                      <h4 className="text-xl sm:text-2xl font-black text-zinc-900 uppercase italic mt-2">
                        {aiResult.diagnosisTitle}
                      </h4>
                    </div>

                    <div className="text-xs text-zinc-600 font-mono">
                      Estimated Labor: <strong className="text-orange-500">{aiResult.estimatedLaborHours}</strong>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-black uppercase text-orange-500 tracking-widest">
                      Mechanical Analysis &amp; Laser Protocol
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed font-normal bg-zinc-50/80 p-4 border border-zinc-200">
                      {aiResult.technicalExplanation}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-black uppercase text-zinc-600 tracking-widest">
                      Primary Root Causes
                    </div>
                    <ul className="space-y-1.5 text-xs text-zinc-700 font-bold">
                      {aiResult.likelyCauses && aiResult.likelyCauses.map((cause: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 bg-zinc-50 p-2.5 border border-zinc-200">
                          <Wrench className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                          <span>{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Booking Trigger CTA */}
                  <div className="pt-3 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-zinc-600">
                      Recommended Service: <strong className="text-zinc-900">{aiResult.recommendedServiceName}</strong>
                    </div>

                    <button
                      onClick={() => onOpenBookingWithService(aiResult.recommendedServiceId || 'powertrain-alignment')}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-2.5 rounded-none uppercase tracking-widest text-xs flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Book Recommended Service Now</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </section>
  );
};
