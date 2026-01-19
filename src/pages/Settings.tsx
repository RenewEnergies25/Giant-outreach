import { useState, useEffect } from 'react';
import { Key, Check, X, RefreshCw, Zap, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { supabase } from '../lib/supabase';
import { InstantlyConfig } from '../types/database';
import { toast } from 'sonner';

export function Settings() {
  const [instantlyConfig, setInstantlyConfig] = useState<InstantlyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('instantly_config')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setInstantlyConfig(data);
        setApiKey(data.api_key || '');
        setWorkspaceId(data.workspace_id || '');
        if (data.is_active && data.api_key) {
          setConnectionStatus('connected');
        }
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!apiKey.trim()) {
      toast.error('API key is required');
      return;
    }

    try {
      setSaving(true);

      const configData = {
        api_key: apiKey.trim(),
        workspace_id: workspaceId.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (instantlyConfig) {
        // Update existing
        const { error } = await supabase
          .from('instantly_config')
          .update(configData)
          .eq('id', instantlyConfig.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('instantly_config')
          .insert(configData);

        if (error) throw error;
      }

      toast.success('Settings saved successfully');
      fetchConfig();
    } catch (err) {
      console.error('Failed to save config:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!apiKey.trim()) {
      toast.error('Enter an API key first');
      return;
    }

    try {
      setTesting(true);
      setConnectionStatus('unknown');

      // Call edge function to test connection
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instantly-test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ api_key: apiKey.trim() }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setConnectionStatus('connected');
        toast.success('Connected to Instantly successfully');
      } else {
        setConnectionStatus('error');
        toast.error(result.error || 'Failed to connect to Instantly');
      }
    } catch (err) {
      setConnectionStatus('error');
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instantly-webhook`;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure integrations and system settings
        </p>
      </div>

      <Tabs defaultValue="instantly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="instantly">
            <Zap className="h-4 w-4 mr-2" />
            Instantly
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Email Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instantly" className="space-y-6">
          {/* Connection Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Instantly.ai Integration
                  </CardTitle>
                  <CardDescription>
                    Connect your Instantly account to send email campaigns
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={
                    connectionStatus === 'connected'
                      ? 'bg-green-500/10 text-green-500 border-green-500/20'
                      : connectionStatus === 'error'
                      ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                  }
                >
                  {connectionStatus === 'connected' && <Check className="h-3 w-3 mr-1" />}
                  {connectionStatus === 'error' && <X className="h-3 w-3 mr-1" />}
                  {connectionStatus === 'connected'
                    ? 'Connected'
                    : connectionStatus === 'error'
                    ? 'Connection Failed'
                    : 'Not Connected'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="h-32 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="api_key">API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="api_key"
                          type="password"
                          placeholder="Enter your Instantly API key"
                          className="pl-10"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={testConnection}
                        disabled={testing || !apiKey.trim()}
                      >
                        {testing ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Test'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Find your API key in Instantly Settings &gt; API &gt; Create API Key
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workspace_id">Workspace ID (Optional)</Label>
                    <Input
                      id="workspace_id"
                      placeholder="Enter workspace ID if using multiple workspaces"
                      value={workspaceId}
                      onChange={(e) => setWorkspaceId(e.target.value)}
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium">Webhook URL</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Add this URL to Instantly webhooks to receive email events
                    </p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={webhookUrl}
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(webhookUrl);
                          toast.success('Webhook URL copied');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={saveConfig} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* API Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">API Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">API Version</p>
                  <p className="font-medium">V2</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Required Plan</p>
                  <p className="font-medium">Growth or above</p>
                </div>
                <div>
                  <p className="text-muted-foreground">API Documentation</p>
                  <a
                    href="https://developer.instantly.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-500 hover:underline"
                  >
                    developer.instantly.ai
                  </a>
                </div>
                <div>
                  <p className="text-muted-foreground">Rate Limit</p>
                  <p className="font-medium">30 emails/inbox/day (recommended)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Configuration
              </CardTitle>
              <CardDescription>
                Default settings for email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="from_name">Default From Name</Label>
                <Input
                  id="from_name"
                  placeholder="Your Name or Company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reply_to">Default Reply-To Email</Label>
                <Input
                  id="reply_to"
                  type="email"
                  placeholder="replies@yourcompany.com"
                />
              </div>
              <div className="flex justify-end pt-4">
                <Button>Save Email Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
