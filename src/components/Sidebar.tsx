import React from 'react';
import { LayoutDashboard, BarChart3, Layers, History, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analysis', label: 'Pattern Analysis', icon: BarChart3 },
  { id: 'combinations', label: 'Combinations', icon: Layers },
  { id: 'backtest', label: 'Backtesting', icon: History },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden md:flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          WinGo Analyzer
        </h1>
        <p className="text-xs text-zinc-500 mt-1">Quant Analysis System</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === item.id 
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50" 
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50"
            )}
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <button className="flex items-center w-full px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Settings className="mr-3 h-5 w-5" />
          Settings
        </button>
      </div>
    </aside>
  );
};
