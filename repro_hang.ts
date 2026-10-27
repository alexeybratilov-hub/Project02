import assert from 'node:assert/strict';
if (!globalThis.localStorage || typeof (globalThis.localStorage as any).getItem !== 'function') {
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
const t0 = Date.now(); let last = t0;
const mark = (m: string) => { const n = Date.now(); process.stderr.write(`[REPRO] ${m} +${n - last}ms total=${n - t0}ms\n`); last = n; };

import { storage } from './src/services/storage';
mark('storage-imported');

storage.toggleModule('sout');
storage.toggleModule('opr');
storage.toggleModule('medical');
mark('modules-enabled');

const testLe = storage.createLegalEntity({ full_name: 'ООО «САОТ-Тест»', short_name: 'ООО «САОТ-Тест»', inn: '7707083893', kpp: '770701001', ogrn: '1027700132195' });
const testDept = storage.createDepartment({ legal_entity_id: testLe.id, name: 'Служба охраны труда' });
const testPos = storage.createPosition('Специалист по охране труда');
const testCont = storage.createContingentRecord({ legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, workplace_label: 'Кабинет №1', medical_items_29n: ['Приложение 1, п. 4.1'] });
const testEmp = storage.createEmployee({ legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, contingent_record_id: testCont.id, last_name: 'Кузнецов', first_name: 'Алексей', middle_name: 'Сергеевич', hire_date: '2023-03-01', birth_date: '1990-07-15', snils: '112-233-445 95' });
mark('seeded');

const medCard1 = storage.createMedicalCard({ card_number: 'МЕД-001', legal_entity_id: testLe.id, employee_id: testEmp.employee.id, contingent_record_id: testCont.id, exam_type: 'preliminary', referral_date: '2024-03-01', conclusion: 'pending' });
mark('medCard1');
const medCard2 = storage.createMedicalCard({ card_number: 'МЕД-002', legal_entity_id: testLe.id, employee_id: testEmp.employee.id, exam_type: 'periodic', referral_date: '2024-02-01', exam_date: '2024-03-01', next_due_date: '2026-03-01', clinic_name: 'ГБУЗ «Центр профпатологии»', doctor_fio: 'Петрова А.С.', conclusion: 'fit' });
mark('medCard2');
storage.updateMedicalCard(medCard1.id, { exam_date: '2024-03-15', next_due_date: '2026-03-15', conclusion: 'fit_restrictions', conclusion_details: 'Ограничения по высоте выше 3 м', contraindications_found: true });
mark('update-medCard1');
const overdueCard = storage.createMedicalCard({ card_number: 'МЕД-003', legal_entity_id: testLe.id, employee_id: testEmp.employee.id, exam_type: 'periodic', exam_date: '2024-01-10', next_due_date: '2025-01-10', conclusion: 'fit' });
mark('overdueCard');
const periodicList = storage.listMedicalCards({ legal_entity_id: testLe.id, exam_type: 'periodic' });
mark('M1-periodicList-done total=' + periodicList.total);
const overdueList = storage.listMedicalCards({ overdue: true });
mark('M2-overdueList-done total=' + overdueList.total);
const searchByClinic = storage.listMedicalCards({ search: 'профпатологии' });
mark('M3-searchByClinic-done total=' + searchByClinic.total);
const searchByFio = storage.listMedicalCards({ search: 'кузнецов алексей' });
mark('M4-searchByFio-done total=' + searchByFio.total);
process.exit(0);
