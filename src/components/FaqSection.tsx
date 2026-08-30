import React, { useState } from 'react';
import { FAQS, SHOP_INFO } from '../data/shopData';
import { HelpCircle, ChevronDown, ChevronUp, Phone, Wrench } from 'lucide-react';

export const FaqSection: React.FC<{ onOpenBooking: () => void }> = ({ onOpenBooking }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faqs" className="py-24 bg-zinc-50 border-t border-zinc-200 font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center space-y-3 mb-12">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center justify-center gap-2">
            <HelpCircle className="w-4 h-4 text-orange-600" />
            <span>Got Questions? We Have Answers.</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-zinc-900 uppercase italic tracking-tighter">
            FREQUENTLY ASKED <span className="text-orange-600">QUESTIONS</span>
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base font-normal max-w-2xl mx-auto">
            Everything you need to know about motorcycle frame alignment, high-speed wobble diagnostics, and shop policies at The Frame Shop.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white border border-zinc-200 rounded-none overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/60 transition-colors"
                >
                  <span className="font-black text-zinc-900 text-base sm:text-lg uppercase tracking-tight italic">
                    {faq.q}
                  </span>
                  <div className="bg-zinc-50 border border-zinc-200 p-2 text-orange-500 flex-shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-6 sm:px-6 sm:pb-6 text-zinc-700 text-sm sm:text-base leading-relaxed border-t border-zinc-200 pt-4 font-normal">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA Footer inside FAQ */}
        <div className="mt-12 p-6 bg-white border border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-zinc-900 font-black text-base uppercase italic">
              Have a specific question about your bike's chassis?
            </div>
            <div className="text-xs text-zinc-600 font-bold uppercase tracking-wider mt-0.5">
              Call Paul directly or schedule a lift appointment today.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`tel:${SHOP_INFO.phoneRaw}`}
              className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 font-black px-5 py-3 text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-orange-600" />
              <span>Call ({SHOP_INFO.phone})</span>
            </a>

            <button
              onClick={onOpenBooking}
              className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-3 text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Schedule Inspection</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
