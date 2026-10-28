import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  TRAINING_PROGRAM_CATEGORY_LABELS_RU,
  TRAINING_RESULT_LABELS_RU,
  TrainingKnowledgeResult,
  TrainingProtocolMember,
} from '../types';

interface TrainingProtocolFormProps {
  id?: string; // If edit mode
  onNavigate: (view: string, id?: string) => void;
}

interface MemberDraft {
  position: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  trained_in_commission_program: boolean;
}

const emptyMember = (): MemberDraft => ({
  position: '',
  last_name: '',
  first_name: '',
  middle_name: '',
  trained_in_commission_program: false,
});

const toDraft = (m: TrainingProtocolMember): MemberDraft => ({
  position: m.position || '',
  last_name: m.last_name || '',
  first_name: m.first_name || '',
  middle_name: m.middle_name || '',
  trained_in_commission_program: !!m.trained_in_commission_program,
});

const toMember = (d: MemberDraft): TrainingProtocolMember => ({
  position: d.position.trim(),
  last_name: d.last_name.trim(),
  first_name: d.first_name.trim() || null,
  middle_name: d.middle_name.trim() || null,
  trained_in_commission_program: d.trained_in_commission_program,
});

export const TrainingProtocolForm: React.FC<TrainingProtocolFormProps> = ({ id, onNavigate }) => {
  const isEdit = !!id;
  const existing = id ? storage.getTrainingProtocolById(id) : null;
  const currentLe = storage.getCurrentLegalEntity();

  const [legalEntityId, setLegalEntityId] = useState<string>(
    existing ? existing.legal_entity_id : currentLe ? currentLe.id : ''
  );
  const [protocolNumber, setProtocolNumber] = useState<string>(existing ? existing.protocol_number : '');
  const [sessionDate, setSessionDate] = useState<string>(existing ? existing.session_date : new Date().toISOString().slice(0, 10));
  const [programId, setProgramId] = useState<string>(existing ? existing.training_program_id : '');
  const [employeeId, setEmployeeId] = useState<string>(existing ? existing.employee_id : '');
  const [result, setResult] = useState<TrainingKnowledgeResult>(existing ? existing.result : 'passed');
  const [issuesCertificate, setIssuesCertificate] = useState<boolean>(existing ? existing.issues_certificate : true);
  const [certificateNumber, setCertificateNumber] = useState<string>(existing?.certificate_number || '');
  const [registryEntryNumber, setRegistryEntryNumber] = useState<string>(existing?.registry_entry_number || '');
  const [nextCheckDate, setNextCheckDate] = useState<string>(existing?.next_check_date || '');
  const [notes, setNotes] = useState<string>(existing?.notes || '');
  const [chairperson, setChairperson] = useState<MemberDraft>(
    existing ? toDraft(existing.chairperson) : emptyMember()
  );
  const [members, setMembers] = useState<MemberDraft[]>(
    existing && existing.members.length > 0 ? existing.members.map(toDraft) : [emptyMember(), emptyMember()]
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const programs = storage
    .listTrainingPrograms({ legal_entity_id: legalEntityId || undefined, pageSize: 1000 })
    .items;
  const employees = storage
    .listEmployees({ legal_entity_id: legalEntityId || undefined, status: 'active', pageSize: 5000 })
    .items;

  const selectedProgram = programs.find(p => p.id === programId) || (existing ? storage.getTrainingProgramById(existing.training_program_id) : null);

  const updateMember = (idx: number, patch: Partial<MemberDraft>) => {
    setMembers(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      const payload = {
        protocol_number: protocolNumber,
        legal_entity_id: legalEntityId,
        training_program_id: programId,
        session_date: sessionDate,
        chairperson: toMember(chairperson),
        members: members.map(toMember),
        employee_id: employeeId,
        result,
        issues_certificate: result === 'passed' ? issuesCertificate : false,
        certificate_number: result === 'passed' ? certificateNumber : null,
        registry_entry_number: registryEntryNumber || null,
        next_check_date: result === 'passed' ? nextCheckDate || null : null,
        notes: notes || null,
      };
      if (isEdit && existing) {
        // Протокол — регламентный документ: правка допускается только через аннулирование и новый протокол (п. 35 Порядка 2464)
        throw new Error('Изменение зарегистрированного протокола не предусмотрено. Аннулируйте протокол и создайте новый.');
      }
      const created = storage.createTrainingProtocol(payload);
      onNavigate('training-protocol-view', created.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения протокола проверки знаний');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => onNavigate('training')}
        className="text-sm text-blue-600 hover:underline mb-1 inline-block"
      >
        ← К реестру обучения
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {isEdit ? 'Протокол проверки знаний (просмотр без правки)' : 'Новый протокол заседания комиссии по проверке знаний'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Форма протокола согласно Постановлению Правительства РФ от 24.12.2021 № 2464 (п. 27–35)
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{errorMsg}</div>
      )}

      <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            1. Реквизиты протокола
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Юридическое лицо *</label>
              <select
                value={legalEntityId}
                onChange={e => {
                  setLegalEntityId(e.target.value);
                  setProgramId('');
                  setEmployeeId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isEdit}
              >
                <option value="">— Выберите организацию —</option>
                {legalEntities.map(le => (
                  <option key={le.id} value={le.id}>
                    {le.short_name || le.full_name} (ИНН {le.inn})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Номер протокола *</label>
              <input
                type="text"
                value={protocolNumber}
                onChange={e => setProtocolNumber(e.target.value)}
                placeholder="Например: 12-ОТ"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Дата заседания комиссии *</label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Программа обучения *</label>
              <select
                value={programId}
                onChange={e => setProgramId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isEdit}
              >
                <option value="">— Выберите программу —</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({TRAINING_PROGRAM_CATEGORY_LABELS_RU[p.category]}, {p.hours} ч.)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Работник (проверяемое лицо) *</label>
              <select
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isEdit}
              >
                <option value="">— Выберите работника —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.last_name} {emp.first_name} {emp.middle_name || ''}
                  </option>
                ))}
              </select>
              {selectedProgram && (
                <p className="text-[11px] text-slate-500">
                  Плановая дата следующей проверки рассчитывается автоматически: дата заседания +{' '}
                  {selectedProgram.recurring_months != null ? `${selectedProgram.recurring_months} мес.` : 'без периодичности'}.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            2. Состав комиссии (не менее 3 человек, п. 27)
          </h2>

          <fieldset className="p-4 bg-slate-50 rounded border border-slate-200 space-y-3">
            <legend className="text-xs font-bold text-slate-600 px-1">Председатель комиссии *</legend>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Должность, организация *"
                value={chairperson.position}
                onChange={e => setChairperson({ ...chairperson, position: e.target.value })}
                className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isEdit}
              />
              <input
                type="text"
                placeholder="Фамилия *"
                value={chairperson.last_name}
                onChange={e => setChairperson({ ...chairperson, last_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isEdit}
              />
              <input
                type="text"
                placeholder="Имя / Отчество"
                value={`${chairperson.first_name} ${chairperson.middle_name}`.trim()}
                onChange={e => {
                  const parts = e.target.value.split(/\s+/);
                  setChairperson({ ...chairperson, first_name: parts[0] || '', middle_name: parts.slice(1).join(' ') });
                }}
                className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isEdit}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={chairperson.trained_in_commission_program}
                onChange={e => setChairperson({ ...chairperson, trained_in_commission_program: e.target.checked })}
                disabled={isEdit}
              />
              Обучение по программе А в составе комиссии (п. 27)
            </label>
          </fieldset>

          {members.map((m, idx) => (
            <fieldset key={idx} className="p-4 bg-white rounded border border-slate-200 space-y-3">
              <legend className="text-xs font-bold text-slate-600 px-1">Член комиссии {idx + 1} *</legend>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Должность, организация *"
                  value={m.position}
                  onChange={e => updateMember(idx, { position: e.target.value })}
                  className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isEdit}
                />
                <input
                  type="text"
                  placeholder="Фамилия *"
                  value={m.last_name}
                  onChange={e => updateMember(idx, { last_name: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isEdit}
                />
                <input
                  type="text"
                  placeholder="Имя / Отчество"
                  value={`${m.first_name} ${m.middle_name}`.trim()}
                  onChange={e => {
                    const parts = e.target.value.split(/\s+/);
                    updateMember(idx, { first_name: parts[0] || '', middle_name: parts.slice(1).join(' ') });
                  }}
                  className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isEdit}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.trained_in_commission_program}
                    onChange={e => updateMember(idx, { trained_in_commission_program: e.target.checked })}
                    disabled={isEdit}
                  />
                  Обучение по программе А в составе комиссии (п. 27)
                </label>
                {!isEdit && members.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setMembers(prev => prev.filter((_, i) => i !== idx))}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Удалить члена комиссии
                  </button>
                )}
              </div>
            </fieldset>
          ))}

          {!isEdit && (
            <button
              type="button"
              onClick={() => setMembers(prev => [...prev, emptyMember()])}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
            >
              + Добавить члена комиссии
            </button>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            3. Результат проверки знания
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Результат *</label>
              <select
                value={result}
                onChange={e => setResult(e.target.value as TrainingKnowledgeResult)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isEdit}
              >
                {Object.entries(TRAINING_RESULT_LABELS_RU).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              {result === 'failed' && (
                <p className="text-[11px] text-rose-600">
                  При неудовлетворительном результате удостоверение не выдается, повторная проверка — не ранее 1 месяца (п. 33).
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Срок следующей проверки знаний</label>
              <input
                type="date"
                value={nextCheckDate}
                onChange={e => setNextCheckDate(e.target.value)}
                placeholder="Пусто — авторасчёт по периодичности программы"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isEdit || result === 'failed'}
              />
            </div>
            {result === 'passed' && (
              <>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={issuesCertificate}
                      onChange={e => setIssuesCertificate(e.target.checked)}
                      disabled={isEdit}
                    />
                    Выдано удостоверение (форма Приложения № 2)
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Номер удостоверения</label>
                  <input
                    type="text"
                    value={certificateNumber}
                    onChange={e => setCertificateNumber(e.target.value)}
                    placeholder="0012-24/0345"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isEdit}
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Регистрационный номер в реестре Минтруда (ЕИСОТ)</label>
              <input
                type="text"
                value={registryEntryNumber}
                onChange={e => setRegistryEntryNumber(e.target.value)}
                placeholder="Заполняется вручную при синхронизации с ЕИСОТ"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Примечания</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isEdit}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          {!isEdit && (
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 shadow-sm"
            >
              Зарегистрировать протокол
            </button>
          )}
          <button
            type="button"
            onClick={() => (isEdit && existing ? onNavigate('training-protocol-view', existing.id) : onNavigate('training'))}
            className="px-5 py-2 bg-slate-100 text-slate-700 rounded font-semibold text-sm hover:bg-slate-200"
          >
            {isEdit ? 'К просмотру протокола' : 'Отмена'}
          </button>
        </div>
      </form>
    </div>
  );
};
