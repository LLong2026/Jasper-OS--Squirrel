import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export default function ManifestoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="relative py-32 px-6 bg-black overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)]" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1 }}
        >
          <p className="text-2xl md:text-4xl font-light text-slate-300 leading-relaxed">
            "In the Old Era, <span className="text-slate-500">'Knowledge was Power.'</span>
          </p>
          <p className="text-2xl md:text-4xl font-light text-slate-300 leading-relaxed mt-4">
            In the Leon Era, <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent font-medium">'Math is Law.'</span>"
          </p>
          <p className="mt-8 text-sm tracking-widest text-slate-500 uppercase">— Leon Calvin Long II, Architect</p>
        </motion.div>
      </div>
    </section>
  );
}