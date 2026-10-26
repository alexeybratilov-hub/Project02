import React, { useState } from 'react';
import { storage } from '../services/storage';
import { formatDateForDisplay } from '../services/excel';
import {
  MEDICAL_EXAM_TYPE_LABELS_RU,
  MEDICAL_CONCLUSION_LABELS_RU,
} from '../types';

interface MedicalCardViewProps {
  id: string;
  onNavigate: (view: string, id?: string) => void;
}

export const MedicalCardView: React.FC<MedicalCardViewProps> = ({ id, onNavigate }) => {
  const card = storage.getMedicalCardById(id);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, setRefreshTick] = useState(0);

  if (!card) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Карта медосмотра не найдена</h1>
        <p className="text-slate-600 mb-4">Запись с идентификатором «{id}» отсутствует или удалена.</p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          onClick={() => onNavigate('medical')}
        >
          К реестру медосмотров
        </button>
      </div>
    );
  }

  const le = storage.getLegalEntityById(card.legal_entity_id);
  const employee = storage.getEmployeeById(card.employee_id);
  const contingent = card.contingent_record_id ? storage.getContingentRecordById(card.contingent_record_id) : null;
  const soutCard = card.sout_card_id ? storage.getSoutCardById(card.sout_card_id) : null;
  const dept = employee ? storage.getDepartmentById(employee.department_id) : null;
  const pos = employee ? storage.getPositionById(employee.position_id) : null;

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = card.status === 'active' && !!card.next_due_date && card.next_due_date < today;

  const conclusionInfo = MEDICAL_CONCLUSION_LABELS_RU[card.conclusion] || {
    name: card.conclusion,
    badgeClass: 'bg-gray-100 text-gray-800',
  };

  // Акты психиатрического освидетельствования того же работника (342н)
  const psychExams = storage.listPsychiatricExams({ page: 1, pageSize: 100000 }).items.filter(
    e => e.employee_id === card.employee_id
  );

  const handleArchive = () => {
    if (!window.confirm(`Отправить карту медосмотра № ${card.card_number} в архив?`)) return;
    try {
      storage.archiveMedicalCard(card.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = () => {
    try {
      storage.restoreMedicalCard(card.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка восстановления');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Шапка и навигация */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('medical')}
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← К реестру медосмотров
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">
              Карта медосмотра № {card.card_number}
            </h1>
            {card.status === 'archived' && (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-600">
                В архиве
              </span>
            )}
            <span className={`px-3 py-1 rounded text-xs font-bold border ${conclusionInfo.badgeClass}`}>
              {conclusionInfo.name}
            </span>
            {isOverdue && (
              <span className="px-3 py-1 rounded text-xs font-bold border bg-rose-100 text-rose-800 border-rose-300">
                ⚠ Срок следующего медосмотра просрочен
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Медицинский осмотр по Приказу Минздрава России № 29н ·{' '}
            {MEDICAL_EXAM_TYPE_LABELS_RU[card.exam_type] || card.exam_type}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {card.status === 'active' ? (
            <>
              <button
                onClick={() => onNavigate('medical-edit', card.id)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50"
              >
                Редактировать
              </button>
              <button
                onClick={handleArchive}
                className="px-3.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs font-semibold hover:bg-rose-100"
              >
                В архив
              </button>
            </>
          ) : (
            <button
              onClick={handleRestore}
              className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-semibold hover:bg-emerald-100"
            >
              Восстановить из архива
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm">
          {errorMsg}
        </div>
      )}

      {/* Общие сведения */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">
          Общие сведения
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 text-sm">
          <div>
            <span className="text-xs text-slate-500 block">Организация (юрлицо):</span>
            <span className="font-semibold text-slate-800">{le?.full_name || '—'}</span>
            {le?.inn && <span className="text-xs text-slate-500 block">ИНН: {le.inn}</span>}
          </div>

          <div className="lg:col-span-2">
            <span className="text-xs text-slate-500 block">Работник:</span>
            {employee ? (
              <a
                href={`#employees/${employee.id}`}
                onClick={e => {
                  e.preventDefault();
                  onNavigate('employees-view', employee.id);
                }}
                className="font-semibold text-blue-700 hover:underline"
              >
                {`${employee.last_name} ${employee.first_name} ${employee.middle_name || ''}`.trim()}
              </a>
            ) : (
              <span className="font-semibold text-slate-800">—</span>
            )}
            <span className="text-xs text-slate-500 block">
              {dept?.name || '—'} / {pos?.name || '—'}
              {employee?.snils ? ` · СНИЛС: ${employee.snils}` : ''}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Дата выдачи направления:</span>
            <span className="text-slate-800">{formatDateForDisplay(card.referral_date) || '—'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Дата прохождения медосмотра:</span>
            <span className="text-slate-800">{formatDateForDisplay(card.exam_date) || 'Не пройден'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Срок следующего медосмотра:</span>
            <span className={isOverdue ? 'text-rose-700 font-bold' : 'text-slate-800'}>
              {formatDateForDisplay(card.next_due_date) || '—'}
              {isOverdue && ' (просрочен)'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Медицинская организация:</span>
            <span className="text-slate-800">{card.clinic_name || '—'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Врач (ФИО):</span>
            <span className="text-slate-800">{card.doctor_fio || '—'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Противопоказания:</span>
            <span className={card.contraindications_found ? 'text-rose-700 font-semibold' : 'text-slate-800'}>
              {card.contraindications_found ? 'Выявлены' : 'Не выявлены'}
            </span>
          </div>
        </div>
      </div>

      {/* Заключение */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 border-b pb-2">
          Заключение по результатам медосмотра
        </h2>
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-3 py-1 rounded text-sm font-semibold border ${conclusionInfo.badgeClass}`}>
            {conclusionInfo.name}
          </span>
        </div>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {card.conclusion_details || 'Подробности заключения не указаны.'}
        </p>
      </div>

      {/* Связанные записи */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 border-b pb-2">
          Связанные записи (контингент и СОУТ)
        </h2>
        <div className="space-y-3 text-sm">
          {contingent ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs text-slate-500 block">Контингент (обязательства по 29н):</span>
                <span className="text-slate-800">
                  Запись контингента от рабочего места{' '}
                  {contingent.workplace_label || '—'}
                  {(contingent.medical_items_29n || []).length > 0 && (
                    <> · Показания 29н: {contingent.medical_items_29n!.join(', ')}</>
                  )}
                </span>
              </div>
              <button
                className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                onClick={() => onNavigate('contingent-view', contingent.id)}
              >
                Открыть →
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Запись контингента не связана.</p>
          )}

          {soutCard ? (
            <div className="flex items-start justify-between gap-3 border-t pt-3">
              <div>
                <span className="text-xs text-slate-500 block">Карта СОУТ (основание направления):</span>
                <span className="text-slate-800">
                  Карта СОУТ № {soutCard.card_number} · Итоговый класс: {soutCard.final_class}
                </span>
              </div>
              <button
                className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                onClick={() => onNavigate('sout-view', soutCard.id)}
              >
                Открыть →
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 border-t pt-3">Карта СОУТ не связана.</p>
          )}
        </div>
      </div>

      {/* Психиатрические освидетельствования работника (342н) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 border-b pb-2">
          Психиатрические освидетельствования работника (342н) — {psychExams.length}
        </h2>
        {psychExams.length === 0 ? (
          <p className="text-xs text-slate-500">
            Для данного работника акты психиатрического освидетельствования не зарегистрированы.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {psychExams.map(e => {
              const expired = !!e.valid_until && e.valid_until < today;
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-semibold text-slate-800">
                      {formatDateForDisplay(e.exam_date) || 'Дата не указана'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {' '}· {e.conclusion_protocol_number ? `Протокол ${e.conclusion_protocol_number}` : 'Без протокола'}
                      {' '}· Срок действия: {formatDateForDisplay(e.valid_until) || '—'}
                      {expired && <span className="text-rose-600 font-semibold"> (истёк)</span>}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      expired ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {expired ? 'Заключение недействительно' : 'Заключение действительно'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Хронология */}
      <div className="text-xs text-slate-500 flex justify-between border-t pt-3">
        <span>Создана: {new Date(card.created_at).toLocaleString('ru-RU')}</span>
        <span>Обновлена: {new Date(card.updated_at).toLocaleString('ru-RU')}</span>
      </div>
    </div>
  );
};
