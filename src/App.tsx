import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Hero } from './components/Hero';
import { Services } from './components/Services';
import { DiagnosticTool } from './components/DiagnosticTool';
import { RakeTrailCalculator } from './components/RakeTrailCalculator';
import { WhyChooseUs } from './components/WhyChooseUs';
import { OurWorkGallery } from './components/OurWorkGallery';
import { AboutPaul } from './components/AboutPaul';
import { Testimonials } from './components/Testimonials';
import { FaqSection } from './components/FaqSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { BookingModal } from './components/BookingModal';
import { ShopAdminPortal } from './components/ShopAdminPortal';
import { TicketTrackerModal } from './components/TicketTrackerModal';

export default function App() {
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [bookingServiceId, setBookingServiceId] = useState<string>('powertrain-alignment');
  const [isShopAdminOpen, setIsShopAdminOpen] = useState<boolean>(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState<boolean>(false);

  const handleOpenBookingWithService = (serviceId?: string) => {
    if (serviceId) {
      setBookingServiceId(serviceId);
    }
    setIsBookingOpen(true);
  };

  const handleNavigate = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500 selection:text-neutral-950 pb-16 md:pb-0">
      {/* Navigation Bar */}
      <Navbar
        onOpenBooking={() => handleOpenBookingWithService()}
        onNavigate={handleNavigate}
        onOpenAdmin={() => setIsShopAdminOpen(true)}
        onOpenTracker={() => setIsTrackerOpen(true)}
      />

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileBottomNav
        onOpenBooking={() => handleOpenBookingWithService()}
        onNavigate={handleNavigate}
        onOpenTracker={() => setIsTrackerOpen(true)}
      />

      {/* Hero Banner Section */}
      <Hero
        onOpenBooking={() => handleOpenBookingWithService()}
        onNavigate={handleNavigate}
      />

      {/* Services Section */}
      <Services
        onSelectServiceForBooking={(svcId) => handleOpenBookingWithService(svcId)}
      />

      {/* Why Choose Us & Core Values */}
      <WhyChooseUs
        onOpenBooking={() => handleOpenBookingWithService()}
      />

      {/* Interactive Diagnostic Tool with Gemini AI Assistant */}
      <DiagnosticTool
        onOpenBookingWithService={(svcId) => handleOpenBookingWithService(svcId)}
      />

      {/* Interactive Rake & Trail Geometry Calculator */}
      <RakeTrailCalculator />

      {/* Our Work Portfolio & Before/After Specs */}
      <OurWorkGallery
        onOpenBooking={() => handleOpenBookingWithService()}
      />

      {/* About Paul Hurey */}
      <AboutPaul
        onOpenBooking={() => handleOpenBookingWithService()}
      />

      {/* Testimonials */}
      <Testimonials />

      {/* Frequently Asked Questions */}
      <FaqSection
        onOpenBooking={() => handleOpenBookingWithService()}
      />

      {/* Contact & Location Section */}
      <ContactSection />

      {/* Footer */}
      <Footer
        onOpenBooking={() => handleOpenBookingWithService()}
        onNavigate={handleNavigate}
        onOpenAdmin={() => setIsShopAdminOpen(true)}
        onOpenTracker={() => setIsTrackerOpen(true)}
      />

      {/* Interactive Appointment Booking Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        preSelectedServiceId={bookingServiceId}
      />

      {/* Shop Management & Appointment Command Center for Paul */}
      <ShopAdminPortal
        isOpen={isShopAdminOpen}
        onClose={() => setIsShopAdminOpen(false)}
      />

      {/* Customer Ticket & Work Order Tracker Modal */}
      <TicketTrackerModal
        isOpen={isTrackerOpen}
        onClose={() => setIsTrackerOpen(false)}
      />
    </div>
  );
}
