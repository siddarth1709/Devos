import { DevosApiClient } from '../api.js';

export interface AuthOptions {
  action: 'login' | 'logout' | 'whoami';
  apiUrl?: string;
  json?: boolean;
}

export async function runAuth(options: AuthOptions): Promise<number> {
  const client = new DevosApiClient(options.apiUrl);

  if (options.action === 'logout') {
    await client.logout();
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: true, message: 'Logged out' }) + '\n');
    } else {
      process.stdout.write('Successfully logged out.\n');
    }
    return 0;
  }

  if (options.action === 'login') {
    const rawUrl = options.apiUrl || process.env.DEVOS_API_URL || 'http://127.0.0.1:3000';
    const loginUrl = `${rawUrl.replace(/\/+$/, '')}/api/auth/github`;
    if (options.json) {
      process.stdout.write(JSON.stringify({ loginUrl }) + '\n');
    } else {
      process.stdout.write(`To login with GitHub, open the following URL in your browser:\n${loginUrl}\n`);
    }
    return 0;
  }

  try {
    const user = await client.getAuthStatus();
    if (options.json) {
      process.stdout.write(JSON.stringify(user, null, 2) + '\n');
    } else {
      process.stdout.write(`Logged in as: ${user.user?.name || user.user?.login || user.user?.email || 'Unknown'}\n`);
    }
    return 0;
  } catch {
    if (options.json) {
      process.stdout.write(JSON.stringify({ authenticated: false }) + '\n');
    } else {
      process.stdout.write('Not currently logged in. Run "devos login" to authenticate.\n');
    }
    return 1;
  }
}

