import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Campaigns } from './pages/Campaigns';
import { Conversations } from './pages/Conversations';
import { QualifiedLeads } from './pages/QualifiedLeads';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { EmailTemplates } from './pages/EmailTemplates';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="templates" element={<EmailTemplates />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="qualified" element={<QualifiedLeads />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
