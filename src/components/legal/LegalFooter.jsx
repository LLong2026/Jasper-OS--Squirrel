import React from 'react';
import { Shield } from 'lucide-react';

export default function LegalFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/60 px-4 py-3 shrink-0">
      <div className="max-w-7xl mx-auto space-y-1.5">
        <div className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
          <Shield className="h-3 w-3 shrink-0 mt-0.5 text-slate-600" />
          <div className="space-y-1">
            <p>
              <span className="text-slate-400 font-medium">Copyright © 2026 Jasper OS.</span> All rights reserved. 
              Jasper, Aegis, Arete, URIB, Chronos Daemon, and the Jasper logo are trademarks of Jasper OS. 
              All other trademarks, service marks, and trade names referenced herein are the property of their respective owners.
            </p>
            <p>
              <span className="text-slate-400 font-medium">Disclaimer:</span> This software is provided "as is" without warranty of any kind, express or implied, 
              including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. 
              In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, 
              whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.
            </p>
            <p>
              <span className="text-slate-400 font-medium">No Patent Pending:</span> No patent applications have been filed related to this software. 
              The software does not carry any patent-pending status. Users are advised that the software is provided without any patent protection claims.
            </p>
            <p>
              <span className="text-slate-400 font-medium">Cryptographic Systems:</span> Post-quantum cryptographic implementations (ML-DSA-65, ML-KEM-768) follow FIPS 204 / FIPS 203 draft specifications. 
              Compliance with final NIST standards is subject to ongoing standardization. Users handling regulated financial data should consult their compliance team.
            </p>
            <p className="text-slate-600">
              By using this software, you acknowledge that autonomous AI agents, self-healing infrastructure, and cross-rail settlement operations 
              operate without human intervention by design. The operators of this system assume full responsibility for all autonomous actions taken.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}