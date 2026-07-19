import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown, Sparkles } from 'lucide-react';
import { createPageUrl } from '@/utils';

const HERO_VIDEO = 'https://media.base44.com/videos/public/6a5c6e75ac7251ec3cbb403e/1cd568a02_Jasper_Hero_Reel.mp4';
const HERO_POSTER = 'https://media.base44.com/images/public/6a5c6e75ac7251ec3cbb403e/5e34942d9_generated_image.png';

export default function HeroSection() {
  return (
    <section className="relative h-screen w-full overflow-hidden bg-black flex items-center justify-center">
      <video
        autoPlay
        muted
        loop
        playsInline
        poster={HERO_POSTER}
        className="absolute inset-0 h-full w-full object-cover opacity-60"
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,black_75%)]" />

      <div className="relative z-10 text-center px-6 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 backdrop-blur-sm mb-8"
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-medium tracking-widest text-blue-300 uppercase">Deterministic Orchestration Engine</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
          className="text-7xl md:text-9xl font-black tracking-tighter bg-gradient-to-b from-white via-blue-100 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(59,130,246,0.5)]"
        >
          JASPER
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="mt-6 text-lg md:text-2xl text-slate-300 font-light tracking-wide max-w-2xl mx-auto"
        >
          Cross-rail financial lifecycle management. Cryptographic proofing. Autonomous self-healing infrastructure. One manifold to govern them all.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.3 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to={createPageUrl('Chat')}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-10 py-4 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-lg shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:shadow-[0_0_50px_rgba(59,130,246,0.9)] transition-shadow"
            >
              Enter Jasper
            </motion.button>
          </Link>
          <Link to={createPageUrl('About')}>
            <button className="px-8 py-4 rounded-full border border-slate-600 text-slate-300 font-medium text-lg hover:border-blue-400 hover:text-white transition-colors backdrop-blur-sm">
              Learn the Architecture
            </button>
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ChevronDown className="h-6 w-6 text-slate-500" />
        </motion.div>
      </motion.div>
    </section>
  );
}