const yaml = require('js-yaml');
const { readFileSync } = require('fs');

const files = ['./Pulumi.alpha.yaml', './Pulumi.prod.yaml'];

function* iterate(instance, path = '') {
  if (typeof instance === 'object') {
    const keys = Object.keys(instance);
    for (const key of keys) {
      const value = instance[key];
      if (typeof value === 'string' || typeof value === 'number') {
        yield {
          key,
          value,
          path,
        };
      }
    }
    for (const key of keys) {
      const value = instance[key];
      if (typeof value === 'object') {
        yield* iterate(value, path + '.' + key);
      }
    }
  }
}

function mask(file) {
  const text = readFileSync(file, 'utf8');
  const data = yaml.safeLoad(text);
  const values = Array.from(iterate(data));
  values.forEach((item) => {
    console.log(`::add-mask::${item.value}`);
  });
}

files.forEach(mask);
