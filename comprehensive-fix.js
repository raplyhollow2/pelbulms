const fs = require('fs');
const path = require('path');

console.log('🔧 Running comprehensive syntax fix...');

const fixes = [
  // Fix double closing parentheses after 'as any'
  {
    pattern: /\}\s+as\s+any\)\)/g,
    replacement: '} as any)'
  },
  // Fix setSomething([...something, item] as Type))
  {
    pattern: /(\]\s+as\s+\w+\]\)\)/g,
    replacement: '] as any)'
  },
  // Fix { ...object } as any))
  {
    pattern: /\}\s+as\s+any\)\)/g,
    replacement: '} as any)'
  },
  // Fix property access like object.(property as any)
  {
    pattern: /\.(\w+)\.\((\w+)\s+as\s+any\)/g,
    replacement: '($1.$2 as any)'
  },
  // Fix data.(session.user as any)
  {
    pattern: /\.(\w+)\.\((\w+\.\w+)\s+as\s+any\)/g,
    replacement: '($1.$2 as any)'
  },
  // Fix setSomething({...something} as any)) - missing closing parent
  {
    pattern: /set(\w+)\(\{[^}]*\}\s+as\s+any\)\)/g,
    replacement: 'set$1($2 as any)'
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
  let fixCount = 0;

  fixes.forEach(fix => {
    const newContent = content.replace(fix.pattern, fix.replacement);
    if (newContent !== content) {
      fixCount++;
      content = newContent;
    }
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed ${fixCount} issues in: ${path.basename(filePath)}`);
    return true;
  }
  return false;
}

const appDir = path.join(__dirname, 'app');
const files = findTsFiles(appDir);
console.log(`Scanning ${files.length} files...`);

let fixedCount = 0;
files.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files!`);
console.log('🚀 Running final build...');