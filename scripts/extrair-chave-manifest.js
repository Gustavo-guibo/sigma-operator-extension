/**
 * extrair-chave-manifest.js
 * 
 * Extrai a chave pública do key.pem e insere no manifest.json.
 * Isso fixa o Extension ID ebompnbhkfmbcjhmddjkfghjgckjplbm
 * independente de como a extensão for carregada.
 * 
 * Uso: node scripts/extrair-chave-manifest.js
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const ROOT         = path.resolve(__dirname, '..');
const PEM_PATH     = path.join(ROOT, 'key.pem');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');

// ── 1. Verificações ───────────────────────────────────────────────────────
if (!fs.existsSync(PEM_PATH)) {
  console.error('❌ key.pem não encontrado em:', PEM_PATH);
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('❌ manifest.json não encontrado em:', MANIFEST_PATH);
  process.exit(1);
}

// ── 2. Extrair chave pública DER → base64 ─────────────────────────────────
let keyBase64;
try {
  const pem        = fs.readFileSync(PEM_PATH, 'utf8');
  const privateKey = crypto.createPrivateKey(pem);
  const publicKey  = crypto.createPublicKey(privateKey);
  const pubKeyDer  = publicKey.export({ type: 'spki', format: 'der' });
  keyBase64 = pubKeyDer.toString('base64');
} catch (err) {
  console.error('❌ Erro ao extrair chave pública:', err.message);
  process.exit(1);
}

// ── 3. Inserir no manifest ────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

if (manifest.key && manifest.key === keyBase64) {
  console.log('ℹ️  Campo "key" já está no manifest.json e é idêntico. Nada alterado.');
  process.exit(0);
}

manifest.key = keyBase64;

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

// ── 4. Verificação ────────────────────────────────────────────────────────
console.log('✅ Campo "key" inserido/atualizado no manifest.json');
console.log('   Primeiros 60 chars:', keyBase64.substring(0, 60) + '...');
console.log('   Comprimento total:', keyBase64.length, 'chars');
console.log('');
console.log('ℹ️  O Extension ID permanece: ebompnbhkfmbcjhmddjkfghjgckjplbm');
console.log('ℹ️  Commit o manifest.json atualizado. Nunca commitar o key.pem.');
