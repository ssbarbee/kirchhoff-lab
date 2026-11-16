#!/bin/sh
set -e
cd "$(dirname "$0")"
OUT=index.html
{ cat src/head.html; grep -v "^if (typeof module" src/core.js; cat src/view.js src/pages.js src/app.js; printf '</script>\n</body>\n</html>\n'; } > "$OUT"
node -e "
const fs=require('fs');const h=fs.readFileSync('$OUT','utf8');
const js=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));
try{new Function(js);console.log('syntax ok,',(h.length/1024).toFixed(0),'KB')}catch(e){console.log('SYNTAX',e.message)}"
