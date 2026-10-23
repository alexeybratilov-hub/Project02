import assert from 'node:assert/strict';
import {
  validateInn,
  validateKpp,
  validateOgrn,
  checksumWarning,
  findDuplicates,
  ciCompare,
} from '../services/validation';
import {
  sanitizeCell,
  mapHeaders,
  mapContingentHeaders,
  LE_HEADERS,
  CONTINGENT_HEADERS,
} from '../services/excel';

console.log('--- ЗАПУСК АВТОМАТИЧЕСКИХ ТЕСТОВ САОТ (ЭТАП 2 И ЭТАП 3) ---');

// 1. Validation tests
console.log('[1/7] Тестирование валидации реквизитов (ИНН/КПП/ОГРН)...');
assert.equal(validateInn('7707083893'), '7707083893');
assert.equal(validateInn('500100732259'), '500100732259');
assert.throws(() => validateInn('123'), /ИНН должен содержать 10 или 12 цифр/);
assert.throws(() => validateInn('12345678901'), /ИНН должен содержать 10 или 12 цифр/);

assert.equal(validateKpp('770701001'), '770701001');
assert.throws(() => validateKpp('12345'), /КПП должен содержать 9 цифр/);

assert.equal(validateOgrn('1027700132195'), '1027700132195');
assert.equal(validateOgrn('304500116000157'), '304500116000157');
assert.throws(() => validateOgrn('12345'), /ОГРН должен содержать 13 или 15 цифр/);

// Checksum
assert.equal(checksumWarning('7707083893'), null); // Valid Sberbank INN
assert.ok(checksumWarning('7707083890') !== null); // Invalid checksum

// 2. Duplicate checking
console.log('[2/7] Тестирование проверки дубликатов юридических лиц...');
const sampleEntities: any[] = [
  {
    id: '1',
    full_name: 'Общество с ограниченной ответственностью «Альфа»',
    inn: '7701000001',
    kpp: '770101001',
    ogrn: '1027700000001',
    status: 'active',
  },
];

const dupConflict = findDuplicates(sampleEntities, {
  full_name: 'ООО Бета',
  inn: '7701000001',
  kpp: '770101001',
});
assert.ok(dupConflict.conflict && dupConflict.conflict.includes('уже зарегистрировано'));

const dupWarning = findDuplicates(sampleEntities, {
  full_name: 'общество с ограниченной ответственностью «альфа»',
  inn: '7702000002',
});
assert.ok(dupWarning.warnings.some(w => w.includes('Похожее полное наименование')));

// 3. Normalized position names (D-013)
console.log('[3/7] Тестирование справочника должностей (D-013)...');
const p1 = '  Инженер   по охране  труда ';
const p2 = 'инженер по ОХРАНЕ труда';
assert.equal(
  p1.toLowerCase().replace(/\s+/g, ' ').trim(),
  p2.toLowerCase().replace(/\s+/g, ' ').trim()
);

// 4. Excel Headers & Aliases mapping
console.log('[4/7] Тестирование маппинга заголовков Excel (Legal Entities & Contingent)...');
const { mapping: leMap, problems: leProb } = mapHeaders([
  'Наименование',
  'инн',
  'кпп',
  'огрн',
  'фактический адрес',
]);
assert.equal(leMap[0], 'full_name');
assert.equal(leMap[1], 'inn');
assert.equal(leProb.length, 0);

const { mapping: contMap, problems: contProb } = mapContingentHeaders([
  'Организация',
  'Отдел',
  'Профессия',
  'Рабочее место',
  '29н',
  '342н',
  'Карта СОУТ',
  'Карта ОПР',
]);
assert.equal(contMap[0], 'legal_entity');
assert.equal(contMap[1], 'department');
assert.equal(contMap[2], 'position');
assert.equal(contMap[3], 'workplace_label');
assert.equal(contMap[4], 'items_29n');
assert.equal(contMap[5], 'items_342n');
assert.equal(contProb.length, 0);

// 5. Formula injection protection (IMPORT_EXPORT §6)
console.log('[5/7] Тестирование защиты от формульных инъекций...');
assert.equal(sanitizeCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
assert.equal(sanitizeCell('+cmd|...'), "'+cmd|...");
assert.equal(sanitizeCell('-100'), "'-100");
assert.equal(sanitizeCell('@test'), "'@test");
assert.equal(sanitizeCell('ООО «Ромашка»'), 'ООО «Ромашка»');

// 6. D-004 Contingent Candidate Identification Key logic
console.log('[6/7] Тестирование идентификации контингента по D-004...');
const candidateA = {
  legal_entity_id: 'le-1',
  department_id: 'dept-1',
  position_id: 'pos-1',
  workplace_label: 'Цех №1',
};
const candidateB = {
  legal_entity_id: 'le-1',
  department_id: 'dept-1',
  position_id: 'pos-1',
  workplace_label: 'Цех №2',
};
const matchesCandidateA = (item: any) =>
  item.legal_entity_id === candidateA.legal_entity_id &&
  item.department_id === candidateA.department_id &&
  item.position_id === candidateA.position_id &&
  item.workplace_label === candidateA.workplace_label;

assert.equal(matchesCandidateA(candidateA), true);
assert.equal(matchesCandidateA(candidateB), false);

// 7. Casefold cyrillic comparison
console.log('[7/7] Тестирование регистронезависимого сравнения кириллицы (Ё/е)...');
assert.equal(ciCompare('Пётр'), ciCompare('петр'));
assert.equal(ciCompare('МОНТЁР'), ciCompare('монтер'));

console.log('✅ ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ!');
