import fs from 'node:fs';
import path from 'node:path';

export const writeFiles = (root, files) => {
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
};
