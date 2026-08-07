// Client-side mirror of the SMOA agent roster for UI display (status banner,
// team select, footer attribution). Mirrors convex/agents/agentDefinitions.ts.

export interface AgentUiDef {
  id: string;
  name: string;
  role: string;
  stage: string;
  weight: number;
  description: string;
}

export const AGENT_DEFS: AgentUiDef[] = [
  { id: 'tunde', name: 'Tunde Fixtures (Tunde Onitiri)', role: 'Fixtures Specialist', stage: 'Fetching fixtures', weight: 12, description: 'Discovers scheduled matches and leagues from betwatch.fr and sports registries.' },
  { id: 'kunle', name: 'Kunle Odds (Kunle Akin)', role: 'Odds Specialist', stage: 'Collecting odds', weight: 16, description: 'Pulls primary and cross-reference odds for every market.' },
  { id: 'ngozi', name: 'Ngozi Volume (Ngozi Okafor)', role: 'Volume Specialist', stage: 'Checking traded volume', weight: 10, description: 'Reads traded-volume signals across exchange sources.' },
  { id: 'bolanle', name: 'Bolanle Research (Bolanle Adeyemi)', role: 'Research Specialist', stage: 'Validating sources', weight: 10, description: 'Cross-checks predictions and research registries via web search.' },
  { id: 'chinedu', name: 'Chinedu Normalizer (Chinedu Eze)', role: 'Normalization Specialist', stage: 'Normalizing data', weight: 18, description: 'Shapes raw scrapes into analysis-ready engine scopes.' },
  { id: 'amara', name: 'Amara Floor Gatekeeper (Amara Obi)', role: 'Probability Specialist', stage: 'Filtering ≥60%', weight: 14, description: 'Runs the confidence floor so only high-probability selections surface.' },
  { id: 'zainab', name: 'Zainab Risk Auditor (Zainab Bello)', role: 'Risk & Compliance', stage: 'Risk review', weight: 8, description: 'Flags missing data, contradictions and volatile markets.' },
  { id: 'adaeze', name: 'Adaeze Reporter (Adaeze Nnamdi)', role: 'Report Specialist', stage: 'Compiling verdicts', weight: 8, description: 'Formats the final standardized insights report.' },
  { id: 'emeka', name: 'Emeka Cache Sync (Emeka Obi)', role: 'Cache & Scheduler', stage: 'Caching day', weight: 4, description: 'Persists the day cache and schedules automatic refresh cycles.' }
];

export const AGENT_WEIGHT_SUM = AGENT_DEFS.reduce((sum, a) => sum + a.weight, 100);
