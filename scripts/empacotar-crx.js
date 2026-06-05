/**
 * empacotar-crx.js
 * 
 * Empacota a extensão Chrome como .crx3 usando a chave key.pem existente.
 * Mantém o Extension ID: ebompnbhkfmbcjhmddjkfghjgckjplbm
 * 
 * Pré-requisito: npm install -g crx3
 * Uso:           node scripts/empacotar-crx.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const KEY_PATH     = path.join(ROOT, 'key.pem');
const DIST_DIR     = path.join(ROOT, 'dist');

// ── 1. Verificações ───────────────────────────────────────────────────────
if (!fs.existsSync(KEY_PATH)) {
  console.error('❌ key.pem não encontrado. Rode primeiro: scripts/extrair-chave-manifest.js');
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('❌ manifest.json não encontrado.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

if (!manifest.key) {
  console.warn('⚠️  manifest.json não tem campo "key". Execute scripts/extrair-chave-manifest.js primeiro.');
  console.warn('   Continuando — o Extension ID pode diferir do esperado.');
}

const version = manifest.version;
console.log(`📦 Empacotando Sigma Operator v${version}...`);

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

const CRX_PATH = path.join(DIST_DIR, `sigma-operator-extension-v${version}.crx`);
const ZIP_PATH = path.join(DIST_DIR, `sigma-operator-extension-v${version}.zip`);

// ── 2. Empacotar ──────────────────────────────────────────────────────────
let crx3;
try {
  crx3 = require('crx3');
} catch {
  console.error('❌ Pacote crx3 não encontrado.');
  console.error('   Execute: npm install -g crx3');
  console.error('   Ou:      npm install crx3  (local no projeto)');
  process.exit(1);
}

crx3([ROOT], {
  keyPath: KEY_PATH,
  crxPath: CRX_PATH,
  zipPath: ZIP_PATH,
}).then(() => {
  const crxSize = (fs.statSync(CRX_PATH).size / 1024).toFixed(1);
  const zipSize = (fs.statSync(ZIP_PATH).size / 1024).toFixed(1);

  console.log('');
  console.log(`✅ .crx gerado: ${CRX_PATH}`);
  console.log(`   Tamanho: ${crxSize} KB`);
  console.log('');
  console.log(`✅ .zip gerado: ${ZIP_PATH}`);
  console.log(`   Tamanho: ${zipSize} KB`);
  console.log('');
  console.log('Próximos passos:');
  console.log(`  1. Criar Release v${version} no GitHub`);
  console.log(`  2. Anexar: sigma-operator-extension-v${version}.crx`);
  console.log(`  3. Atualizar releases/update.xml com a nova URL e version`);
  console.log(`  4. Commit e push do update.xml no branch main`);
}).catch(err => {
  console.error('❌ Erro ao empacotar:', err.message);
  process.exit(1);
});
