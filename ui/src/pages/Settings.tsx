export default function Settings() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      <div className="space-y-4">
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">MCP Server (Claude Code Integration)</h2>
          <p className="text-sm text-gray-400 mb-3">
            Add to your <code className="text-yellow-400">.claude/settings.json</code> to enable AI-powered asset management:
          </p>
          <pre className="bg-gray-950 border border-gray-700 rounded p-3 text-xs text-green-300 overflow-x-auto">
{`{
  "mcpServers": {
    "devassets": {
      "command": "devassets",
      "args": ["serve"]
    }
  }
}`}
          </pre>
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">CI/CD Integration</h2>
          <p className="text-sm text-gray-400 mb-3">
            Add to your GitHub Actions or CI pipeline to gate deployments:
          </p>
          <pre className="bg-gray-950 border border-gray-700 rounded p-3 text-xs text-green-300 overflow-x-auto">
{`- name: Check assets
  run: devassets check $PROJECT --env=production --fail-on-risk`}
          </pre>
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Storage</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 w-28">Database</span>
              <code className="text-gray-300 font-mono text-xs">~/.devassets/devassets.db</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 w-28">Signing key</span>
              <code className="text-gray-300 font-mono text-xs">~/.devassets/signature.key</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 w-28">Permissions</span>
              <code className="text-gray-300 font-mono text-xs">~/.devassets/permissions.yml</code>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
