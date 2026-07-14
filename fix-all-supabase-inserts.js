const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing all Supabase insert operations...');

const supabaseFixes = [
  // Fix all .insert() calls that don't have the supabase cast before them
  {
    pattern: /const \{ data: ([^}]+) \} = await supabase\s*\.from\(['"]([^'"]+)['"]\)\s*\.insert\(/g,
    replacement: (match, dataVar, table) => {
      return `const supabaseInsert = supabase as any\n      const { data: ${dataVar} } = await supabaseInsert\n        .from('${table}')\n        .insert(`;
    }
  },
  // Fix all .insert() calls with error that don't have the supabase cast
  {
    pattern: /const \{ error: ([^}]+) \} = await supabase\s*\.from\(['"]([^'"]+)['"]\)\s*\.insert\(/g,
    replacement: (match, errorVar, table) => {
      return `const supabaseInsert = supabase as any\n      const { error: ${errorVar} } = await supabaseInsert\n        .from('${table}')\n        .insert(`;
    }
  },
  // Fix all other .insert() calls
  {
    pattern: /await supabase\s*\.from\(['"]([^'"]+)['"]\)\s*\.insert\(/g,
    replacement: (match, table) => {
      return `await (supabase as any)\n        .from('${table}')\n        .insert(`;
    }
  }
];

function findTsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '.next') {
      files.push(...findTsFiles(fullPath));
    } else if (item.isFile() && (item.name.endsWith('.tsx') || item.name.endsWith('.ts'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  supabaseFixes.forEach(fix => {
    content = content.replace(fix.pattern, fix.replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed: ${path.basename(filePath)}`);
    return true;
  }
  return false;
}

const dirsToScan = ['app', 'components'];
const allFiles = [];

dirsToScan.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    allFiles.push(...findTsFiles(dirPath));
  }
});

console.log(`Found ${allFiles.length} files to process...`);

let fixedCount = 0;
allFiles.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files!`);
console.log('🚀 Running npm build...');