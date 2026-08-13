import React, { useState, useEffect } from 'react';
import { TESTIMONIALS as INITIAL_TESTIMONIALS } from '../data/shopData';
import { Testimonial } from '../types';
import { Star, Quote, ShieldCheck, PlusCircle, X, CheckCircle2 } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const [reviews, setReviews] = useState<Testimonial[]>(INITIAL_TESTIMONIALS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New review state
  const [riderName, setRiderName] = useState('');
  const [bikeInfo, setBikeInfo] = useState('');
  const [location, setLocation] = useState('Spring, TX');
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');
  const [verifiedService, setVerifiedService] = useState('Power Train Alignment');
  const [submittedMsg, setSubmittedMsg] = useState('');

  // Load reviews from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('frameshop_user_reviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setReviews([...parsed, ...INITIAL_TESTIMONIALS]);
        }
      }
    } catch {
      // fallback
    }
  }, []);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderName.trim() || !quote.trim()) return;

    const newRev: Testimonial = {
      id: 'rev-' + Date.now(),
      riderName: riderName.trim(),
      bikeInfo: bikeInfo.trim() || 'Harley-Davidson',
      location: location.trim() || 'Texas Rider',
      rating,
      quote: quote.trim(),
      verifiedService: verifiedService.trim()
    };

    const updated = [newRev, ...reviews];
    setReviews(updated);

    try {
      const customOnly = updated.filter(r => r.id.startsWith('rev-') && Number(r.id.replace('rev-', '')) > 1000);
      localStorage.setItem('frameshop_user_reviews', JSON.stringify(customOnly));
    } catch {
      // quota error
    }

    setSubmittedMsg('Thank you! Your rider review has been added.');
    setTimeout(() => setSubmittedMsg(''), 4000);
    setIsModalOpen(false);

    // Reset fields
    setRiderName('');
    setBikeInfo('');
    setQuote('');
  };

  return (
    <section id="testimonials" className="py-24 bg-zinc-950 border-t border-zinc-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-orange-600 fill-orange-600" />
              <span>Verified Rider Feedback</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-zinc-100 uppercase italic tracking-tighter">
              WHAT <span className="text-orange-600">RIDERS SAY</span>
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base font-normal">
              Real feedback from motorcycle owners across Texas who brought their bikes to The Frame Shop for zero-tolerance alignment.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-zinc-900 hover:bg-orange-600 border border-zinc-800 hover:border-orange-500 text-zinc-100 hover:text-white font-black px-6 py-3.5 rounded-none text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all self-start md:self-auto"
          >
            <PlusCircle className="w-4 h-4 text-orange-500 hover:text-white" />
            <span>Leave a Rider Review</span>
          </button>
        </div>

        {submittedMsg && (
          <div className="mb-8 p-4 bg-emerald-950/40 border border-emerald-600 text-emerald-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{submittedMsg}</span>
          </div>
        )}

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-none flex flex-col justify-between shadow-xl relative group hover:border-orange-600 transition-colors"
            >
              <Quote className="absolute top-6 right-6 w-8 h-8 text-zinc-800 pointer-events-none group-hover:text-orange-950 transition-colors" />

              <div className="space-y-4">
                {/* Rating Stars */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: rev.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-orange-600 text-orange-600" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-xs sm:text-sm text-zinc-300 font-normal leading-relaxed italic">
                  "{rev.quote}"
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-800 mt-6">
                <div className="font-black text-zinc-100 text-base uppercase italic">{rev.riderName}</div>
                <div className="text-xs text-orange-500 font-bold uppercase tracking-wider">{rev.bikeInfo}</div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 font-bold uppercase tracking-wider">
                  <span>{rev.location}</span>
                  <span className="flex items-center gap-1 text-emerald-500">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    {rev.verifiedService}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* MODAL: Leave a Review */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border-2 border-zinc-800 w-full max-w-lg p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-orange-500 font-black text-xs uppercase tracking-widest">
                <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
                <span>Rider Feedback</span>
              </div>
              <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
                LEAVE A REVIEW
              </h3>
              <p className="text-xs text-zinc-400">
                Share your experience working with Paul Hurey at The Frame Shop.
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-zinc-300 mb-1">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= rating ? 'fill-orange-600 text-orange-600' : 'text-zinc-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-300 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mark S."
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-3 text-xs focus:border-orange-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">Bike Model &amp; Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2021 Road Glide"
                    value={bikeInfo}
                    onChange={(e) => setBikeInfo(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-3 text-xs focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Spring, TX"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-3 text-xs focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-300 mb-1">Service Performed</label>
                <input
                  type="text"
                  placeholder="e.g. Laser Alignment & Wobble Fix"
                  value={verifiedService}
                  onChange={(e) => setVerifiedService(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-3 text-xs focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-300 mb-1">Your Review *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the handling improvement, customer service, or precision work done..."
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-3 text-xs focus:border-orange-500 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider px-5 py-3 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-widest px-6 py-3 transition-colors cursor-pointer"
                >
                  Post Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  );
};
