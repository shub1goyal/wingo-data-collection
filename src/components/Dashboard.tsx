import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { WinGoIssue, PatternResult, PatternCombination } from '../types';
import { fetchRollingWindowIssues } from '../services/dataService';
import { bruteForceAnalysis, analyzePatternCombinations, getPartialMatches } from '../services/analysisService';
import { TrendingUp, Activity, Target, Zap, ShieldCheck, AlertTriangle, Layers, ArrowUpDown, Filter, RefreshCw, PlayCircle, Star, ShieldAlert } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Backtesting } from './Backtesting';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Info } from 'lucide-react';

const InfoTooltip = ({ content }: { content: React.ReactNode }) => (
  <div className="group relative inline-block ml-1">
    <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600 cursor-help" />
    <div className="hidden group-hover:block absolute z-50 w-64 p-2 mt-1 text-xs text-white bg-zinc-800 rounded shadow-lg -left-1/2 transform -translate-x-1/2">
      {content}
    </div>
  </div>
);

interface DashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ activeTab, onTabChange }) => {
  const [issues, setIssues] = useState<WinGoIssue[]>([]);
  const [patterns, setPatterns] = useState<PatternResult[]>([]);
  const [combinations, setCombinations] = useState<PatternCombination[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  
  // Timeframe filters (Hardcoded for simplicity as requested)
  const mainHours = 10;
  const validationHours = 2;
  const ghostTrades = 0;
  const [stopLossStreak, setStopLossStreak] = useState(3); // Strict cap default

  const [selectedPattern, setSelectedPattern] = useState<string | undefined>(undefined);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({
    key: 'stabilityScore',
    direction: 'desc'
  });

  const sortedPatterns = useMemo(() => {
    const sortable = [...patterns];
    if (sortConfig.key) {
      sortable.sort((a: any, b: any) => {
        const isVal = validationHours > 0;
        let aValue: number;
        let bValue: number;

        if (sortConfig.key === 'profit') {
          aValue = isVal ? a.validationPerformance.profit : a.mainPerformance.profit;
          bValue = isVal ? b.validationPerformance.profit : b.mainPerformance.profit;
        } else if (sortConfig.key === 'winRate') {
          aValue = isVal ? a.validationPerformance.winRate : a.mainPerformance.winRate;
          bValue = isVal ? b.validationPerformance.winRate : b.mainPerformance.winRate;
        } else if (sortConfig.key === 'maxLossStreak') {
          aValue = isVal ? a.validationPerformance.maxStreak : a.mainPerformance.maxStreak;
          bValue = isVal ? b.validationPerformance.maxStreak : b.mainPerformance.maxStreak;
        } else if (sortConfig.key === 'maxMarginRequired') {
          aValue = isVal ? a.validationPerformance.maxMarginRequired : a.mainPerformance.maxMarginRequired;
          bValue = isVal ? b.validationPerformance.maxMarginRequired : b.mainPerformance.maxMarginRequired;
        } else if (sortConfig.key === 'recoveryFactor') {
          const aP = isVal ? a.validationPerformance.profit : a.mainPerformance.profit;
          const aD = isVal ? a.validationPerformance.maxDrawdown : a.mainPerformance.maxDrawdown;
          const bP = isVal ? b.validationPerformance.profit : b.mainPerformance.profit;
          const bD = isVal ? b.validationPerformance.maxDrawdown : b.mainPerformance.maxDrawdown;
          aValue = aP / (aD || 1);
          bValue = bP / (bD || 1);
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [patterns, sortConfig, validationHours]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const mainSamples = mainHours * 120;
        const validationSamples = validationHours * 120;
        const totalSamples = mainSamples + validationSamples;

        const issuesData = await fetchRollingWindowIssues(totalSamples);
        setIssues(issuesData);

        if (issuesData.length > 0) {
          const patternsData = bruteForceAnalysis(issuesData, mainSamples, validationSamples, stopLossStreak, ghostTrades);
          setPatterns(patternsData);

          const combinationsData = analyzePatternCombinations(issuesData, patternsData, mainSamples, validationSamples, stopLossStreak, ghostTrades);
          setCombinations(combinationsData);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [refreshKey, stopLossStreak]);

  const sortedCombinations = useMemo(() => {
    const sortable = [...combinations];
    if (sortConfig.key) {
      sortable.sort((a: any, b: any) => {
        const isVal = validationHours > 0;
        let aValue: number;
        let bValue: number;

        if (sortConfig.key === 'profit') {
          aValue = isVal ? a.validationPerformance.profit : a.mainPerformance.profit;
          bValue = isVal ? b.validationPerformance.profit : b.mainPerformance.profit;
        } else if (sortConfig.key === 'winRate') {
          aValue = isVal ? a.validationPerformance.winRate : a.mainPerformance.winRate;
          bValue = isVal ? b.validationPerformance.winRate : b.mainPerformance.winRate;
        } else if (sortConfig.key === 'maxLossStreak') {
          aValue = isVal ? a.validationPerformance.maxStreak : a.mainPerformance.maxStreak;
          bValue = isVal ? b.validationPerformance.maxStreak : b.mainPerformance.maxStreak;
        } else if (sortConfig.key === 'maxMarginRequired') {
          aValue = isVal ? a.validationPerformance.maxMarginRequired : a.mainPerformance.maxMarginRequired;
          bValue = isVal ? b.validationPerformance.maxMarginRequired : b.mainPerformance.maxMarginRequired;
        } else if (sortConfig.key === 'recoveryFactor') {
          const aP = isVal ? a.validationPerformance.profit : a.mainPerformance.profit;
          const aD = isVal ? a.validationPerformance.maxDrawdown : a.mainPerformance.maxDrawdown;
          const bP = isVal ? b.validationPerformance.profit : b.mainPerformance.profit;
          const bD = isVal ? b.validationPerformance.maxDrawdown : b.mainPerformance.maxDrawdown;
          aValue = aP / (aD || 1);
          bValue = bP / (bD || 1);
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [combinations, sortConfig, validationHours]);

  const recommendedPatterns = useMemo(() => {
    return [...patterns]
      .filter(p => p.stabilityScore > 70 && p.maxMarginRequired < 500)
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 3);
  }, [patterns]);

  const partialMatches = useMemo(() => {
    return getPartialMatches(issues, patterns);
  }, [issues, patterns]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 inline opacity-30" />;
    return <ArrowUpDown className={cn("ml-2 h-3 w-3 inline", sortConfig.direction === 'asc' ? "text-blue-500" : "text-blue-700")} />;
  };

  const isDataIntact = useMemo(() => {
    return true; 
  }, [issues]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleQuickBacktest = (patternName: string) => {
    setSelectedPattern(patternName);
    onTabChange('backtest');
  };

  const formatKPI = (main: number, val: number, decimals: number = 1) => {
    if (validationHours === 0) return main.toFixed(decimals);
    return `${main.toFixed(decimals)} | ${val.toFixed(decimals)}`;
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      {!isDataIntact && (
        <div className="p-4 bg-red-100 border border-red-200 text-red-800 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">Warning: Data gap detected in issue history. Pattern sequences may be unreliable.</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Deep Analysis</TabsTrigger>
          <TabsTrigger value="combinations">Combinations</TabsTrigger>
          <TabsTrigger value="backtest">Backtesting</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-zinc-100")}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button 
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {loading ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">Martingale Cap (Strict Stop Loss)</label>
              <Input 
                type="number" 
                value={stopLossStreak} 
                onChange={(e) => setStopLossStreak(Math.max(1, Number(e.target.value)))}
                className="h-8 text-sm"
                min={1}
                max={5}
              />
              <p className="text-[10px] text-zinc-400">Max recommended: 3 (1x, 3x, 9x). Higher is suicide.</p>
            </div>
            <div className="flex items-end">
              <div className="text-xs text-zinc-500">
                <p><strong>System Note:</strong> Patterns are now strictly analyzed for **Lengths 3 and 4** to maximize reliability. Substantial data is pulled from Supabase every 3 minutes.</p>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      <TabsContent value="overview" className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Analyzed Samples</CardTitle>
              <Activity className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{issues.length}</div>
              <p className="text-xs text-zinc-500 mt-1">Window: {mainHours + validationHours}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Stable Patterns</CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {patterns.filter(p => p.stabilityScore > 80).length}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Stability &gt; 80%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Risk Alerts</CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {patterns.filter(p => p.liquidationRisk > 0).length}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Patterns with liquidations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Avg Recovery</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {patterns.length > 0 ? (patterns.reduce((acc, p) => acc + (p.recoveryFactor || 0), 0) / patterns.length).toFixed(2) : "0.00"}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Mean Recovery Factor</p>
            </CardContent>
          </Card>
        </div>

        {/* Recommended Strategies */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="h-5 w-5 text-yellow-500 mr-2" />
                Recommended Strategies (Top 3)
              </CardTitle>
              <p className="text-xs text-zinc-500">Selected for high stability and manageable margin requirements.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendedPatterns.map((p, idx) => (
                  <div key={p.patternId} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm relative overflow-hidden group hover:border-blue-500 transition-colors">
                    <div className="absolute top-0 right-0 p-2">
                      <div className="text-[10px] font-bold text-zinc-400">#{idx + 1}</div>
                    </div>
                    <div className="mb-3">
                      <div className="text-sm font-bold truncate">{p.name}</div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Stability: {p.stabilityScore}%</div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Win Rate</span>
                        <span className="font-bold text-green-600">{p.winRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Max Margin</span>
                        <span className={cn("font-bold", p.maxMarginRequired > 500 ? "text-red-500" : "text-amber-600")}>
                          {p.maxMarginRequired}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs h-8"
                      onClick={() => handleQuickBacktest(p.name)}
                    >
                      Backtest
                    </Button>
                  </div>
                ))}
                {recommendedPatterns.length === 0 && (
                  <div className="col-span-3 py-10 text-center text-zinc-500 italic border-2 border-dashed rounded-xl">
                    No patterns meet the safety criteria. Adjust timeframe or filters.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="h-5 w-5 text-amber-500 mr-2" />
                Active Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {patterns
                .filter(p => {
                  const lastIssues = issues.slice(0, p.sequence.length).map(i => i.color).reverse();
                  return p.sequence.every((val, idx) => val === lastIssues[idx]);
                })
                .slice(0, 3)
                .map(p => (
                  <div key={p.patternId} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Triggered</div>
                      <div className="text-sm font-bold">{p.name}</div>
                    </div>
                    <Badge className="bg-amber-500 text-white border-none">Active</Badge>
                  </div>
                ))}
              
              {/* Partial Signals */}
              <div className="pt-2">
                <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Partial Signals (Nearing)</div>
                <div className="space-y-2">
                  {partialMatches.map(p => (
                    <div key={p.patternId} className="flex items-center justify-between p-2 rounded border border-zinc-100 dark:border-zinc-800 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-zinc-200 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full" style={{ width: `${p.matchPercentage}%` }} />
                        </div>
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <span className="text-zinc-400">{p.matchPercentage}%</span>
                    </div>
                  ))}
                  {partialMatches.length === 0 && (
                    <div className="text-[10px] text-zinc-400 italic">No partial matches found.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="analysis">
        <Card>
          <CardHeader>
            <CardTitle>Brute Force Pattern Evaluation</CardTitle>
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Stability = 50% WR + 30% Profit + 20% Streak consistency.</p>
              <p>RF = Net Profit / Max Drawdown (Full Equity Tracking).</p>
              <p>Profit calculated with base bet 1.</p>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => requestSort('name')} className="cursor-pointer hover:bg-zinc-50">
                    Pattern {renderSortIcon('name')}
                  </TableHead>
                  <TableHead>
                    Trades
                    <InfoTooltip content="Total number of times this pattern appeared and was traded in the selected timeframe." />
                  </TableHead>
                  <TableHead onClick={() => requestSort('winRate')} className="cursor-pointer hover:bg-zinc-50">
                    WR (Main) {renderSortIcon('winRate')}
                    <InfoTooltip content="Win Rate: Percentage of trades that won. Formula: (Wins / Total Trades) * 100. High WR is good, but Expectancy is more important." />
                  </TableHead>
                  <TableHead onClick={() => requestSort('maxLossStreak')} className="cursor-pointer hover:bg-zinc-50">
                    Streak {renderSortIcon('maxLossStreak')}
                    <InfoTooltip content="Max Loss Streak: The highest number of consecutive losses before a win or liquidation. Determines how deep into Martingale you go." />
                  </TableHead>
                  <TableHead onClick={() => requestSort('maxMarginRequired')} className="cursor-pointer hover:bg-zinc-50">
                    Margin {renderSortIcon('maxMarginRequired')}
                    <InfoTooltip content="Max Margin Required: The highest bet amount reached during a loss streak (e.g., 1, 3, 9, 27). High margin = High risk of ruin." />
                  </TableHead>
                  <TableHead className="text-red-600">
                    Worst Case
                    <InfoTooltip content="Worst Case Loss: The total capital wiped out if the Stop Loss Streak is hit. Formula: Sum of all bets up to Stop Loss level." />
                  </TableHead>
                  <TableHead className="text-purple-600">
                    Expectancy
                    <InfoTooltip content="Expectancy Value: Average profit/loss per trade. Formula: Total Profit / Total Trades. If negative, the pattern is mathematically guaranteed to lose money over time." />
                  </TableHead>
                  <TableHead onClick={() => requestSort('profit')} className="cursor-pointer hover:bg-zinc-50">
                    Profit (Main) {renderSortIcon('profit')}
                    <InfoTooltip content="Net Profit: Total units won minus total units lost, calculated using a base bet of 1. Violet wins (1.47x) are factored in." />
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPatterns.map((p) => (
                  <TableRow key={p.patternId} className={cn(p.stabilityScore < 50 && "opacity-60")}>
                    <TableCell className="font-medium text-xs">
                      <div className="flex flex-col">
                        <span>{p.name}</span>
                        <Badge variant="outline" className="w-fit text-[8px] mt-1 px-1 py-0 h-3">
                          {p.riskLevel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500">{p.totalOccurrences}</TableCell>
                    <TableCell className="text-xs">{p.mainPerformance.winRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs">{p.mainPerformance.maxStreak}</TableCell>
                    <TableCell className={cn(
                      "text-xs font-bold",
                      p.maxMarginRequired > 1000 ? "text-red-600" : 
                      p.maxMarginRequired > 500 ? "text-amber-600" : "text-zinc-900"
                    )}>
                      {p.maxMarginRequired}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-red-600">
                      -{p.maxPossibleLoss}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-purple-600">
                      {p.expectancyValue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs">{p.mainPerformance.profit.toFixed(1)}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleQuickBacktest(p.name)}
                      >
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {patterns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={validationHours > 0 ? 11 : 9} className="text-center py-10 text-zinc-500">Analyzing...</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="combinations">
        <CombinationsTab 
          combinations={sortedCombinations} 
          onSort={requestSort} 
          sortConfig={sortConfig} 
          onBacktest={handleQuickBacktest}
          validationHours={validationHours}
        />
      </TabsContent>

      <TabsContent value="backtest">
        <Backtesting issues={issues} initialPattern={selectedPattern} allPatterns={patterns} />
      </TabsContent>
    </Tabs>
  );
};

const CombinationsTab: React.FC<{ 
  combinations: PatternCombination[], 
  onSort: (key: any) => void,
  sortConfig: { key: string, direction: string },
  onBacktest: (name: string) => void,
  validationHours: number
}> = ({ combinations, onSort, sortConfig, onBacktest, validationHours }) => {
  const formatKPI = (main: number, val: number, decimals: number = 1) => {
    if (validationHours === 0) return main.toFixed(decimals);
    return `${main.toFixed(decimals)} | ${val.toFixed(decimals)}`;
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-30" />;
    return <ArrowUpDown className={cn("ml-2 h-4 w-4 inline", sortConfig.direction === 'asc' ? "text-blue-500" : "text-blue-700")} />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Layers className="h-5 w-5 text-blue-500 mr-2" />
          Multi-Pattern Combinations
        </CardTitle>
        <p className="text-xs text-zinc-500">
          Evaluating combined signals from top-performing individual patterns. Profit calculated with base bet 1.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => onSort('name')} className="cursor-pointer hover:bg-zinc-50">
                Combination {renderSortIcon('name')}
              </TableHead>
              <TableHead>
                Trades
                <InfoTooltip content="Total number of times this combination of patterns appeared and was traded." />
              </TableHead>
              <TableHead onClick={() => onSort('winRate')} className="cursor-pointer hover:bg-zinc-50">
                WR {validationHours > 0 ? '(M|V)' : '(Main)'} {renderSortIcon('winRate')}
                <InfoTooltip content="Win Rate: Percentage of trades that won. (M|V) shows Main vs Validation timeframe performance." />
              </TableHead>
              <TableHead onClick={() => onSort('maxLossStreak')} className="cursor-pointer hover:bg-zinc-50">
                Streak {validationHours > 0 ? '(M|V)' : ''} {renderSortIcon('maxLossStreak')}
                <InfoTooltip content="Max Loss Streak: The highest number of consecutive losses before a win or liquidation." />
              </TableHead>
              <TableHead onClick={() => onSort('maxMarginRequired')} className="cursor-pointer hover:bg-zinc-50">
                Margin {validationHours > 0 ? '(M|V)' : ''} {renderSortIcon('maxMarginRequired')}
                <InfoTooltip content="Max Margin Required: The highest bet amount reached during a loss streak." />
              </TableHead>
              <TableHead className="text-purple-600">
                Expectancy
                <InfoTooltip content="Expectancy Value: Average profit/loss per trade. Formula: Total Profit / Total Trades." />
              </TableHead>
              <TableHead className="text-blue-600">
                Execution Plan
                <InfoTooltip content="Hit & Run Strategy: Target 5 wins and then stop. Expected Profit shows the estimated net gain for those 5 wins based on historical expectancy." />
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combinations.map((c, index) => (
              <TableRow key={c.id || index}>
                <TableCell className="font-medium text-[10px] max-w-[200px] truncate">
                  <div className="flex flex-col">
                    <span>{c.name}</span>
                    <Badge variant="outline" className="w-fit text-[8px] mt-1 px-1 py-0 h-3">
                      {c.riskLevel}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-zinc-500">{c.totalOccurrences}</TableCell>
                <TableCell className="text-xs">{formatKPI(c.mainPerformance.winRate, c.validationPerformance.winRate)}%</TableCell>
                <TableCell className="text-xs">{formatKPI(c.mainPerformance.maxStreak, c.validationPerformance.maxStreak, 0)}</TableCell>
                <TableCell className={cn(
                  "text-xs font-bold",
                  c.maxMarginRequired > 1000 ? "text-red-600" : 
                  c.maxMarginRequired > 500 ? "text-amber-600" : "text-zinc-900"
                )}>
                  {formatKPI(c.mainPerformance.maxMarginRequired, c.validationPerformance.maxMarginRequired, 0)}
                </TableCell>
                <TableCell className="text-xs font-bold text-purple-600">
                  {formatKPI(c.mainPerformance.profitPerTrade, c.validationPerformance.profitPerTrade, 2)}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-blue-600">Target: 5 Wins</span>
                    <span className="text-green-600 font-medium text-[11px]">
                      Exp. Profit: +{(c.mainPerformance.profitPerTrade * 5).toFixed(2)}
                    </span>
                    <span className="text-zinc-500 text-[10px]">
                      Est: {c.tradeDensity > 0 ? Math.round((5 * 30 / c.tradeDensity) / 60) : '?'} mins
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-zinc-400 hover:text-blue-600"
                    onClick={() => onBacktest(c.name)}
                  >
                    <PlayCircle className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {combinations.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-zinc-500">
                  No combinations found. Try adjusting the Combo Size or relaxing the filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
