import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';

export default function LegalFooter() {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className="border-t border-slate-800 bg-slate-950/60 shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-4 py-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span className="flex items-center gap-1.5 truncate">
          <Shield className="h-3 w-3 shrink-0 text-slate-600" />
          <span className="truncate">
            © 2026 Leon Calvin Long II · CC BY-NC-ND 4.0 (content) · Apache 2.0 (code)
          </span>
        </span>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-1.5 text-[10px] leading-relaxed text-slate-500 max-h-48 overflow-y-auto">
          <p>
            <span className="text-slate-400 font-medium">Copyright © 2026 Leon Calvin Long II.</span> All rights reserved.
            Jasper, Aegis, Arete, URIB, Chronos Daemon, and the Jasper logo are trademarks of Leon Calvin Long II.
            All other trademarks, service marks, and trade names referenced herein are the property of their respective owners.
          </p>
          <p>
            <span className="text-slate-400 font-medium">Content License:</span> All creative content, documentation, designs, and non-code materials are licensed under
            Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0).
            You may share (copy and redistribute) this material in any medium or format for non-commercial purposes only,
            provided you give appropriate credit to Leon Calvin Long II, indicate if changes were made, and distribute under the same license.
            No derivatives — you may not adapt, transform, or build upon this material. Commercial use is strictly prohibited without explicit written permission.
          </p>
          <p>
            <span className="text-slate-400 font-medium">Code License:</span> All source code is licensed under the Apache License, Version 2.0.
            You may use, reproduce, and distribute the code subject to the terms of the Apache 2.0 license, including the requirement to retain
            the copyright notice, include a copy of the license, and state any significant changes made to the licensed files.
            See the full license text at https://www.apache.org/licenses/LICENSE-2.0.
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
      )}
    </footer>
  );
}