import React, { useState } from 'react';
import { storage, StorageService } from '../services/storage';
import {
  TRAINING_PROGRAM_CATEGORY_LABELS_RU,
  TRAINING_RESULT_LABELS_RU,
  TRAINING_VALIDITY_STATUS_LABELS_RU,
} from '../types';

interface TrainingProtocolViewProps {
  id: string;
  onNavigate: (view: string, id?: string) => void;
}

const fmtDate = (iso?: string | null): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

const fio = (m: { last_name: string; first_name?: string | null; middle_name?: string | null }) =>
  `${m.last_name} ${m.first_name || ''} ${m.middle_name || ''}`.replace(/\s+/g, ' ').trim();

export const TrainingProtocolView: React.FC<TrainingProtocolViewProps> = ({ id, onNavigate }) => {
  const protocol = storage.getTrainingProtocolById(id);
  const [invalidateOpen, setInvalidateOpen] = useState(false);
  const [invalidReason, setInvalidReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);

  if (!protocol) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Протокол проверки знаний не найден</h1>
        <p className="text-slate-600 mb-4">Запись с идентификатором «{id}» отсутствует или удалена.</p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          onClick={() => onNavigate('training')}
        >
          ← К реестру обучения
        </button>
      </div>
    );
  }

  const le = storage.getLegalEntityById(protocol.legal_entity_id);
  const employee = storage.getEmployeeById(protocol.employee_id);
  const program = storage.getTrainingProgramById(protocol.training_program_id);
  const validity = StorageService.checkTrainingValidity(protocol.next_check_date);
  const pos = employee ? storage.getPositionById(employee.position_id) : null;

  const handleInvalidate = () => {
    setErrorMsg(null);
    try {
      storage.invalidateTrainingProtocol(protocol.id, invalidReason);
      setInvalidateOpen(false);
      setInvalidReason('');
      setTick(t => t + 1);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка аннулирования протокола');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 print-area">
      <button
        onClick={() => onNavigate('training')}
        className="text-sm text-blue-600 hover:underline mb-1 inline-block print:hidden"
      >
        ← К реестру обучения
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Протокол заседания комиссии по проверке знания требований охраны труда № {protocol.protocol_number}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            от {fmtDate(protocol.session_date)} · Форма согласно Постановлению Правительства РФ от 24.12.2021 № 2464
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
          >
            🖨 Печать / Экспорт PDF
          </button>
          {protocol.status === 'active' && (
            <button
              onClick={() => setInvalidateOpen(true)}
              className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded hover:bg-rose-100"
            >
              Аннулировать (п. 35)
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm print:hidden">{errorMsg}</div>
      )}

      {protocol.status === 'archived' && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
          Протокол аннулирован{protocol.invalidation_reason ? `: ${protocol.invalidation_reason}` : ' (помещён в архив).'}
        </div>
      )}

      {/* Блок реквизитов */}
      <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
          Реквизиты
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <span className="text-slate-500">Организация:</span>{' '}
            <span className="font-medium text-slate-800">
              {le ? `${le.short_name || le.full_name} (ИНН ${le.inn})` : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Дата заседания комиссии:</span>{' '}
            <span className="font-medium text-slate-800">{fmtDate(protocol.session_date)}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-slate-500">Программа проверки знаний:</span>{' '}
            <span className="font-medium text-slate-800">
              {program
                ? `«${program.name}» — ${TRAINING_PROGRAM_CATEGORY_LABELS_RU[program.category]}, ${program.hours} ч.`
                : '—'}
            </span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-slate-500">Работник:</span>{' '}
            <span className="font-medium text-slate-800">
              {employee ? `${employee.last_name} ${employee.first_name} ${employee.middle_name || ''}` : '—'}
              {pos ? `, ${pos.name}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Комиссия */}
      <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
          Состав комиссии (председатель + {protocol.members.length} чл.)
        </h2>
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2 px-3">Роль</th>
              <th className="py-2 px-3">Должность (организация)</th>
              <th className="py-2 px-3">ФИО</th>
              <th className="py-2 px-3">Обучение по программе А в составе комиссии</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-2 px-3 font-semibold text-slate-800">Председатель</td>
              <td className="py-2 px-3 text-slate-600">{protocol.chairperson.position || '—'}</td>
              <td className="py-2 px-3 text-slate-800">{fio(protocol.chairperson)}</td>
              <td className="py-2 px-3">{protocol.chairperson.trained_in_commission_program ? 'Да' : 'Нет'}</td>
            </tr>
            {protocol.members.map((m, idx) => (
              <tr key={idx}>
                <td className="py-2 px-3 text-slate-600">Член комиссии {idx + 1}</td>
                <td className="py-2 px-3 text-slate-600">{m.position || '—'}</td>
                <td className="py-2 px-3 text-slate-800">{fio(m)}</td>
                <td className="py-2 px-3">{m.trained_in_commission_program ? 'Да' : 'Нет'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Результат */}
      <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
          Результат проверки знания
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <span className="text-slate-500">Результат:</span>{' '}
            <span
              className={`font-bold ${protocol.result === 'passed' ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {TRAINING_RESULT_LABELS_RU[protocol.result]}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Удостоверение:</span>{' '}
            <span className="font-medium text-slate-800">
              {protocol.issues_certificate
                ? `Выдано${protocol.certificate_number ? `, № ${protocol.certificate_number}` : ''}`
                : 'Не выдавалось'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Срок следующей проверки знаний:</span>{' '}
            <span className="font-medium text-slate-800">{fmtDate(protocol.next_check_date)}</span>
            {protocol.next_check_date && (
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded ${
                  validity === 'overdue'
                    ? 'bg-rose-100 text-rose-800'
                    : validity === 'expiring'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {TRAINING_VALIDITY_STATUS_LABELS_RU[validity]}
              </span>
            )}
          </div>
          <div>
            <span className="text-slate-500">Регистрационный номер в реестре Минтруда (ЕИСОТ):</span>{' '}
            <span className="font-medium text-slate-800">{protocol.registry_entry_number || '—'}</span>
          </div>
          {protocol.notes && (
            <div className="sm:col-span-2">
              <span className="text-slate-500">Примечания:</span>{' '}
              <span className="text-slate-800">{protocol.notes}</span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
          Подписи председателя и членов комиссии удостоверяются при печати формы (Приложение к Порядку, утв. Постановлением № 2464).
        </p>
      </div>

      {/* Модалка аннулирования */}
      {invalidateOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Аннулирование протокола (п. 35 Порядка 2464)</h3>
            <p className="text-sm text-slate-600">
              Укажите причину аннулирования результата проверки знаний (например: выявление недостоверных сведений, отзыв полномочий комиссии).
            </p>
            <textarea
              value={invalidReason}
              onChange={e => setInvalidReason(e.target.value)}
              rows={3}
              placeholder="Причина аннулирования *"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setInvalidateOpen(false);
                  setInvalidReason('');
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-sm font-semibold hover:bg-slate-200"
              >
                Отмена
              </button>
              <button
                onClick={handleInvalidate}
                disabled={!invalidReason.trim()}
                className="px-4 py-2 bg-rose-600 text-white rounded text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                Аннулировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
