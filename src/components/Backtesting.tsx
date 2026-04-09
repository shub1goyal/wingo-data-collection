import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { WinGoIssue, Color } from '../types';
import { runBacktest, backtestCombination } from '../services/analysisService';
import { Target, Copy, CheckCircle2 } from 'lucide-react';

interface BacktestingProps {
  issues: WinGoIssue[];
  initialPattern?: string;
  allPatterns?: any[]; // For combination lookup
}

export const Backtesting: React.FC<BacktestingProps> = ({ issues, initialPattern, allPatterns = [] }) => {
  const [patternInput, setPatternInput] = useState<string>(initialPattern || 'RR→R');
  const [stopLossStreak, setStopLossStreak] = useState<number>(3);
  const [targetUnits, setTargetUnits] = useState<number>(5);
  const [sleepHours, setSleepHours] = useState<number>(4);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync with initialPattern prop
  useEffect(() => {
    if (initialPattern) {
      setPatternInput(initialPattern);
    }
  }, [initialPattern]);

  const parsePattern = (input: string): { sequence: string[], betOn: Color } | null => {
    try {
      const cleanInput = input.toUpperCase().trim();
      
      // Handle GRRRR format (no arrow)
      if (!cleanInput.includes('→') && !cleanInput.includes('🎯') && !cleanInput.includes('-') && !cleanInput.includes('+')) {
        if (cleanInput.length < 2) return null;
        const betChar = cleanInput[cleanInput.length - 1];
        const seqChars = cleanInput.substring(0, cleanInput.length - 1);
        
        const mapCharToColor = (char: string): Color => {
          switch (char) {
            case 'R': return 'red';
            case 'G': return 'green';
            case 'V': return 'violet';
            default: return 'red';
          }
        };

        return {
          sequence: seqChars.split('').map(mapCharToColor),
          betOn: mapCharToColor(betChar)
        };
      }

      // Handle GRRR→R format
      const parts = cleanInput.split(/[→🎯-]/);
      if (parts.length < 2) return null;
      
      const betPart = parts.pop()?.trim();
      const seqPart = parts.join('').trim();
      
      const mapCharToColor = (char: string): Color => {
        switch (char) {
          case 'R': return 'red';
          case 'G': return 'green';
          case 'V': return 'violet';
          case 'RV': return 'red_violet';
          case 'GV': return 'green_violet';
          default: return 'red';
        }
      };

      const sequence: string[] = [];
      let i = 0;
      while (i < seqPart.length) {
        if (seqPart.substring(i, i + 2) === 'RV') {
          sequence.push('red_violet');
          i += 2;
        } else if (seqPart.substring(i, i + 2) === 'GV') {
          sequence.push('green_violet');
          i += 2;
        } else {
          sequence.push(mapCharToColor(seqPart[i]));
          i++;
        }
      }

      const betOn = mapCharToColor(betPart || 'R');
      
      return { sequence, betOn };
    } catch (e) {
      return null;
    }
  };

  const handleRun = async () => {
    setLoading(true);
    
    setTimeout(() => {
      // Parse patterns from input (e.g., "RR->R, GG->G" or "RRGG->R | RGRG->G")
      const rawPatterns = patternInput.split(/[,|]/).map(p => p.trim()).filter(p => p.length > 0);
      
      const parsedPatterns = rawPatterns.map(p => {
        const parts = p.split(/->|→|➔/);
        if (parts.length !== 2) return null;
        const sequence = parts[0].trim().split('').map(c => c.toUpperCase() === 'R' ? 'red' : c.toUpperCase() === 'G' ? 'green' : 'violet');
        const betOn = parts[1].trim().toUpperCase() === 'R' ? 'red' : parts[1].trim().toUpperCase() === 'G' ? 'green' : 'violet';
        return { sequence, betOn, original: p };
      }).filter(p => p !== null);

      if (parsedPatterns.length === 0) {
        alert('Invalid pattern format. Use something like GRGG→R | RGRG→G');
        setLoading(false);
        return;
      }

      const colors = issues.map(i => i.color).reverse();
      
      // Session Simulation State
      let currentSessionProfit = 0;
      let currentLossStreak = 0;
      let currentBet = 1;
      let totalProfit = 0;
      let sessionCount = 0;
      let successfulSessions = 0;
      let failedSessions = 0;
      let sleepUntilIndex = -1;
      
      const sleepIssues = sleepHours * 120; // 120 issues per hour
      const sessionHistory: any[] = [];
      
      let sessionStartIndex = 0;

      for (let i = 0; i < colors.length; i++) {
        // If we are sleeping, skip
        if (i < sleepUntilIndex) continue;

        // Start a new session if we aren't in one
        if (currentSessionProfit === 0 && currentLossStreak === 0) {
          sessionStartIndex = i;
        }

        let tradeExecuted = false;
        let isWin = false;
        let multiplier = 0;

        // Check all patterns (OR logic for now, to simulate user's bot)
        for (const pattern of parsedPatterns) {
          if (!pattern) continue;
          
          if (i >= pattern.sequence.length) {
            const sub = colors.slice(i - pattern.sequence.length, i);
            const mappedSub = sub.map(c => c === 'red_violet' ? 'red' : c === 'green_violet' ? 'green' : c === 'violet' ? 'red' : c);
            const isMatch = mappedSub.every((val, index) => val === pattern.sequence[index]);

            if (isMatch) {
              tradeExecuted = true;
              const outcome = colors[i];
              
              if (pattern.betOn === 'red') {
                if (outcome === 'red') { isWin = true; multiplier = 1.96; }
                else if (outcome === 'red_violet') { isWin = true; multiplier = 1.47; }
              } else if (pattern.betOn === 'green') {
                if (outcome === 'green') { isWin = true; multiplier = 1.96; }
                else if (outcome === 'green_violet') { isWin = true; multiplier = 1.47; }
              }
              break; // Only execute one trade per issue
            }
          }
        }

        if (tradeExecuted) {
          if (isWin) {
            const profit = (currentBet * (multiplier - 1));
            currentSessionProfit += profit;
            totalProfit += profit;
            currentLossStreak = 0;
            currentBet = 1;
          } else {
            currentSessionProfit -= currentBet;
            totalProfit -= currentBet;
            currentLossStreak++;
            
            if (currentLossStreak >= stopLossStreak) {
              // LIQUIDATION EVENT (Session Failed)
              failedSessions++;
              sessionCount++;
              sessionHistory.push({
                id: sessionCount,
                status: 'Failed',
                profit: currentSessionProfit,
                duration: i - sessionStartIndex
              });
              
              currentSessionProfit = 0;
              currentLossStreak = 0;
              currentBet = 1;
              sleepUntilIndex = i + sleepIssues; // Go to sleep
            } else {
              currentBet *= 3; // Martingale
            }
          }

          // Check if Target Hit
          if (currentSessionProfit >= targetUnits) {
            successfulSessions++;
            sessionCount++;
            sessionHistory.push({
              id: sessionCount,
              status: 'Success',
              profit: currentSessionProfit,
              duration: i - sessionStartIndex
            });
            
            currentSessionProfit = 0;
            currentLossStreak = 0;
            currentBet = 1;
            sleepUntilIndex = i + sleepIssues; // Go to sleep
          }
        }
      }

      // Calculate Worst Case Loss
      let worstCaseLoss = 0;
      let tempBet = 1;
      for (let s = 0; s < stopLossStreak; s++) {
        worstCaseLoss += tempBet;
        tempBet *= 3;
      }

      setResults({
        totalProfit,
        sessionCount,
        successfulSessions,
        failedSessions,
        successRate: sessionCount > 0 ? (successfulSessions / sessionCount) * 100 : 0,
        worstCaseLoss,
        sessionHistory: sessionHistory.reverse().slice(0, 50) // Keep last 50 for UI
      });
      
      setLoading(false);
    }, 500);
  };

  const generateBotString = () => {
    const rawPatterns = patternInput.split(/[,|]/).map(p => p.trim()).filter(p => p.length > 0);
    const formatted = rawPatterns.map(p => {
      const parts = p.split(/->|→|➔/);
      if (parts.length !== 2) return p;
      return `${parts[0].trim()}➔${parts[1].trim()}`;
    }).join(' | ');
    return formatted;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateBotString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Simulator (Hit & Run)</CardTitle>
          <CardDescription>Simulate the exact logic of your automated bot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Patterns to Test</label>
                <Input 
                  value={patternInput}
                  onChange={(e) => setPatternInput(e.target.value)}
                  placeholder="e.g. GRGG→R | RGRG→G"
                  className="font-mono"
                />
                <p className="text-xs text-zinc-500">Separate multiple patterns with | or ,</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Target (+Units)</label>
                  <Input 
                    type="number" 
                    value={targetUnits}
                    onChange={(e) => setTargetUnits(Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Stop Loss (Streak)</label>
                  <Input 
                    type="number" 
                    value={stopLossStreak}
                    onChange={(e) => setStopLossStreak(Number(e.target.value))}
                    min={1}
                    max={5}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Sleep (Hours)</label>
                  <Input 
                    type="number" 
                    value={sleepHours}
                    onChange={(e) => setSleepHours(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>

              <Button onClick={handleRun} disabled={loading} className="w-full">
                {loading ? 'Simulating...' : 'Run Session Simulator'}
              </Button>
            </div>

            {results && (
              <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  Session Simulation Results
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">Total Sessions</p>
                    <p className="text-xl font-bold">{results.sessionCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Success Rate</p>
                    <p className={`text-xl font-bold ${results.successRate > 80 ? 'text-green-600' : 'text-red-600'}`}>
                      {results.successRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Successful Sessions</p>
                    <p className="text-lg font-bold text-green-600">{results.successfulSessions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Failed Sessions (Liquidated)</p>
                    <p className="text-lg font-bold text-red-600">{results.failedSessions}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500">Net Profit (Units)</p>
                    <p className={`text-2xl font-bold ${results.totalProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {results.totalProfit > 0 ? '+' : ''}{results.totalProfit.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bot Export Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">Export for Bot</h4>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-1">{generateBotString()}</p>
            </div>
            <Button variant="outline" size="sm" onClick={copyToClipboard} className="shrink-0">
              {copied ? <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          {results && results.sessionHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold mb-2">Recent Session History</h3>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration (Issues)</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.sessionHistory.map((session: any) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.id}</TableCell>
                        <TableCell>
                          <Badge variant={session.status === 'Success' ? 'default' : 'destructive'} className={session.status === 'Success' ? 'bg-green-500' : ''}>
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{session.duration}</TableCell>
                        <TableCell className={`text-right font-bold ${session.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {session.profit > 0 ? '+' : ''}{session.profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

