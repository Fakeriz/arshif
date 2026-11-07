/**
 * Data aplikasi tidak ikut backup cloud MAUPUN transfer antar perangkat (Android 12+).
 * `android.allowBackup: false` di app.json hanya mematikan backup cloud; transfer perangkat ke perangkat (D2D)
 * tetap jalan di Android 12+ kecuali dataExtractionRules mengecualikannya. Data yang dilindungi: sesi login
 * Supabase (AsyncStorage) dan teks notifikasi bank yang antre (SharedPreferences Smart Log).
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external'];
const excludeAll = DOMAINS.map((d) => `    <exclude domain="${d}" path="." />`).join('\n');

const RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludeAll}
  </cloud-backup>
  <device-transfer>
${excludeAll}
  </device-transfer>
</data-extraction-rules>
`;

/** Pasang atribut dataExtractionRules (Android 12+) dan allowBackup=false pada <application>. */
function applyToManifest(manifest) {
  const app = manifest.manifest.application[0];
  app.$['android:allowBackup'] = 'false';
  app.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
  return manifest;
}

const withNoDataExtraction = (config) => {
  config = withAndroidManifest(config, (c) => {
    applyToManifest(c.modResults);
    return c;
  });
  return withDangerousMod(config, [
    'android',
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'data_extraction_rules.xml'), RULES_XML);
      return c;
    },
  ]);
};

module.exports = withNoDataExtraction;
module.exports.RULES_XML = RULES_XML;
module.exports.applyToManifest = applyToManifest;
