import { WinGoIssue, PatternResult, PatternCombination, Color, BacktestResult } from '../types';

export const generateAllPatterns = (minLength: number, maxLength: number): string[][] => {
  const colors: Color[] = ['red', 'green'];
  const allPatterns: string[][] = [];

  const generate = (current: string[]) => {
    // Only add patterns if length is 3 or 4
    if (current.length === 3 || current.length === 4) {
      allPatterns.push([...current]);
    }
    
    // Stop generating if we reach max length
    if (current.length < 4) {
      for (const color of colors) {
        generate([...current, color]);
      }
    }
  };

  generate([]);
  return allPatterns;
};


const getColorInitial = (color: string): string => {
  switch (color.toLowerCase()) {
    case 'red': return 'R';
    case 'green': return 'G';
    case 'violet': return 'V';
    case 'red_violet': return 'RV';
    case 'green_violet': return 'GV';
    default: return color[0].toUpperCase();
  }
};

export const detectRegime = (issues: WinGoIssue[], windowSize: number = 20): 'Trending' | 'Choppy' | 'Neutral' => {
  if (issues.length < windowSize) return 'Neutral';
  // issues are sorted latest first. We want to check the most recent window.
  const recent = issues.slice(0, windowSize).map(i => i.color);
  let switches = 0;
  for (let i = 0; i < recent.length - 1; i++) {
    const c1 = recent[i].includes('red') ? 'red' : 'green';
    const c2 = recent[i+1].includes('red') ? 'red' : 'green';
    if (c1 !== c2) switches++;
  }
  const switchRate = switches / (windowSize - 1);
  if (switchRate >= 0.6) return 'Choppy';
  if (switchRate <= 0.4) return 'Trending';
  return 'Neutral';
};

export const evaluatePattern = (
  issues: WinGoIssue[], 
  pattern: string[], 
  betOn: Color, 
  commissionRate: number = 0.02,
  stopLossStreak: number = 3,
  ghostTrades: number = 0 // Number of virtual losses to wait before real betting
) => {
  let trades = 0;
  let wins = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;
  let totalProfit = 0;
  let staggeredProfit = 0;
  let gaps: number[] = [];
  let lastSeenIndex = -1;
  let currentGap = 0;
  
  let currentEquity = 0;
  let peakEquity = 0;
  let maxDrawdown = 0;
  
  // Clustering Tracking
  let consecutiveTrades = 0;
  let maxConsecutiveTrades = 0;

  // Staggered Betting Tracking
  let currentBet = 1; // Base bet set to 1
  let maxMarginRequired = 1;
  let liquidationEvents = 0;
  
  // Ghost Trading State
  let currentGhostStreak = 0;

  const WIN_MULTIPLIER = 1.96;
  const MIX_WIN_MULTIPLIER = 1.47;

  const colors = issues.map(i => i.color).reverse();

  for (let i = 0; i < colors.length - pattern.length - 1; i++) {
    const sub = colors.slice(i, i + pattern.length);
    // Ignore violet for pattern matching. Treat RV as Red, GV as Green. Pure Violet defaults to Red.
    const mappedSub = sub.map(c => c === 'red_violet' ? 'red' : c === 'green_violet' ? 'green' : c === 'violet' ? 'red' : c);
    const isMatch = mappedSub.every((val, index) => val === pattern[index]);

    if (isMatch) {
      if (lastSeenIndex !== -1) gaps.push(currentGap);
      lastSeenIndex = i;
      currentGap = 0;

      const outcome = colors[i + pattern.length];
      
      let isWin = false;
      let multiplier = 0;

      if (betOn === 'red') {
        if (outcome === 'red') {
          isWin = true;
          multiplier = WIN_MULTIPLIER;
        } else if (outcome === 'red_violet') {
          isWin = true;
          multiplier = MIX_WIN_MULTIPLIER;
        }
      } else if (betOn === 'green') {
        if (outcome === 'green') {
          isWin = true;
          multiplier = WIN_MULTIPLIER;
        } else if (outcome === 'green_violet') {
          isWin = true;
          multiplier = MIX_WIN_MULTIPLIER;
        }
      } else if (outcome === betOn) {
        isWin = true;
        multiplier = outcome === 'violet' ? 4.41 : WIN_MULTIPLIER;
      }

      // Ghost Trading Logic
      if (currentGhostStreak < ghostTrades) {
        if (!isWin) {
          currentGhostStreak++; // Virtual loss, increment ghost streak
        } else {
          currentGhostStreak = 0; // Virtual win, reset ghost streak
        }
        continue; // Skip real betting
      }

      // Real Betting Logic (Only executes if ghost streak is met)
      trades++;
      consecutiveTrades++;
      maxConsecutiveTrades = Math.max(maxConsecutiveTrades, consecutiveTrades);

      if (isWin) {
        wins++;
        const profit = (currentBet * (multiplier - 1));
        totalProfit += profit;
        staggeredProfit += profit;
        currentEquity += profit;
        currentLossStreak = 0;
        currentBet = 1; // Reset bet
        currentGhostStreak = 0; // Reset ghosting after a real win
      } else {
        totalProfit -= currentBet;
        staggeredProfit -= currentBet;
        currentEquity -= currentBet;
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        
        if (currentLossStreak >= stopLossStreak) {
            liquidationEvents++;
            currentBet = 1; // Reset after stop loss
            currentLossStreak = 0;
            currentGhostStreak = 0; // Reset ghosting after liquidation
        } else {
            currentBet *= 3; // Staggered multiplier
        }
        maxMarginRequired = Math.max(maxMarginRequired, currentBet);
      }
      
      peakEquity = Math.max(peakEquity, currentEquity);
      const drawdown = peakEquity - currentEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    } else {
      currentGap++;
      consecutiveTrades = 0;
      currentGhostStreak = 0; // Reset ghost streak on gap
    }
  }

  const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const recoveryFactor = maxDrawdown > 0 ? totalProfit / maxDrawdown : totalProfit / 1;
  
  // Risk Reality Layer
  let worstCaseLoss = 0;
  let tempBet = 1;
  for (let s = 0; s < stopLossStreak; s++) {
    worstCaseLoss += tempBet;
    tempBet *= 3;
  }
  const capitalRequired = worstCaseLoss;

  // Session Simulation (Hit and Run)
  // Target: +10 wins (as per user bot), Stop: -worstCaseLoss
  const estimatedSessions = Math.max(1, Math.floor(trades / 10));
  const sessionSuccessRate = trades > 0 ? 
    Math.max(0, 100 - ((liquidationEvents / Math.max(1, trades)) * 100)) : 0;

  return {
    trades,
    winRate,
    maxLossStreak,
    maxDrawdown,
    totalProfit,
    staggeredProfit,
    expectancyValue: trades > 0 ? totalProfit / trades : 0,
    avgGap,
    lastSeen: lastSeenIndex === -1 ? colors.length : (colors.length - 1 - (lastSeenIndex + pattern.length)),
    recoveryFactor,
    maxConsecutiveTrades,
    maxMarginRequired,
    liquidationRisk: trades > 0 ? liquidationEvents / trades : 0,
    maxPossibleLoss: worstCaseLoss,
    capitalRequired,
    profitPerTrade: trades > 0 ? totalProfit / trades : 0,
    sessionSuccessRate
  };
};

export const validateSequenceIntegrity = (issues: WinGoIssue[]): boolean => {
  if (issues.length < 2) return true;
  
  // Sort issues by number desc
  const sorted = [...issues].sort((a, b) => Number(b.issue) - Number(a.issue));
  
  for (let i = 0; i < sorted.length - 1; i++) {
    if (Number(sorted[i].issue) - Number(sorted[i+1].issue) > 1) {
      return false; // Gap detected
    }
  }
  return true;
};

export const bruteForceAnalysis = (
  issues: WinGoIssue[], 
  mainSamples: number = 1000, 
  validationSamples: number = 0,
  stopLossStreak: number = 3, // STRICT CAP: Default to 3 (1, 3, 9)
  ghostTrades: number = 0
): PatternResult[] => {
  if (issues.length < 100) return [];
  
  const integrityFound = validateSequenceIntegrity(issues);
  const currentRegime = detectRegime(issues, 20);

  const validationData = issues.slice(0, validationSamples); 
  const mainData = issues.slice(validationSamples, validationSamples + mainSamples); 

  const patterns = generateAllPatterns(2, 4);
  const results: PatternResult[] = [];

  patterns.forEach(p => {
    ['red', 'green'].forEach(betColor => {
      const commissionRate = 0.02;
      const trainEval = evaluatePattern(mainData, p, betColor as Color, commissionRate, stopLossStreak, ghostTrades);
      const valEval = evaluatePattern(validationData, p, betColor as Color, commissionRate, stopLossStreak, ghostTrades);

      const totalTrades = trainEval.trades + valEval.trades;
      
      if (totalTrades < 30) return;

      const clustering = totalTrades > 0 ? Math.max(trainEval.maxConsecutiveTrades, valEval.maxConsecutiveTrades) / totalTrades : 0;
      if (clustering > 0.5) return;

      const consistencyCheck = validationSamples === 0 || 
        ((trainEval.totalProfit >= 0 && valEval.totalProfit >= 0) || (trainEval.totalProfit < 0 && valEval.totalProfit < 0));
      
      const calculateConsistency = (v1: number, v2: number) => {
        const maxVal = Math.max(Math.abs(v1), Math.abs(v2));
        return maxVal === 0 ? 1 : 1 - (Math.abs(v1 - v2) / maxVal);
      };

      let stability = 1;
      if (validationSamples > 0) {
        const cWR = calculateConsistency(trainEval.winRate, valEval.winRate);
        // Normalize profit by profit per trade for stability comparison
        const cProfit = calculateConsistency(trainEval.profitPerTrade, valEval.profitPerTrade);
        const cStreak = calculateConsistency(trainEval.maxLossStreak, valEval.maxLossStreak);
        stability = consistencyCheck ? (0.5 * cWR + 0.3 * cProfit + 0.2 * cStreak) : 0;
      }
      
      const avgWR = validationSamples > 0 ? (trainEval.winRate + valEval.winRate) / 2 : trainEval.winRate;
      const totalProfit = trainEval.totalProfit + valEval.totalProfit;
      
      // Profit-Gated Stability: If it loses money, it is not stable.
      if (trainEval.totalProfit < 0 || (validationSamples > 0 && valEval.totalProfit < 0)) {
        stability = 0;
      }

      // Recency Filter: Reject if the pattern lost 2 out of its last 3 trades
      let recentLosses = 0;
      let recentTrades = 0;
      const recentColors = mainData.map(i => i.color).reverse();
      for (let i = 0; i < recentColors.length - p.length - 1 && recentTrades < 3; i++) {
        const sub = recentColors.slice(i, i + p.length);
        const mappedSub = sub.map(c => c === 'red_violet' ? 'red' : c === 'green_violet' ? 'green' : c === 'violet' ? 'red' : c);
        if (mappedSub.every((val, index) => val === p[index])) {
          recentTrades++;
          const outcome = recentColors[i + p.length];
          let isWin = false;
          if (betColor === 'red' && (outcome === 'red' || outcome === 'red_violet')) isWin = true;
          else if (betColor === 'green' && (outcome === 'green' || outcome === 'green_violet')) isWin = true;
          else if (outcome === betColor || (outcome === 'violet' && betColor === 'red')) isWin = true;
          
          if (!isWin) recentLosses++;
        }
      }

      if (recentTrades >= 3 && recentLosses >= 2) {
        return; // Reject decayed pattern
      }

      const maxStreak = Math.max(trainEval.maxLossStreak, valEval.maxLossStreak);
      const maxDrawdown = Math.max(trainEval.maxDrawdown, valEval.maxDrawdown);
      const recoveryFactor = maxDrawdown > 0 ? totalProfit / maxDrawdown : totalProfit;

      const confidenceScore = Math.round(stability * Math.min(1, totalTrades / 50) * 100);
      const reliabilityScore = Math.round(stability * (1 - clustering) * 100);
      const tradeDensity = totalTrades / issues.length;

      let riskLevel: 'Safe' | 'Moderate' | 'Risky' | 'Unstable' = 'Risky';
      if (stability < 0.3 || trainEval.expectancyValue <= -10 || !consistencyCheck || totalProfit < 0) {
        riskLevel = 'Unstable';
      } else if (stability > 0.8 && recoveryFactor > 1.5 && maxStreak <= 3 && avgWR > 52) {
        riskLevel = 'Safe';
      } else if (stability > 0.7 && recoveryFactor > 1.0 && maxStreak <= 5 && avgWR > 48) {
        riskLevel = 'Moderate';
      }

      // Enforce minimum sample sizes and profitability for inclusion
      if (trainEval.trades >= 20 && totalProfit > 0) {
        const shortName = `${p.map(getColorInitial).join('')}→${getColorInitial(betColor)}`;
        results.push({
          patternId: `${p.join('-')}:${betColor}`,
          name: shortName,
          sequence: p,
          totalOccurrences: totalTrades,
          averageGap: Math.round(trainEval.avgGap * 10) / 10,
          lastSeen: trainEval.lastSeen,
          expectedStatus: trainEval.lastSeen > trainEval.avgGap * 1.0 ? 'overdue' : 'normal',
          winRate: Math.round(avgWR * 10) / 10,
          maxLossStreak: maxStreak,
          maxDrawdown,
          recoveryFactor: Math.round(recoveryFactor * 100) / 100,
          stabilityScore: Math.round(stability * 100),
          riskLevel,
          confidenceScore,
          reliabilityScore,
          tradeDensity,
          commissionRate,
          staggeredProfit: trainEval.staggeredProfit,
          expectancyValue: trainEval.expectancyValue,
          consistencyCheck,
          maxMarginRequired: trainEval.maxMarginRequired,
          liquidationRisk: trainEval.liquidationRisk,
          integrityFound,
          confidenceInterval: [0, 1],
          maxPossibleLoss: trainEval.maxPossibleLoss,
          capitalRequired: trainEval.capitalRequired,
          profitPerTrade: totalTrades > 0 ? totalProfit / totalTrades : 0,
          sessionSuccessRate: trainEval.sessionSuccessRate,
          mainPerformance: { 
            winRate: trainEval.winRate, 
            profit: trainEval.totalProfit, 
            profitPerTrade: trainEval.profitPerTrade,
            trades: trainEval.trades,
            maxStreak: trainEval.maxLossStreak,
            maxDrawdown: trainEval.maxDrawdown,
            maxMarginRequired: trainEval.maxMarginRequired
          },
          validationPerformance: { 
            winRate: valEval.winRate, 
            profit: valEval.totalProfit, 
            profitPerTrade: valEval.profitPerTrade,
            trades: valEval.trades,
            maxStreak: valEval.maxLossStreak,
            maxDrawdown: valEval.maxDrawdown,
            maxMarginRequired: valEval.maxMarginRequired
          }
        });
      }
    });
  });

  return results.sort((a, b) => {
    if (b.recoveryFactor !== a.recoveryFactor) {
      return b.recoveryFactor - a.recoveryFactor;
    }
    if (b.mainPerformance.profit !== a.mainPerformance.profit) {
      return b.mainPerformance.profit - a.mainPerformance.profit;
    }
    return b.stabilityScore - a.stabilityScore;
  });
};

export const backtestCombination = (
  issues: WinGoIssue[], 
  patterns: PatternResult[], 
  minGap: number = 2,
  stopLossStreak: number = 5
) => {
  let trades = 0;
  let wins = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;
  let totalProfit = 0;
  let currentBet = 1;
  let maxMarginRequired = 1;
  
  let currentEquity = 0;
  let peakEquity = 0;
  let maxDrawdown = 0;
  
  let lastTradeIndex = -Number.MAX_VALUE;
  
  // Clustering Tracking
  let consecutiveTrades = 0;
  let maxConsecutiveTrades = 0;

  const colors = issues.map(i => i.color).reverse();

  for (let i = 0; i < colors.length - 5; i++) {
    if (i - lastTradeIndex < minGap) continue;

    let triggered = false;
    let betOn: Color | null = null;
    let patternLength = 0;

    for (const p of patterns) {
        if (i + p.sequence.length >= colors.length) continue;
        const sub = colors.slice(i, i + p.sequence.length);
        const mappedSub = sub.map(c => c === 'red_violet' ? 'red' : c === 'green_violet' ? 'green' : c === 'violet' ? 'red' : c);
        if (mappedSub.every((val, index) => val === p.sequence[index])) {
            triggered = true;
            betOn = p.patternId.split(':')[1] as Color;
            patternLength = p.sequence.length;
            break;
        }
    }

    if (triggered) {
      trades++;
      consecutiveTrades++;
      maxConsecutiveTrades = Math.max(maxConsecutiveTrades, consecutiveTrades);
      lastTradeIndex = i;
      
      const outcome = colors[i + patternLength];
      
      let isWin = false;
      let multiplier = 0;
      const WIN_MULTIPLIER = 1.96;
      const MIX_WIN_MULTIPLIER = 1.47;

      if (betOn === 'red') {
        if (outcome === 'red') {
          isWin = true;
          multiplier = WIN_MULTIPLIER;
        } else if (outcome === 'red_violet') {
          isWin = true;
          multiplier = MIX_WIN_MULTIPLIER;
        }
      } else if (betOn === 'green') {
        if (outcome === 'green') {
          isWin = true;
          multiplier = WIN_MULTIPLIER;
        } else if (outcome === 'green_violet') {
          isWin = true;
          multiplier = MIX_WIN_MULTIPLIER;
        }
      } else if (outcome === betOn) {
        isWin = true;
        multiplier = outcome === 'violet' ? 4.41 : WIN_MULTIPLIER;
      }

      if (isWin) {
        wins++;
        const profit = (currentBet * (multiplier - 1));
        totalProfit += profit;
        currentEquity += profit;
        currentLossStreak = 0;
        currentBet = 1;
      } else {
        totalProfit -= currentBet;
        currentEquity -= currentBet;
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        
        if (currentLossStreak >= stopLossStreak) {
            currentBet = 1;
            currentLossStreak = 0;
        } else {
            currentBet *= 3;
        }
        maxMarginRequired = Math.max(maxMarginRequired, currentBet);
      }
      
      peakEquity = Math.max(peakEquity, currentEquity);
      const drawdown = peakEquity - currentEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    } else {
      consecutiveTrades = 0;
    }
  }

  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const recoveryFactor = maxDrawdown > 0 ? totalProfit / maxDrawdown : totalProfit / 10;

  return {
    trades,
    winRate,
    maxLossStreak,
    maxDrawdown,
    totalProfit,
    recoveryFactor,
    maxMarginRequired,
    maxConsecutiveTrades: maxConsecutiveTrades,
    profitPerTrade: trades > 0 ? totalProfit / trades : 0
  };
};

export const analyzePatternCombinations = (
  issues: WinGoIssue[], 
  topPatterns: PatternResult[], 
  mainSamples: number = 1000, 
  validationSamples: number = 0,
  stopLossStreak: number = 3,
  ghostTrades: number = 0
): PatternCombination[] => {
  const combinations: PatternCombination[] = [];
  
  // 1. REGIME DETECTION
  const currentRegime = detectRegime(issues, 20);

  // 2. FILTERING
  let validPatterns = topPatterns.filter(p => {
    if (p.sessionSuccessRate < 50) return false; // Relaxed from 80
    if (p.mainPerformance.trades < 5) return false; // Relaxed from 10
    return true;
  });

  // Apply Regime Filtering but fallback if it's too strict
  const regimeFilteredPatterns = validPatterns.filter(p => {
    const isTrendPattern = p.sequence.every(color => color === p.sequence[0]) && p.name.endsWith(p.sequence[0][0].toUpperCase());
    const isChopPattern = !isTrendPattern;

    if (currentRegime === 'Trending' && !isTrendPattern) return false;
    if (currentRegime === 'Choppy' && !isChopPattern) return false;
    
    return true;
  });

  if (regimeFilteredPatterns.length >= 2) {
    validPatterns = regimeFilteredPatterns;
  }

  const topN = validPatterns.slice(0, 15); // Kept at 15 to prevent UI freezing when generating dynamic combo sizes
  if (topN.length < 2) return [];

  const validationData = issues.slice(0, validationSamples); 
  const mainData = issues.slice(validationSamples, validationSamples + mainSamples); 

  // 3. COMPATIBILITY CHECK (Eliminate conflicting patterns directly)
  const arePatternsCompatible = (p1: PatternResult, p2: PatternResult) => {
    const seq1 = p1.sequence;
    const seq2 = p2.sequence;
    const bet1 = p1.name.split('→')[1] === 'R' ? 'red' : 'green';
    const bet2 = p2.name.split('→')[1] === 'R' ? 'red' : 'green';

    if (bet1 === bet2) return true; // Same bet target, they don't conflict

    // Different bet targets. Check if one sequence is a suffix of the other.
    const minLen = Math.min(seq1.length, seq2.length);
    const suffix1 = seq1.slice(seq1.length - minLen);
    const suffix2 = seq2.slice(seq2.length - minLen);

    const isMatch = suffix1.every((val, i) => val === suffix2[i]);
    if (isMatch) return false; // They will trigger at the exact same time with different bets -> CONFLICT

    return true;
  };

  // Generate combinations of exactly `size` where ALL patterns are compatible
  const generateCompatibleCombos = (arr: PatternResult[], size: number) => {
    const result: PatternResult[][] = [];
    const f = (prefix: PatternResult[], remaining: PatternResult[]) => {
      if (prefix.length === size) {
        result.push(prefix);
        return;
      }
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const isCompatible = prefix.every(p => arePatternsCompatible(p, candidate));
        if (isCompatible) {
          f([...prefix, candidate], remaining.slice(i + 1));
        }
      }
    };
    f([], arr);
    return result;
  };

  let allCombosToTest: PatternResult[][] = [];
  for (let size = 2; size <= 5; size++) {
    if (topN.length >= size) {
      allCombosToTest = allCombosToTest.concat(generateCompatibleCombos(topN, size));
    }
  }

  allCombosToTest.forEach(combo => {
    const comboName = combo.map(p => p.name).join(' | ');
    const comboId = combo.map(p => p.patternId).join('_');

    const evaluateCombo = (data: WinGoIssue[]) => {
      let trades = 0;
      let wins = 0;
      let currentLossStreak = 0;
      let maxLossStreak = 0;
      let totalProfit = 0;
      let currentBet = 1;
      let maxMarginRequired = 1;
      let liquidationEvents = 0;
      let currentGhostStreak = 0;
      
      let currentEquity = 0;
      let peakEquity = 0;
      let maxDrawdown = 0;

      const colors = data.map(i => i.color).reverse();

      for (let i = 0; i < colors.length; i++) {
        let redSignals = 0;
        let greenSignals = 0;

        for (const pattern of combo) {
          if (i >= pattern.sequence.length) {
            const sub = colors.slice(i - pattern.sequence.length, i);
            const mappedSub = sub.map(c => c === 'red_violet' ? 'red' : c === 'green_violet' ? 'green' : c === 'violet' ? 'red' : c);
            const isMatch = mappedSub.every((val, index) => val === pattern.sequence[index]);

            if (isMatch) {
              const betOn = pattern.name.split('→')[1] === 'R' ? 'red' : 'green';
              if (betOn === 'red') redSignals++;
              if (betOn === 'green') greenSignals++;
            }
          }
        }

        // CONFLICT RESOLUTION (Fail-safe, though pre-filtering should prevent this)
        if (redSignals > 0 && greenSignals > 0) continue;

        // CONFLUENCE
        if (redSignals > 0 || greenSignals > 0) {
          const outcome = colors[i];
          let isWin = false;
          let multiplier = 0;

          if (redSignals > 0) {
            if (outcome === 'red') { isWin = true; multiplier = 1.96; }
            else if (outcome === 'red_violet') { isWin = true; multiplier = 1.47; }
          } else if (greenSignals > 0) {
            if (outcome === 'green') { isWin = true; multiplier = 1.96; }
            else if (outcome === 'green_violet') { isWin = true; multiplier = 1.47; }
          }

          if (currentGhostStreak < ghostTrades) {
            if (!isWin) currentGhostStreak++;
            else currentGhostStreak = 0;
            continue;
          }

          trades++;
          if (isWin) {
            wins++;
            const profit = (currentBet * (multiplier - 1));
            totalProfit += profit;
            currentEquity += profit;
            currentLossStreak = 0;
            currentBet = 1;
            currentGhostStreak = 0;
          } else {
            totalProfit -= currentBet;
            currentEquity -= currentBet;
            currentLossStreak++;
            maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
            
            if (currentLossStreak >= stopLossStreak) {
              liquidationEvents++;
              currentBet = 1;
              currentLossStreak = 0;
              currentGhostStreak = 0;
            } else {
              currentBet *= 3;
            }
            maxMarginRequired = Math.max(maxMarginRequired, currentBet);
          }
          
          peakEquity = Math.max(peakEquity, currentEquity);
          maxDrawdown = Math.max(maxDrawdown, peakEquity - currentEquity);
        } else {
          currentGhostStreak = 0; // Reset ghost streak on gap
        }
      }

      return {
        trades, wins, winRate: trades > 0 ? (wins / trades) * 100 : 0,
        totalProfit, maxLossStreak, maxMarginRequired, maxDrawdown, liquidationEvents
      };
    };

    const trainEval = evaluateCombo(mainData);
    const valEval = evaluateCombo(validationData);

    const totalTrades = trainEval.trades + valEval.trades;
    if (totalTrades < 30) return;

    const totalWins = trainEval.wins + valEval.wins;
    const combinedWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    const totalProfit = trainEval.totalProfit + valEval.totalProfit;
    const maxDrawdown = Math.max(trainEval.maxDrawdown, valEval.maxDrawdown);
    
    const estimatedSessions = Math.max(1, Math.floor(trainEval.trades / 10));
    const sessionSuccessRate = trainEval.trades > 0 ? 
      Math.max(0, 100 - ((trainEval.liquidationEvents / Math.max(1, trainEval.trades)) * 100)) : 0;

    let riskLevel: 'Safe' | 'Moderate' | 'Risky' | 'Unstable' = 'Risky';
    if (totalProfit < 0) {
      riskLevel = 'Unstable';
    } else if (sessionSuccessRate >= 90 && trainEval.trades >= 30 && totalProfit > 0) {
      riskLevel = 'Safe';
    } else if (sessionSuccessRate >= 70 && totalProfit > 0) {
      riskLevel = 'Moderate';
    }

    // Stability score should penalize negative profit
    const profitFactor = totalProfit > 0 ? 1 : 0;
    const stabilityScore = sessionSuccessRate * profitFactor;

    // Recency Filter: Reject if the combination lost 2 out of its last 3 trades
    let recentLosses = 0;
    let recentTrades = 0;
    const recentColors = mainData.map(i => i.color).reverse();
    
    for (let i = recentColors.length - 1; i >= 0 && recentTrades < 3; i--) {
      let redSignals = 0;
      let greenSignals = 0;

      for (const pattern of combo) {
        if (i >= pattern.sequence.length) {
          const sub = recentColors.slice(i - pattern.sequence.length, i);
          const mappedSub = sub.map(c => c === 'red_violet' ? 'red' : c === 'green_violet' ? 'green' : c === 'violet' ? 'red' : c);
          const isMatch = mappedSub.every((val, index) => val === pattern.sequence[index]);

          if (isMatch) {
            const betOn = pattern.name.split('→')[1] === 'R' ? 'red' : 'green';
            if (betOn === 'red') redSignals++;
            if (betOn === 'green') greenSignals++;
          }
        }
      }

      if (redSignals > 0 && greenSignals > 0) continue;

      if (redSignals > 0 || greenSignals > 0) {
        recentTrades++;
        const outcome = recentColors[i];
        let isWin = false;

        if (redSignals > 0 && (outcome === 'red' || outcome === 'red_violet')) isWin = true;
        else if (greenSignals > 0 && (outcome === 'green' || outcome === 'green_violet')) isWin = true;

        if (!isWin) recentLosses++;
      }
    }

    if (recentTrades >= 3 && recentLosses >= 2) {
      return; // Reject decayed combination
    }

    // Only include profitable combinations
    if (totalProfit <= 0) return;

    combinations.push({
      id: comboId,
      name: comboName,
      patterns: combo,
      totalOccurrences: totalTrades,
      winRate: combinedWinRate,
      maxLossStreak: Math.max(trainEval.maxLossStreak, valEval.maxLossStreak),
      maxDrawdown,
      recoveryFactor: maxDrawdown > 0 ? totalProfit / maxDrawdown : totalProfit,
      stabilityScore,
      maxMarginRequired: Math.max(trainEval.maxMarginRequired, valEval.maxMarginRequired),
      riskLevel,
      confidenceScore: Math.min(100, (totalTrades / 50) * 100),
      reliabilityScore: sessionSuccessRate,
      tradeDensity: totalTrades / issues.length,
      mainPerformance: {
        winRate: trainEval.winRate,
        profit: trainEval.totalProfit,
        profitPerTrade: trainEval.trades > 0 ? trainEval.totalProfit / trainEval.trades : 0,
        trades: trainEval.trades,
        maxStreak: trainEval.maxLossStreak,
        maxDrawdown: trainEval.maxDrawdown,
        maxMarginRequired: trainEval.maxMarginRequired
      },
      validationPerformance: {
        winRate: valEval.winRate,
        profit: valEval.totalProfit,
        profitPerTrade: valEval.trades > 0 ? valEval.totalProfit / valEval.trades : 0,
        trades: valEval.trades,
        maxStreak: valEval.maxLossStreak,
        maxDrawdown: valEval.maxDrawdown,
        maxMarginRequired: valEval.maxMarginRequired
      }
    });
  });

  return combinations.sort((a, b) => {
    const riskWeight = { 'Safe': 4, 'Moderate': 3, 'Risky': 2, 'Unstable': 1 };
    if (riskWeight[a.riskLevel] !== riskWeight[b.riskLevel]) {
      return riskWeight[b.riskLevel] - riskWeight[a.riskLevel];
    }
    if (b.stabilityScore !== a.stabilityScore) {
      return b.stabilityScore - a.stabilityScore;
    }
    return b.mainPerformance.profit - a.mainPerformance.profit;
  });
};

export const runBacktest = (
  issues: WinGoIssue[], 
  pattern: string[], 
  betOn: Color,
  stopLossStreak: number = 5
): BacktestResult => {
  let balance = 100; // Starting balance adjusted for base bet 1
  let trades = 0;
  let wins = 0;
  let maxLossStreak = 0;
  let currentLossStreak = 0;
  let currentBet = 1;
  let maxMarginRequired = 1;
  
  let currentEquity = 100;
  let peakEquity = 100;
  let maxDrawdown = 0;
  
  const WIN_MULTIPLIER = 1.96;
  const MIX_WIN_MULTIPLIER = 1.47;
  
  const colors = issues.map(i => i.color).reverse();

  for (let i = 0; i < colors.length - pattern.length - 1; i++) {
    const sub = colors.slice(i, i + pattern.length);
    const mappedSub = sub.map(c => c === 'red_violet' ? 'red' : c === 'green_violet' ? 'green' : c === 'violet' ? 'red' : c);
    if (mappedSub.every((val, index) => val === pattern[index])) {
      trades++;
      const outcome = colors[i + pattern.length];
      
      let isWin = false;
      let multiplier = 0;

      if (betOn === 'red') {
        if (outcome === 'red') {
          isWin = true;
          multiplier = WIN_MULTIPLIER;
        } else if (outcome === 'red_violet') {
          isWin = true;
          multiplier = MIX_WIN_MULTIPLIER;
        }
      } else if (betOn === 'green') {
        if (outcome === 'green') {
          isWin = true;
          multiplier = WIN_MULTIPLIER;
        } else if (outcome === 'green_violet') {
          isWin = true;
          multiplier = MIX_WIN_MULTIPLIER;
        }
      } else if (outcome === betOn) {
        isWin = true;
        multiplier = outcome === 'violet' ? 4.41 : WIN_MULTIPLIER;
      }

      if (isWin) {
        wins++;
        const profit = (currentBet * (multiplier - 1));
        balance += profit;
        currentEquity += profit;
        currentLossStreak = 0;
        currentBet = 1;
      } else {
        balance -= currentBet;
        currentEquity -= currentBet;
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        
        if (currentLossStreak >= stopLossStreak) {
            currentBet = 1;
            currentLossStreak = 0;
        } else {
            currentBet *= 3;
        }
        maxMarginRequired = Math.max(maxMarginRequired, currentBet);
      }
      
      peakEquity = Math.max(peakEquity, currentEquity);
      const drawdown = peakEquity - currentEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }

  const totalProfit = balance - 100;
  const recoveryFactor = maxDrawdown > 0 ? totalProfit / maxDrawdown : totalProfit / 1;

  // Worst case
  let worstCaseLoss = 0;
  let tempBet = 1;
  for (let s = 0; s < stopLossStreak; s++) {
    worstCaseLoss += tempBet;
    tempBet *= 3;
  }

  return {
    totalProfit: Math.round(totalProfit * 100) / 100,
    winRate: trades > 0 ? (wins / trades) * 100 : 0,
    maxLossStreak,
    trades,
    maxMarginRequired,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    recoveryFactor: Math.round(recoveryFactor * 100) / 100,
    maxPossibleLoss: worstCaseLoss,
    capitalRequired: worstCaseLoss
  };
};

export const getPartialMatches = (issues: WinGoIssue[], patterns: PatternResult[]) => {
  if (issues.length === 0 || patterns.length === 0) return [];
  
  const history = issues.slice(0, 5).map(i => i.color).reverse(); 
  
  return patterns.map(p => {
    const seq = p.sequence;
    let matchLength = 0;
    
    for (let len = Math.min(seq.length - 1, history.length); len > 0; len--) {
      const patternPart = seq.slice(0, len);
      const historyPart = history.slice(history.length - len);
      
      if (patternPart.every((val, idx) => val === historyPart[idx])) {
        matchLength = len;
        break;
      }
    }
    
    return {
      ...p,
      matchLength,
      matchPercentage: Math.round((matchLength / seq.length) * 100)
    };
  }).filter(p => p.matchLength > 0)
    .sort((a, b) => b.matchPercentage - a.matchPercentage || b.stabilityScore - a.stabilityScore)
    .slice(0, 6);
};
