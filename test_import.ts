async function test() {
  const mod = await import('pdf-parse');
  console.log("Keys:", Object.keys(mod));
  console.log("Is default function?", typeof mod.default === 'function');
  console.log("Is mod function?", typeof mod === 'function');
}
test();
