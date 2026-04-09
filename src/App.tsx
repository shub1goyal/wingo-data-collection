import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <Dashboard activeTab={activeTab} onTabChange={setActiveTab} />
    </Layout>
  );
}
