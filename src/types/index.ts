export type Color = 'red' | 'green' | 'violet' | 'red_violet' | 'green_violet';

export interface WinGoIssue {
  issue: string;
  number?: number;
  color: Color;
  timestamp: number;
}

export interface DailyHistoryDoc {
  lastStoredIssue: string;
  lastUpdate: number;
  issues: WinGoIssue[];
}

export interface Pattern {
  id: string;
  name: string;
  sequence: string[]; // e.g., ['red', 'red', 'green']
  type: 'color' | 'number' | 'trend';
}

export interface PatternResult {
  patternId: string;
  name: string;
  sequence: string[];
  totalOccurrences: number;
  averageGap: number;
  lastSeen: number;
  expectedStatus: 'overdue' | 'normal' | 'hot';
  
  // Advanced Metrics
  winRate: number;
  maxLossStreak: number;
  maxDrawdown: number;
  recoveryFactor: number;
  stabilityScore: number; 
  riskLevel: 'Safe' | 'Moderate' | 'Risky' | 'Unstable';
  
  // Robustness Metrics
  confidenceScore: number; // 0-100
  reliabilityScore: number; // 0-100
  tradeDensity: number; // trades/total_issues
  
  // Risk & Fee Modeling
  commissionRate: number;
  staggeredProfit: number;
  expectancyValue: number;
  consistencyCheck: boolean;
  maxMarginRequired: number;
  confidenceInterval: [number, number];
  liquidationRisk: number;
  integrityFound: boolean;
  
  // Risk Reality Layer
  maxPossibleLoss: number; // Worst case scenario
  capitalRequired: number; // To survive max streak
  profitPerTrade: number; // Normalized profit
  sessionSuccessRate: number; // Hit and run success rate
  
  // Validation Data
  mainPerformance: {
    winRate: number;
    profit: number;
    profitPerTrade: number;
    trades: number;
    maxStreak: number;
    maxDrawdown: number;
    maxMarginRequired: number;
  };
  validationPerformance: {
    winRate: number;
    profit: number;
    profitPerTrade: number;
    trades: number;
    maxStreak: number;
    maxDrawdown: number;
    maxMarginRequired: number;
  };
}

export interface PatternCombination {
  id: string;
  name: string;
  patterns: PatternResult[];
  totalOccurrences: number;
  winRate: number;
  maxLossStreak: number;
  maxDrawdown: number;
  recoveryFactor: number;
  stabilityScore: number;
  maxMarginRequired: number;
  riskLevel: 'Safe' | 'Moderate' | 'Risky' | 'Unstable';
  
  // Robustness Metrics
  confidenceScore: number;
  reliabilityScore: number;
  tradeDensity: number;
  
  mainPerformance: {
    winRate: number;
    profit: number;
    profitPerTrade: number;
    trades: number;
    maxStreak: number;
    maxDrawdown: number;
    maxMarginRequired: number;
  };
  validationPerformance: {
    winRate: number;
    profit: number;
    profitPerTrade: number;
    trades: number;
    maxStreak: number;
    maxDrawdown: number;
    maxMarginRequired: number;
  };
}

export interface BacktestResult {
  totalProfit: number;
  maxDrawdown: number;
  winRate: number;
  recoveryFactor: number;
  trades: number;
  maxMarginRequired: number;
  maxLossStreak: number;
  maxPossibleLoss: number;
  capitalRequired: number;
}
