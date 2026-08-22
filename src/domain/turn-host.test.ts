import { describe, expect, it } from 'vitest';
import {
  INSTALL_TURN_SCRIPT_URL,
  generateHostCommands,
  iceServersFromTurnHost,
  installCommand,
  sshCommand,
  validateTurnHost,
} from './turn-host.ts';

describe('turn host console commands', () => {
  it('rejects a URL in the host field', () => {
    const result = validateTurnHost({
      host: 'https://vps.example',
      sshUser: 'root',
    });
    expect(result.ok).toBe(false);
  });

  it('prints ssh then curl to the repo installer', () => {
    const draft = { host: '203.0.113.10', sshUser: 'ubuntu' };
    const text = generateHostCommands(draft);
    expect(sshCommand(draft)).toBe('ssh ubuntu@203.0.113.10');
    expect(installCommand()).toContain('deploy/install-turn.sh');
    expect(INSTALL_TURN_SCRIPT_URL).toContain(
      '/org-event/pwa-no-cloud/main/deploy/install-turn.sh',
    );
    expect(text).toContain('ssh ubuntu@203.0.113.10');
    expect(text).toContain('| sudo bash');
    expect(text).not.toContain('user=nocloud:');
  });

  it('builds ice URLs for 80 and 443', () => {
    const ice = iceServersFromTurnHost(
      '203.0.113.10',
      'nocloud',
      'secret12',
      [80, 443],
    );
    expect(ice[0]?.urls).toBe('stun:203.0.113.10:80');
    expect(ice[1]?.urls).toContain('turn:203.0.113.10:443?transport=tcp');
  });
});
