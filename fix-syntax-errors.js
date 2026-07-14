const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing syntax errors from previous script...');

const syntaxFixes = [
  // Fix double parentheses issues
  {
    pattern: /\}\)\s+as any\)\)/g,
    replacement: '} as any)'
  },
  // Fix property access with parentheses
  {
    pattern: /(\w+)\.\((\w+) as any\)/g,
    replacement: '($1.$2 as any)'
  },
  // Fix student.enrollment syntax errors
  {
    pattern: /student\.\(enrollment as any\)/g,
    replacement: '(student.enrollment as any)'
  },
  // Fix similar patterns
  {
    pattern: /\.(\w+)\.\((\w+) as any\)/g,
    replacement: '.$1.$2 as any'
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

  syntaxFixes.forEach(fix => {
    content = content.replace(fix.pattern, fix.replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed: ${filePath}`);
    return true;
  }
  return false;
}

const appDir = path.join(__dirname, 'app');
const files = findTsFiles(appDir);
console.log(`Found ${files.length} files to process...`);

let fixedCount = 0;
files.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files with syntax errors!`);
console.log('🚀 Running npm build...');