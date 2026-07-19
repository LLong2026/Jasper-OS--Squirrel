/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AINodeDashboard from './pages/AINodeDashboard';
import AgentCreator from './pages/AgentCreator';
import AreteMonitor from './pages/AreteMonitor';
import Chat from './pages/Chat';
import EvolutionDashboard from './pages/EvolutionDashboard';
import GovernanceDashboard from './pages/GovernanceDashboard';
import HiveMindDashboard from './pages/HiveMindDashboard';
import Home from './pages/Home';
import IntegrationHub from './pages/IntegrationHub';
import InvestorDemo from './pages/InvestorDemo';
import Partnerships from './pages/Partnerships';
import ResearchWorkbench from './pages/ResearchWorkbench';
import StabilityDashboard from './pages/StabilityDashboard';
import StableCoinMint from './pages/StableCoinMint';
import SystemStatus from './pages/SystemStatus';
import TeslaFSDSolver from './pages/TeslaFSDSolver';
import TexasSovereignLedger from './pages/TexasSovereignLedger';
import GitHubExport from './pages/GitHubExport';
import CinematicDashboard from './pages/CinematicDashboard';
import AuroraArchitecture from './pages/AuroraArchitecture';
import AuroraImplementation from './pages/AuroraImplementation';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AINodeDashboard": AINodeDashboard,
    "AgentCreator": AgentCreator,
    "AreteMonitor": AreteMonitor,
    "Chat": Chat,
    "EvolutionDashboard": EvolutionDashboard,
    "GovernanceDashboard": GovernanceDashboard,
    "HiveMindDashboard": HiveMindDashboard,
    "Home": Home,
    "IntegrationHub": IntegrationHub,
    "InvestorDemo": InvestorDemo,
    "Partnerships": Partnerships,
    "ResearchWorkbench": ResearchWorkbench,
    "StabilityDashboard": StabilityDashboard,
    "StableCoinMint": StableCoinMint,
    "SystemStatus": SystemStatus,
    "TeslaFSDSolver": TeslaFSDSolver,
    "TexasSovereignLedger": TexasSovereignLedger,
    "GitHubExport": GitHubExport,
    "CinematicDashboard": CinematicDashboard,
    "AuroraArchitecture": AuroraArchitecture,
    "AuroraImplementation": AuroraImplementation,
}

export const pagesConfig = {
    mainPage: "Chat",
    Pages: PAGES,
    Layout: __Layout,
};