import { Bot, GitBranch, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const mcpConfig = `{
  "mcpServers": {
    "devassets": {
      "command": "devassets",
      "args": ["serve"]
    }
  }
}`;

const ciConfig = `- name: Check assets
  run: devassets check $PROJECT --env=production --fail-on-risk`;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-background/60 border border-border rounded-lg p-3 text-xs text-green-300 overflow-x-auto font-mono">
      {children}
    </pre>
  );
}

const storage = [
  { label: 'Database', path: '~/.devassets/devassets.db' },
  { label: 'Signing key', path: '~/.devassets/signature.key' },
  { label: 'Permissions', path: '~/.devassets/permissions.yml' },
];

export default function Settings() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Integration snippets and local storage.</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" />MCP Server (Claude Code / Cursor)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              Add to your <code className="text-amber-400 font-mono">.claude/settings.json</code> to enable AI-powered asset management:
            </p>
            <CodeBlock>{mcpConfig}</CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4 text-primary" />CI/CD Integration</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">Gate deployments in GitHub Actions or any CI pipeline:</p>
            <CodeBlock>{ciConfig}</CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><HardDrive className="h-4 w-4 text-primary" />Local Storage</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm">
            {storage.map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-muted-foreground w-28 shrink-0">{s.label}</span>
                <code className="text-foreground/80 font-mono text-xs">{s.path}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
