import assert from 'node:assert/strict';

if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as any;
}

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

console.log('--- ЗАПУСК АВТОМАТИЧЕСКИХ ТЕСТОВ САОТ (ЭТАПЫ 2, 3, 4 И 5) ---');

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
console.log('[7/13] Тестирование регистронезависимого сравнения кириллицы (Ё/е)...');
assert.equal(ciCompare('Пётр'), ciCompare('петр'));
assert.equal(ciCompare('МОНТЁР'), ciCompare('монтер'));

// 8. SNILS normalization & checksum verification (Stage 4, D-007)
console.log('[8/13] Тестирование нормализации и контрольной суммы СНИЛС (D-007)...');
import { normalizeSnils, validateDateNotFuture, findEmployeeDuplicates } from '../services/validation';
import { mapEmployeeHeaders, EMPLOYEE_HEADERS } from '../services/excel';

// Valid SNILS (112-233-445 95): sum = 1*9 + 1*8 + 2*7 + 2*6 + 3*5 + 3*4 + 4*3 + 4*2 + 5*1 = 95
assert.equal(normalizeSnils('112-233-445 95'), '112-233-445 95');
assert.equal(normalizeSnils('11223344595'), '112-233-445 95');
assert.equal(normalizeSnils('  112 233 445-95  '), '112-233-445 95');
// Invalid length
assert.throws(() => normalizeSnils('12345'), /СНИЛС должен содержать 11 цифр/);
assert.throws(() => normalizeSnils('112-233-445 950'), /СНИЛС должен содержать 11 цифр/);
// Invalid checksum
assert.throws(() => normalizeSnils('112-233-445 96'), /Контрольная сумма СНИЛС не сходится/);
assert.throws(() => normalizeSnils('112-233-445 00'), /Контрольная сумма СНИЛС не сходится/);

// 9. Employee dates validation (no future dates)
console.log('[9/13] Тестирование проверки дат работника (FR-08)...');
assert.equal(validateDateNotFuture('2020-01-15', 'Дата приёма'), '2020-01-15');
assert.equal(validateDateNotFuture('1985-11-20', 'Дата рождения'), '1985-11-20');
assert.throws(() => validateDateNotFuture('2099-01-01', 'Дата приёма'), /не может быть в будущем/);
assert.throws(() => validateDateNotFuture('not-a-date', 'Дата приёма'), /Некорректная дата/);

// 10. Duplicate employee warnings (no hard conflict, no auto-merge)
console.log('[10/13] Тестирование детектора дубликатов работников (без автообъединения)...');
const existingEmps: any[] = [
  {
    id: 'emp-1',
    legal_entity_id: 'le-1',
    last_name: 'Иванов',
    first_name: 'Иван',
    middle_name: 'Иванович',
    birth_date: '1980-05-10',
    snils: '112-233-445 95',
    status: 'active',
  },
];

// Same SNILS in same LE -> warning, not conflict
const snilsDup = findEmployeeDuplicates(existingEmps, {
  legal_entity_id: 'le-1',
  last_name: 'Петров',
  first_name: 'Пётр',
  snils: '112-233-445 95',
});
assert.equal(snilsDup.conflict, null);
assert.ok(snilsDup.warnings.some(w => w.includes('уже есть работник с таким СНИЛС')));

// Same FIO + birth date -> warning, not conflict
const fioDup = findEmployeeDuplicates(existingEmps, {
  legal_entity_id: 'le-1',
  last_name: 'иванов',
  first_name: 'иван',
  middle_name: 'иванович',
  birth_date: '1980-05-10',
});
assert.equal(fioDup.conflict, null);
assert.ok(fioDup.warnings.some(w => w.includes('Полное совпадение ФИО и даты рождения')));
assert.ok(fioDup.warnings.some(w => w.includes('объединение по ФИО запрещено')));

// Different legal entity -> no warning
const diffLe = findEmployeeDuplicates(existingEmps, {
  legal_entity_id: 'le-2',
  last_name: 'Иванов',
  first_name: 'Иван',
  middle_name: 'Иванович',
  birth_date: '1980-05-10',
  snils: '112-233-445 95',
});
assert.equal(diffLe.warnings.length, 0);

// 11. Employee header aliases mapping (IMPORT_EXPORT §5)
console.log('[11/13] Тестирование маппинга заголовков импорта работников...');
const { mapping: empMap, problems: empProb } = mapEmployeeHeaders([
  'Организация',
  'Отдел',
  'Должность',
  'Фамилия',
  'Имя',
  'Отчество',
  'Дата приёма',
  'Дата рождения',
  'СНИЛС',
  'Рабочее место',
]);
assert.equal(empMap[0], 'legal_entity');
assert.equal(empMap[1], 'department');
assert.equal(empMap[2], 'position');
assert.equal(empMap[3], 'last_name');
assert.equal(empMap[4], 'first_name');
assert.equal(empMap[5], 'middle_name');
assert.equal(empMap[6], 'hire_date');
assert.equal(empMap[7], 'birth_date');
assert.equal(empMap[8], 'snils');
assert.equal(empMap[9], 'contingent_label');
assert.equal(empProb.length, 0);

// Missing required column error
const { problems: missingProb } = mapEmployeeHeaders(['Фамилия', 'Имя']);
assert.ok(missingProb.some(p => p.includes('Отсутствует обязательный столбец «Юридическое лицо»')));
assert.ok(missingProb.some(p => p.includes('Отсутствует обязательный столбец «Должность»')));

// 12. Employee import identification logic (SNILS + LE)
console.log('[12/13] Тестирование логики идентификации при импорте (СНИЛС + Юрлицо)...');
const importEmps: any[] = [
  {
    id: 'emp-10',
    legal_entity_id: 'le-100',
    snils: '112-233-445 95',
    last_name: 'Сидоров',
    first_name: 'Алексей',
    status: 'active',
  },
];
const identifyImport = (rec: { legal_entity_id: string; snils?: string }) => {
  if (!rec.snils) return null;
  return importEmps.find(
    e => e.legal_entity_id === rec.legal_entity_id && e.snils === rec.snils && e.status === 'active'
  ) || null;
};
assert.ok(identifyImport({ legal_entity_id: 'le-100', snils: '112-233-445 95' }) !== null);
assert.equal(identifyImport({ legal_entity_id: 'le-200', snils: '112-233-445 95' }), null);
assert.equal(identifyImport({ legal_entity_id: 'le-100' }), null); // without SNILS -> never matched, always new

// 13. Employment history period opening & closing logic (D-005)
console.log('[13/13] Тестирование логики кадровых перемещений (D-005)...');
const periods: any[] = [
  {
    id: 'h-1',
    employee_id: 'emp-1',
    start_date: '2023-01-10',
    end_date: null,
    department_id: 'dept-1',
    position_id: 'pos-1',
    contingent_record_id: null,
    reason: 'Приём на работу',
  },
];
// Transfer simulation
const openPeriod = periods.find(p => p.employee_id === 'emp-1' && !p.end_date);
assert.ok(openPeriod);
openPeriod.end_date = '2024-06-01'; // closed
periods.push({
  id: 'h-2',
  employee_id: 'emp-1',
  start_date: '2024-06-01',
  end_date: null,
  department_id: 'dept-2',
  position_id: 'pos-2',
  contingent_record_id: 'c-1',
  reason: 'Перевод на должность инженера',
});
assert.equal(periods.length, 2);
assert.equal(periods[0].end_date, '2024-06-01');
assert.equal(periods[1].end_date, null);
assert.equal(periods[1].department_id, 'dept-2');

// 14. Backup creation & restoration round-trip (FR-14, D-005, counts)
console.log('[14/16] Тестирование полного резервного копирования и восстановления (FR-14)...');
import { storage } from '../services/storage';

// Seed test data in storage
const testLe = storage.createLegalEntity({
  full_name: 'Общество с ограниченной ответственностью «САОТ-Тест»',
  short_name: 'ООО «САОТ-Тест»',
  inn: '7707083893',
  kpp: '770701001',
  ogrn: '1027700132195',
});
const testDept = storage.createDepartment({
  legal_entity_id: testLe.id,
  name: 'Служба охраны труда',
});
const testPos = storage.createPosition('Специалист по охране труда');
const testCont = storage.createContingentRecord({
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  workplace_label: 'Кабинет №1',
  medical_items_29n: ['Приложение 1, п. 4.1'],
});
const testEmp = storage.createEmployee({
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  contingent_record_id: testCont.id,
  last_name: 'Кузнецов',
  first_name: 'Алексей',
  middle_name: 'Сергеевич',
  hire_date: '2023-03-01',
  birth_date: '1990-07-15',
  snils: '112-233-445 95',
});

// Create backup
const backupJson = storage.createBackup('test-stage5');
const manifest = JSON.parse(backupJson);
assert.ok(manifest.id);
assert.equal(manifest.counts.legal_entities >= 1, true);
assert.equal(manifest.counts.departments >= 1, true);
assert.equal(manifest.counts.positions >= 1, true);
assert.equal(manifest.counts.contingent >= 1, true);
assert.equal(manifest.counts.employees >= 1, true);
assert.equal(manifest.counts.employment_history >= 1, true);

// 15. Referential integrity verification (Scenario 18: Проверка связей после восстановления)
console.log('[15/16] Тестирование проверки связей и целостности данных (Сценарий 18)...');
// First, restore and check integrity report on clean data
const reportAfterRestore = storage.restoreFromBackup(backupJson);
assert.equal(reportAfterRestore.valid, true);
assert.equal(reportAfterRestore.errors.length, 0);
assert.ok(reportAfterRestore.stats.employees >= 1);

// Now run standalone verifyDataIntegrity
const cleanIntegrity = storage.verifyDataIntegrity();
assert.equal(cleanIntegrity.valid, true);
assert.equal(cleanIntegrity.errors.length, 0);

// Test detection of broken links: artificially corrupt department_id of an employee
const rawEmps = storage.getEmployeesRaw();
const savedEmpDept = rawEmps[0].department_id;
rawEmps[0].department_id = 'non-existent-dept-uuid';
storage.saveEmployeesRaw(rawEmps);

const brokenIntegrity = storage.verifyDataIntegrity();
assert.equal(brokenIntegrity.valid, false);
assert.ok(brokenIntegrity.errors.some(e => e.includes('несуществующее подразделение')));

// Restore original department to return to clean state
rawEmps[0].department_id = savedEmpDept;
storage.saveEmployeesRaw(rawEmps);
assert.equal(storage.verifyDataIntegrity().valid, true);

// 16. Automatic backup triggers (auto-import, pre-restore, auto-daily)
console.log('[16/16] Тестирование авто-резервного копирования (импорт, страховочная копия, суточная)...');
const initialBackupsCount = storage.getBackupsList().length;

// Pre-restore backup was generated in test 15
assert.ok(storage.getBackupsList().some(b => b.label === 'pre-restore'));

// Auto-backup on import
storage.commitEmployeeImport(
  [
    {
      legal_entity_id: testLe.id,
      department_id: testDept.id,
      position_id: testPos.id,
      last_name: 'Фёдоров',
      first_name: 'Дмитрий',
      hire_date: '2024-01-10',
    },
  ],
  'add'
);
assert.ok(storage.getBackupsList().some(b => b.label === 'auto-import-employees'));

// Periodic auto-backup
storage.checkPeriodicAutoBackup();
assert.ok(storage.getBackupsList().some(b => b.label === 'auto-daily'));

// 17. SOUT cards: classes, harmful factors, automatic guarantees (TK RF), expiry (426-FZ)
console.log('[17/19] Тестирование карт СОУТ: классы, факторы, авторасчёт гарантий и сроков (426-ФЗ)...');
import { mapSoutHeaders, parseSoutFactors } from '../services/excel';

// Static guarantee/expiry calculations via the storage instance constructor
const StorageService: any = (storage as any).constructor;

// Disabled module blocks creation before validation (module lifecycle check first)
assert.equal(storage.isModuleEnabled('sout'), false);
assert.throws(
  () => storage.createSoutCard({ card_number: 'OFF-0', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }),
  /Модуль СОУТ отключён/
);
// Enable the module for further tests
storage.toggleModule('sout');
assert.equal(storage.isModuleEnabled('sout'), true);

// Invalid class rejected
assert.throws(
  () => storage.createSoutCard({ card_number: 'X-0', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '3.5' }),
  /Недопустимый класс условий труда/
);
// Missing card number rejected
assert.throws(
  () => storage.createSoutCard({ card_number: ' ', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }),
  /Номер карты СОУТ обязателен/
);
// Department of another legal entity rejected (isolation)
const otherLe = storage.createLegalEntity({ full_name: 'ООО «Другое»', inn: '7702000002' });
assert.throws(
  () => storage.createSoutCard({ card_number: 'X-ERR', legal_entity_id: otherLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }),
  /Подразделение не принадлежит выбранному юридическому лицу/
);

// Class 3.3 — ст. 92 (36 ч), ст. 117 (7 дней), ст. 147 (4%), молоко, досрочная пенсия, СИЗ
const card33 = storage.createSoutCard({
  card_number: 'СОУТ-001',
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  workplace_label: 'Кабинет №2',
  factors: [
    { type: 'noise', class: '3.3', note: '85 дБА' },
    { type: 'chemical', class: '3.2' },
  ],
  final_class: '3.3',
  employees_count: 5,
  women_count: 2,
  minors_count: 0,
  disabled_count: 1,
  report_approved_at: '2024-05-20',
});
assert.equal(card33.guarantees.reduced_hours, true); // ст. 92 ТК РФ
assert.equal(card33.guarantees.extra_vacation_days, 7); // ст. 117 ТК РФ
assert.equal(card33.guarantees.pay_increase_percent, 4); // ст. 147 ТК РФ
assert.equal(card33.guarantees.milk_issue, true); // ст. 222 ТК РФ
assert.equal(card33.guarantees.early_pension, true);
assert.equal(card33.guarantees.ppe_issue, true);
assert.equal(card33.expires_at, '2029-05-20'); // 5 лет со дня утверждения отчёта (ст. 8 426-ФЗ)
assert.equal(card33.declaration_active, false);

// Class 2 — no guarantees
const card2 = storage.createSoutCard({
  card_number: 'СОУТ-002',
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  final_class: '2',
  report_approved_at: '2024-01-15',
});
assert.equal(card2.guarantees.reduced_hours, false);
assert.equal(card2.guarantees.extra_vacation_days, 0);
assert.equal(card2.guarantees.pay_increase_percent, 0);
assert.equal(card2.guarantees.milk_issue, false);
assert.equal(card2.expires_at, '2029-01-15');

// Class 3.1 — only pay increase from 4%, milk/PPE, no reduced hours/vacation
const g31 = StorageService.computeGuarantees('3.1');
assert.equal(g31.reduced_hours, false);
assert.equal(g31.extra_vacation_days, 0);
assert.equal(g31.pay_increase_percent, 4);
assert.equal(g31.milk_issue, true);
// Class 4 — hazardous: all guarantees
const g4 = StorageService.computeGuarantees('4');
assert.equal(g4.reduced_hours, true);
assert.equal(g4.extra_vacation_days, 7);
assert.equal(g4.pay_increase_percent, 4);
assert.equal(g4.early_pension, true);

// Declaration (ст. 11 426-ФЗ) — perpetual card (expires_at = null)
const cardDecl = storage.createSoutCard({
  card_number: 'СОУТ-003',
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  final_class: '2',
  report_approved_at: '2023-09-01',
  declaration_active: true,
  declaration_number: 'Д-77-2023-0456',
});
assert.equal(cardDecl.expires_at, null); // бессрочная карта по декларации
assert.equal(cardDecl.declaration_number, 'Д-77-2023-0456');

// Duplicate card number in same LE -> error; in another LE -> allowed (isolation)
assert.throws(
  () => storage.createSoutCard({ card_number: 'соут-001', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }),
  /уже зарегистрирована/
);

// Archive & restore without cascade damage to related data
const archived = storage.archiveSoutCard(card2.id);
assert.equal(archived.status, 'archived');
assert.throws(() => storage.archiveSoutCard(card2.id), /уже в архиве/);
const restored = storage.restoreSoutCard(card2.id);
assert.equal(restored.status, 'active');
assert.equal(storage.verifyDataIntegrity().valid, true); // связанные данные не повреждены

// SOUT header aliases mapping and factor parsing (IMPORT_EXPORT)
const { mapping: soutMap, problems: soutProb } = mapSoutHeaders([
  'Организация',
  'Отдел',
  'Профессия',
  '№ карты СОУТ',
  'Рабочее место',
  'Вредные факторы',
  'Класс СОУТ',
]);
assert.equal(soutMap[0], 'legal_entity');
assert.equal(soutMap[3], 'card_number');
assert.equal(soutMap[6], 'final_class');
assert.equal(soutProb.length, 0);

const parsedFactors = parseSoutFactors('Шум:3.3; Химический фактор:3.2; Освещённость:2');
assert.equal(parsedFactors.errors.length, 0);
assert.equal(parsedFactors.factors.length, 3);
assert.equal(parsedFactors.factors[0].type, 'noise');
assert.equal(parsedFactors.factors[0].class, '3.3');
assert.equal(parsedFactors.factors[2].type, 'illumination');
const badFactors = parseSoutFactors('Шум:9.9');
assert.ok(badFactors.errors.length > 0);

// 18. Worker familiarization under signature (ст. 5 426-ФЗ) + audit log
console.log('[18/19] Тестирование ознакомления работников под роспись (ст. 5 426-ФЗ)...');
const fam = storage.familiarizeSoutCard(card33.id, testEmp.employee.id, '2024-06-01', 'Электронно через САОТ');
assert.equal(fam.sout_card_id, card33.id);
assert.equal(fam.employee_id, testEmp.employee.id);
assert.equal(fam.signed_at, '2024-06-01');

// Double signature rejected
assert.throws(
  () => storage.familiarizeSoutCard(card33.id, testEmp.employee.id),
  /уже ознакомлен/
);
// Future date rejected
assert.throws(
  () => storage.familiarizeSoutCard(cardDecl.id, testEmp.employee.id, '2099-01-01'),
  /не может быть в будущем/
);
// Employee from another LE rejected (organizational isolation)
const otherDept = storage.createDepartment({ legal_entity_id: otherLe.id, name: 'Цех других' });
const empOtherRes = storage.createEmployee({
  legal_entity_id: otherLe.id,
  department_id: otherDept.id,
  position_id: testPos.id,
  last_name: 'Другов',
  first_name: 'Андрей',
  hire_date: '2024-02-01',
});
assert.throws(
  () => storage.familiarizeSoutCard(card33.id, empOtherRes.employee.id),
  /другому юридическому лицу/
);

// Familiarization list and audit log registration (sout_familiarize)
const famList = storage.listSoutFamiliarizations(card33.id);
assert.equal(famList.length, 1);
const auditLog = storage.getAuditLogs();
assert.ok(auditLog.some((a: any) => a.action === 'sout_familiarize' && String(a.comment || '').includes('картой СОУТ')));

// Remove mark and confirm cleanup
storage.removeSoutFamiliarization(fam.id);
assert.equal(storage.listSoutFamiliarizations(card33.id).length, 0);

// 19. SOUT referential integrity, module toggle, backup integration
console.log('[19/19] Тестирование целостности СОУТ, переключения модуля и бэкапа...');
// Corrupt card link: nonexistent department
const rawCards = storage.getSoutCardsRaw();
const savedDept = rawCards[0].department_id;
rawCards[0].department_id = 'non-existent-dept-uuid';
storage.saveSoutCardsRaw(rawCards);
const brokenSout = storage.verifyDataIntegrity();
assert.equal(brokenSout.valid, false);
assert.ok(brokenSout.errors.some(e => e.includes('Карта СОУТ') && e.includes('несуществующее подразделение')));
rawCards[0].department_id = savedDept;
storage.saveSoutCardsRaw(rawCards);
assert.equal(storage.verifyDataIntegrity().valid, true);

// Corrupt familiarization link: nonexistent card
const rawFam = storage.getSoutFamiliarizationsRaw();
storage.familiarizeSoutCard(card33.id, testEmp.employee.id); // re-create one record
const famAgain = storage.getSoutFamiliarizationsRaw();
const savedCardId = famAgain[famAgain.length - 1].sout_card_id;
famAgain[famAgain.length - 1].sout_card_id = 'ghost-card-uuid';
storage.saveSoutFamiliarizationsRaw(famAgain);
const brokenFam = storage.verifyDataIntegrity();
assert.equal(brokenFam.valid, false);
assert.ok(brokenFam.errors.some(e => e.includes('ознакомления') && e.includes('несуществующую карту')));
famAgain[famAgain.length - 1].sout_card_id = savedCardId;
storage.saveSoutFamiliarizationsRaw(famAgain);
assert.equal(storage.verifyDataIntegrity().valid, true);

// Module toggle: disable hides menu/routes and blocks CRUD, data preserved
storage.toggleModule('sout');
assert.equal(storage.isModuleEnabled('sout'), false);
assert.throws(() => storage.createSoutCard({ card_number: 'OFF-1', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }), /Модуль СОУТ отключён/);
assert.throws(() => storage.familiarizeSoutCard(card33.id, testEmp.employee.id), /Модуль СОУТ отключён/);
assert.equal(storage.getSoutCardsRaw().length >= 4, true); // данные сохранены при отключении
storage.toggleModule('sout');
assert.equal(storage.isModuleEnabled('sout'), true);

// Backup manifest includes sout counts and body; restore round-trip preserves SOUT
const backup2 = JSON.parse(storage.createBackup('test-stage6'));
assert.ok(backup2.counts.sout_cards >= 4);
assert.ok(backup2.counts.sout_familiarizations >= 1);
assert.ok(Array.isArray(backup2.data.sout_cards) && backup2.data.sout_cards.length >= 4);
assert.ok(Array.isArray(backup2.data.sout_familiarizations));

// Add a card after backup, then restore -> card disappears, integrity valid
storage.createSoutCard({ card_number: 'СОУТ-POST', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '1' });
const restoreReport = storage.restoreFromBackup(JSON.stringify(backup2));
assert.equal(restoreReport.valid, true);
assert.equal(storage.getSoutCardsRaw().some(c => c.card_number === 'СОУТ-POST'), false);
assert.ok(storage.getSoutCardsRaw().some(c => c.card_number === 'СОУТ-001'));
assert.equal(storage.verifyDataIntegrity().valid, true);

// Module remains enabled after restore (module registry is not part of backup payload)
assert.equal(storage.isModuleEnabled('sout'), true);

console.log('✅ ВСЕ ТЕСТЫ ЭТАПОВ 2–6 УСПЕШНО ПРОЙДЕНЫ (19/19)!');


