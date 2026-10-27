// Проверка гипотезы: зависание = блокировка event loop + буферизация stderr при перенаправлении в файл
const t0 = Date.now(); let last = t0;
const mark = (m: string) => { const n = Date.now(); process.stderr.write(`[FLUSH] ${m} +${n - last}ms total=${n - t0}ms\n`); last = n; };
mark('start');
console.error('[FLUSH] console.error message 1');
for (let i = 0; i < 20; i++) {
  const s = 'x'.repeat(5 * 1024 * 1024); // 5 МБ строка
  JSON.parse(JSON.stringify({ a: s }));   // тяжёлая синхронная операция ~event loop block
}
mark('after-30s-sync-block');
console.error('[FLUSH] console.error message 2');
process.on('exit', () => mark('exit-event'));
setTimeout(() => { mark('timer-fired'); }, 10);
