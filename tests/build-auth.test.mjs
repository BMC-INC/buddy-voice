import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const identity = require('@azure/identity');
const msal = require('@azure/msal-node');

test('patched build-only authentication libraries retain the packaging tool interfaces', () => {
  // Construct exactly the credential chain VSCE consumes. Do not request tokens.
  const chain = new identity.ChainedTokenCredential(
    new identity.EnvironmentCredential(), new identity.AzureCliCredential(),
    new identity.ManagedIdentityCredential({ clientId: undefined }),
    new identity.AzurePowerShellCredential({ tenantId: undefined }),
    new identity.AzureDeveloperCliCredential({ tenantId: undefined }),
  );
  const clientId = '22222222-2222-2222-2222-222222222222';
  const secret = new identity.ClientSecretCredential('11111111-1111-1111-1111-111111111111', clientId, 'synthetic-unused');
  const publicApp = new msal.PublicClientApplication({ auth: { clientId } });
  const privateApp = new msal.ConfidentialClientApplication({ auth: { clientId, clientSecret: 'synthetic-unused' } });
  for (const credential of [chain, secret]) assert.equal(typeof credential.getToken, 'function');
  assert.equal(typeof publicApp.acquireTokenInteractive, 'function');
  assert.equal(typeof privateApp.acquireTokenByClientCredential, 'function');
});
