import React from 'react';
import HeroSection from '@/components/landing/HeroSection';
import ManifestoSection from '@/components/landing/ManifestoSection';
import CapabilitiesSection from '@/components/landing/CapabilitiesSection';
import FinalCTA from '@/components/landing/FinalCTA';

export default function Landing() {
  return (
    <div className="bg-black">
      <HeroSection />
      <ManifestoSection />
      <CapabilitiesSection />
      <FinalCTA />
    </div>
  );
}