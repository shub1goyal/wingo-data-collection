import React from 'react';
import { Calendar, Filter, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export const Header: React.FC = () => {
  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-md px-3 py-1.5">
          <Calendar className="h-4 w-4 text-zinc-500 mr-2" />
          <span className="text-sm font-medium">April 08, 2026</span>
        </div>
      </div>
    </header>
  );
};
