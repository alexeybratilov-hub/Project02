import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import {
  MedicalExamType,
  MedicalConclusion,
  MEDICAL_EXAM_TYPE_LABELS_RU,
  MEDICAL_CONCLUSION_LABELS_RU,
} from '../types';

interface MedicalFormProps {
  onNavigate: (view: string, id?: string) => void;
  id?: string;
}

export const MedicalForm: React.FC<MedicalFormProps> = ({ onNavigate, id }) => {
  const isEdit = Boolean(id);
  const existing = id ? storage.getMedicalCardById(id) : null;

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;

  const [cardNumber, setCardNumber] = useState(existing?.card_number || '');
  const [leId, setLeId] = useState(existing?.legal_entity_id || (storage.getCurrentLegalEntity()?.id || ''));
  const [employeeId, setEmployeeId] = useState(existing?.employee_id || '');
  const [contingentRecordId, setContingentRecordId] = useState<string>(existing?.contingent_record_id || '');
  const [soutCardId, setSoutCardId] = useState<string>(existing?.sout_card_id || '');
  const [examType, setExamType] = useState<MedicalExamType>(existing?.exam_type || 'periodic');
  const [referralDate, setReferralDate] = useState(existing?.referral_date || '');
  const [examDate, setExamDate] = useState(existing?.exam_date || '');
  const [nextDueDate, setNextDueDate] = useState(existing?.next_due_date || '');
  const [clinicName, setClinicName] = useState(existing?.clinic_name || '');
  const [doctorFio, setDoctorFio] = useState(existing?.doctor_fio || '');
  const [conclusion, setConclusion] = useState<MedicalConclusion>(existing?.conclusion || 'pending');
  const [conclusionDetails, setConclusionDetails] = useState(existing?.conclusion_details || '');
  const [contraindicationsFound, setContraindicationsFound] = useState<boolean>(
    !!existing?.contraindications_found
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (id && !existing) {
      setErrorMsg('Карта медосмотра не найдена.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!storage.isModuleEnabled('medical')) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">
          {isEdit ? 'Редактирование карты медосмотра' : 'Новая карта медосмотра'}
        </h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded">
          Модуль «Медосмотры» отключён. Включите его в реестре модулей.
        </div>
      </div>
    );
  }

  // Справочники, зависящие от выбранного юрлица и работника
  const employees = storage
    .getEmployeesRaw()
    .filter(e => e.status === 'active' && (!leId || e.legal_entity_id === leId));

  const contingentRecords = leId
    ? storage.listContingentRecords({ legal_entity_id: leId, status: 'active', page: 1, pageSize: 100000 }).items
    : [];

  const soutCards = leId
    ? storage.listSoutCards({ legal_entity_id: leId, status: 'active', page: 1, pageSize: 100000 }).items
    : [];

  const employee = employees.find(e => e.id === employeeId) ||
    (employeeId ? storage.getEmployeeById(employeeId) : null);

  const getEmpFio = (empId: string) => {
    const emp = storage.getEmployeesRaw().find(e => e.id === empId);
    if (!emp) return '—';
    return `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim();
  };

  const handleLeChange = (newLeId: string) => {
    setLeId(newLeId);
    // Работник, контингент и СОУТ привязаны к юрлицу — сбрасываем несовместимые связи
    const empBelongsToNewLe = employeeId
      ? storage.getEmployeesRaw().some(e => e.id === employeeId && e.legal_entity_id === newLeId)
      : false;
    if (!empBelongsToNewLe) setEmployeeId('');
    setContingentRecordId('');
    setSoutCardId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      if (!cardNumber.trim()) throw new Error('Укажите номер карты медосмотра.');
      if (!leId) throw new Error('Выберите юридическое лицо.');
      if (!employeeId) throw new Error('Выберите работника.');

      const payload = {
        card_number: cardNumber.trim(),
        legal_entity_id: leId,
        employee_id: employeeId,
        contingent_record_id: contingentRecordId || null,
        sout_card_id: soutCardId || null,
        exam_type: examType,
        referral_date: referralDate || null,
        exam_date: examDate || null,
        next_due_date: nextDueDate || null,
        clinic_name: clinicName.trim() || null,
        doctor_fio: doctorFio.trim() || null,
        conclusion,
        conclusion_details: conclusionDetails.trim() || null,
        contraindications_found: contraindicationsFound,
      };

      if (isEdit && id) {
        const updated = storage.updateMedicalCard(id, payload);
        onNavigate('medical-view', updated.id);
      } else {
        const created = storage.createMedicalCard(payload);
        onNavigate('medical-view', created.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения карты медосмотра.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            type="button"
            onClick={() => onNavigate(isEdit && id ? 'medical-view' : 'medical', id)}
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← {isEdit ? 'Назад к карте' : 'Назад к реестру медосмотров'}
          </button>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEdit
              ? `Редактирование карты медосмотра № ${existing?.card_number}`
              : 'Новая карта медицинского осмотра'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Учёт предварительных и периодических медосмотров по Приказу Минздрава России № 29н
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">Текущее заключение:</span>
          <span
            className={`inline-block px-3 py-1 rounded text-sm font-semibold border ${
              MEDICAL_CONCLUSION_LABELS_RU[conclusion].badgeClass
            }`}
          >
            {MEDICAL_CONCLUSION_LABELS_RU[conclusion].name}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Секция 1: Привязка карты */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2">
            1. Организация и работник
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Юридическое лицо <span className="text-rose-500">*</span>
              </label>
              <select
                value={leId}
                onChange={e => handleLeChange(e.target.value)}
                required
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              >
                <option value="">-- Выберите организацию --</option>
                {legalEntities.map(le => (
                  <option key={le.id} value={le.id}>
                    {le.short_name || le.full_name} {le.inn ? `(ИНН: ${le.inn})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Номер карты медосмотра <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value)}
                placeholder="например: МЕД-001"
                required
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Работник <span className="text-rose-500">*</span>
              </label>
              <select
                value={employeeId}
                onChange={e => {
                  setEmployeeId(e.target.value);
                  setContingentRecordId('');
                }}
                required
                disabled={!leId}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">
                  {leId ? '-- Выберите работника --' : '-- Сначала выберите организацию --'}
                </option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {`${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim()}
                    {emp.snils ? ` (СНИЛС: ${emp.snils})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Запись контингента (обязательства по 29н)
              </label>
              <select
                value={contingentRecordId}
                onChange={e => setContingentRecordId(e.target.value)}
                disabled={!leId}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">— Не связана —</option>
                {contingentRecords.map(cr => (
                  <option key={cr.id} value={cr.id}>
                    {(cr.medical_items_29n || []).length > 0
                      ? `29н: ${cr.medical_items_29n!.join(', ')}`
                      : `Запись #${cr.id.slice(0, 8)}${cr.workplace_label ? ` (${cr.workplace_label})` : ''}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Карта СОУТ (основание направления на медосмотр)
              </label>
              <select
                value={soutCardId}
                onChange={e => setSoutCardId(e.target.value)}
                disabled={!leId}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">— Не указана —</option>
                {soutCards.map(sc => (
                  <option key={sc.id} value={sc.id}>
                    Карта СОУТ № {sc.card_number} (класс: {sc.final_class})
                  </option>
                ))}
              </select>
              {employee && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Выбранный работник: {getEmpFio(employee.id)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Секция 2: Сведения об осмотре */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2">
            2. Сведения о медицинском осмотре
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Вид медосмотра <span className="text-rose-500">*</span>
              </label>
              <select
                value={examType}
                onChange={e => setExamType(e.target.value as MedicalExamType)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              >
                {(Object.keys(MEDICAL_EXAM_TYPE_LABELS_RU) as MedicalExamType[]).map(t => (
                  <option key={t} value={t}>
                    {MEDICAL_EXAM_TYPE_LABELS_RU[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Дата выдачи направления
              </label>
              <input
                type="date"
                value={referralDate}
                onChange={e => setReferralDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Дата прохождения медосмотра
                {conclusion !== 'pending' && <span className="text-rose-500"> *</span>}
              </label>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Срок следующего медосмотра
              </label>
              <input
                type="date"
                value={nextDueDate}
                onChange={e => setNextDueDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Для периодических осмотров — дата очередного осмотра по графику 29н.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Медицинская организация
              </label>
              <input
                type="text"
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                placeholder="например: ГБУЗ «Центр профпатологии»"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Врач (ФИО)
              </label>
              <input
                type="text"
                value={doctorFio}
                onChange={e => setDoctorFio(e.target.value)}
                placeholder="ФИО врача, подписавшего заключение"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Секция 3: Заключение */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2">
            3. Заключение по результатам медосмотра
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Заключение <span className="text-rose-500">*</span>
              </label>
              <select
                value={conclusion}
                onChange={e => setConclusion(e.target.value as MedicalConclusion)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              >
                {(Object.keys(MEDICAL_CONCLUSION_LABELS_RU) as MedicalConclusion[]).map(c => (
                  <option key={c} value={c}>
                    {MEDICAL_CONCLUSION_LABELS_RU[c].name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contraindicationsFound}
                  onChange={e => setContraindicationsFound(e.target.checked)}
                />
                Выявлены медицинские противопоказания
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Подробности заключения / рекомендации
              </label>
              <textarea
                value={conclusionDetails}
                onChange={e => setConclusionDetails(e.target.value)}
                rows={3}
                placeholder="Например: ограничения по пункту 29н, рекомендации по переводу, результаты обследований..."
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Действия формы */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate(isEdit && id ? 'medical-view' : 'medical', id)}
            className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            {isEdit ? 'Сохранить изменения' : 'Создать карту медосмотра'}
          </button>
        </div>
      </form>
    </div>
  );
};
