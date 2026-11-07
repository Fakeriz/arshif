/**
 * Audit 12: sesi login dan teks notifikasi bank tidak boleh ikut backup Android atau transfer antar perangkat.
 * Audit 17: panel admin web tidak boleh dimuat di dalam situs lain (clickjacking).
 */
import appJson from '../../app.json';
import vercel from '../../vercel.json';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../../plugins/withNoDataExtraction') as {
  RULES_XML: string;
  applyToManifest: (m: { manifest: { application: { $: Record<string, string> }[] } }) => unknown;
};

describe('backup Android dimatikan', () => {
  it('app.json: allowBackup false dan plugin dataExtractionRules terpasang', () => {
    expect(appJson.expo.android.allowBackup).toBe(false);
    expect(appJson.expo.plugins).toContain('./plugins/withNoDataExtraction');
  });

  it('manifest: allowBackup=false + dataExtractionRules (Android 12+ transfer perangkat)', () => {
    const manifest = { manifest: { application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' } }] } };
    plugin.applyToManifest(manifest);
    expect(manifest.manifest.application[0].$).toMatchObject({
      'android:allowBackup': 'false',
      'android:dataExtractionRules': '@xml/data_extraction_rules',
    });
  });

  it('aturan: semua domain dikecualikan dari backup cloud DAN transfer perangkat', () => {
    for (const section of ['cloud-backup', 'device-transfer']) {
      const body = plugin.RULES_XML.split(`<${section}>`)[1]?.split(`</${section}>`)[0] ?? '';
      // sharedpref = antrean notifikasi bank (Smart Log); database/file = AsyncStorage berisi sesi login.
      for (const domain of ['root', 'file', 'database', 'sharedpref', 'external']) expect(body).toContain(`<exclude domain="${domain}" path="." />`);
    }
  });
});

describe('web: panel admin tidak bisa dimuat di dalam situs lain (audit 17)', () => {
  it('semua rute mengirim X-Frame-Options DENY dan CSP frame-ancestors none', () => {
    const all = vercel.headers.find((h) => h.source === '/(.*)');
    expect(all?.headers).toEqual(
      expect.arrayContaining([
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      ]),
    );
    // Rewrite SPA tetap ada (rute /admin dan lainnya tetap terbuka langsung).
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });
});
